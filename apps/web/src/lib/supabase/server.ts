import type { Database, LibrescaClient } from '@libresca/data';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { supabaseEnv } from './env';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers,
 * with the session read from the request cookies. Create one per request.
 */
export async function createSupabaseServerClient(): Promise<LibrescaClient> {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot write cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** The verified user id of the current request, or `null`. */
export async function currentUserId(client: LibrescaClient): Promise<string | null> {
  const { data } = await client.auth.getClaims();
  return data?.claims.sub ?? null;
}
