import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';

import type { Database } from './database.types';

/** Supabase client typed on the generated schema. */
export type LibrescaClient = SupabaseClient<Database>;

export interface LibrescaClientConfig {
  /** Project URL, for example `NEXT_PUBLIC_SUPABASE_URL`. */
  url: string;
  /**
   * Publishable key in the browser and on the phone. The secret key is only
   * for server code under `/api/v1` and must never reach a client.
   */
  key: string;
  options?: SupabaseClientOptions<'public'>;
}

/**
 * Creates a typed client. Platform specifics (cookies in Next.js, secure
 * storage in Expo) arrive through `options`, so this package stays free of them.
 */
export function createLibrescaClient({ url, key, options }: LibrescaClientConfig): LibrescaClient {
  if (!url) throw new Error('Missing Supabase URL.');
  if (!key) throw new Error('Missing Supabase key.');
  return createClient<Database>(url, key, options);
}
