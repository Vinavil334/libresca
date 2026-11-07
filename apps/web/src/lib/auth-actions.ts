'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from './supabase/server';

/** Starts the Google sign-in through Supabase and sends the browser to Google. */
export async function signInWithGoogle(): Promise<void> {
  const origin = (await headers()).get('origin');
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect('/login?error=start');
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
