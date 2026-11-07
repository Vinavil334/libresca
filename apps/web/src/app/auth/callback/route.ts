import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Google sends the user back here through Supabase with a one-time code.
 * Exchanging it sets the session cookies; the proxy then routes by profile status.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get('code');

  // Logged without secrets: enough to tell a missing PKCE cookie from a rejected key or code.
  const context = {
    hasCode: Boolean(code),
    providerError: params.get('error_code') ?? params.get('error'),
    hasCodeVerifierCookie: request.cookies.getAll().some((cookie) => cookie.name.endsWith('-code-verifier')),
  };

  let reason = context.providerError ?? 'missing_code';
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/', request.url));
    reason = error.code ?? `status_${error.status ?? 'unknown'}`;
    console.error('[auth/callback] code exchange failed', { ...context, status: error.status, code: error.code });
  } else {
    console.error('[auth/callback] no code', context);
  }

  const target = new URL('/login', request.url);
  target.searchParams.set('error', 'callback');
  target.searchParams.set('reason', reason);
  return NextResponse.redirect(target);
}
