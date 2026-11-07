import { NextResponse, type NextRequest } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Google sends the user back here through Supabase with a one-time code.
 * Exchanging it sets the session cookies; the proxy then routes by profile status.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.redirect(new URL('/login?error=callback', request.url));
}
