import { type Database, getAccess } from '@libresca/data';
import { redirectFor } from '@libresca/domain';
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { supabaseEnv } from './lib/supabase/env';

/**
 * Runs before every page: refreshes the Supabase session cookies, then sends the
 * request to the only area its access allows (packages/domain/src/access.ts).
 */
export async function proxy(request: NextRequest) {
  const { url, key } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [header, value] of Object.entries(headers)) response.headers.set(header, value);
      },
    },
  });

  // getClaims verifies the token signature; never trust getSession() on the server.
  const { data } = await supabase.auth.getClaims();
  const access = await getAccess(supabase, data?.claims.sub);
  const target = redirectFor(access, request.nextUrl.pathname);
  if (!target) return response;

  const redirect = NextResponse.redirect(new URL(target, request.url));
  // Keep refreshed session cookies and their no-cache headers on the redirect too.
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = response.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}

export const config = {
  matcher: [
    // Everything except Next.js internals and static files with an extension (icons, manifest, fonts).
    '/((?!_next/static|_next/image|.*\\.(?:ico|png|svg|jpg|jpeg|webp|webmanifest|txt|xml|woff2?)$).*)',
  ],
};
