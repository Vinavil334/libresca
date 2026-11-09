import type { Database } from '@libresca/data';
import type { BrowserContext } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: run the tests through playwright.config.ts.`);
  return value;
}

/** Admin client on the local stack only: the secret key comes from `supabase status`. */
function admin() {
  return createClient<Database>(env('E2E_SUPABASE_URL'), env('E2E_SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TestAccount {
  id: string;
  email: string;
  password: string;
  displayName: string;
}

/** Creates a fake account with the given status. Google is not available in tests, so it has a password. */
export async function createAccount(status: 'pending' | 'active' | 'suspended'): Promise<TestAccount> {
  const email = `e2e-${randomUUID()}@example.com`;
  const password = randomUUID();
  const displayName = 'Àgata Funghétti';
  const client = admin();

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });
  if (error || !data.user) throw error ?? new Error('createUser returned no user');

  if (status !== 'pending') {
    const { error: updateError } = await client.from('profiles').update({ status }).eq('id', data.user.id);
    if (updateError) throw updateError;
  }
  return { id: data.user.id, email, password, displayName };
}

export async function deleteAccount(account: TestAccount): Promise<void> {
  await admin().auth.admin.deleteUser(account.id);
}

/**
 * Signs the account in and hands the session cookies to the browser, written by
 * @supabase/ssr itself so their format matches what the app reads.
 */
export async function signIn(context: BrowserContext, account: TestAccount, baseURL: string): Promise<void> {
  const jar = new Map<string, string>();
  const client = createServerClient<Database>(env('E2E_SUPABASE_URL'), env('E2E_SUPABASE_PUBLISHABLE_KEY'), {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (toSet) => {
        for (const { name, value } of toSet) jar.set(name, value);
      },
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error) throw error;

  await context.addCookies(
    [...jar]
      .filter(([, value]) => value)
      .map(([name, value]) => ({ name, value, url: baseURL, sameSite: 'Lax' as const })),
  );
}

/** Signs the account in outside the browser, for API calls with `Authorization: Bearer`. */
export async function signInClient(account: TestAccount) {
  const client = createClient<Database>(env('E2E_SUPABASE_URL'), env('E2E_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: account.email, password: account.password });
  if (error || !data.session) throw error ?? new Error('signInWithPassword returned no session');
  return { client, accessToken: data.session.access_token };
}

/**
 * Removes a work, its readings, editions, copies and cover photos created by a test. Catalog rows
 * and stored files outlive accounts, so tests clean up.
 */
export async function deleteWork(workId: string): Promise<void> {
  const client = admin();
  const { data } = await client.from('editions').select('id, cover_path').eq('work_id', workId);
  const photos = (data ?? []).flatMap((edition) => (edition.cover_path ? [edition.cover_path] : []));
  // Copies keep their edition in the catalog: remove them first.
  const editionIds = (data ?? []).map((edition) => edition.id);
  if (editionIds.length > 0) await client.from('copies').delete().in('edition_id', editionIds);
  await client.from('readings').delete().eq('work_id', workId);
  await client.from('editions').delete().eq('work_id', workId);
  await client.from('works').delete().eq('id', workId);
  if (photos.length > 0) await client.storage.from('covers').remove(photos);
}
