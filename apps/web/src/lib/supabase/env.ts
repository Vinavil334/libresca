/**
 * Public Supabase settings. Both values are safe in the browser: the publishable key
 * only grants what RLS allows. The secret key never appears in this app outside /api/v1.
 */
export function supabaseEnv(): { url: string; key: string } {
  // Written out in full so Next.js can inline them in client bundles.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local at the repository root.',
    );
  }
  return { url, key };
}
