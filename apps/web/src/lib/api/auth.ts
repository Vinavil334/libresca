import { type LibrescaClient, createLibrescaClient, getAccess } from '@libresca/data';
import type { ApiError } from '@libresca/metadata';
import { type NextRequest, NextResponse } from 'next/server';

import { createSupabaseServerClient, currentUserId } from '@/lib/supabase/server';
import { supabaseEnv } from '@/lib/supabase/env';

/** A JSON error that is never cached. */
export function apiError(error: ApiError['error'], status: number): NextResponse<ApiError> {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export type ApiAuth = { ok: true; client: LibrescaClient; userId: string } | { ok: false; response: NextResponse };

/**
 * Who is calling `/api/v1` (ADR-0005): a Supabase token in `Authorization: Bearer`,
 * as a mobile app sends it, or the browser's session cookies. Only active accounts
 * pass; the returned client queries the database as that user, so RLS applies.
 */
export async function authenticateApi(request: NextRequest): Promise<ApiAuth> {
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];

  let client: LibrescaClient;
  let userId: string | null;
  if (token) {
    const { url, key } = supabaseEnv();
    client = createLibrescaClient({
      url,
      key,
      options: {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      },
    });
    // getClaims verifies the signature; an invalid or expired token yields no claims.
    const { data } = await client.auth.getClaims(token);
    userId = data?.claims.sub ?? null;
  } else {
    client = await createSupabaseServerClient();
    userId = await currentUserId(client);
  }

  const access = await getAccess(client, userId);
  if (!userId || access === 'anonymous') return { ok: false, response: apiError('unauthorized', 401) };
  if (access !== 'active') return { ok: false, response: apiError('inactive', 403) };
  return { ok: true, client, userId };
}
