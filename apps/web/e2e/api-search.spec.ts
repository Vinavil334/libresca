import { expect, test } from '@playwright/test';

import { type TestAccount, createAccount, deleteAccount, deleteWork, signInClient } from './support/accounts';

// The app under test runs with METADATA_SOURCES=off: these tests cover access, validation
// and the catalog part of the search, never the external sources.
const searchPath = (query: string) => `/api/v1/books/search?q=${encodeURIComponent(query)}`;

test('anonymous calls get 401 in JSON', async ({ request }) => {
  const response = await request.get(searchPath('bosco'), { maxRedirects: 0 });
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: 'unauthorized' });
});

test.describe('an active account', () => {
  let account: TestAccount;
  let workId: string | undefined;
  test.beforeEach(async () => {
    account = await createAccount('active');
  });
  test.afterEach(async () => {
    if (workId) await deleteWork(workId);
    await deleteAccount(account);
  });

  test('gets 400 for a query too short', async ({ request }) => {
    const { accessToken } = await signInClient(account);
    const response = await request.get(searchPath(' a '), { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_query' });
  });

  test('finds a catalog work ignoring accents and case', async ({ request }) => {
    const { client, accessToken } = await signInClient(account);
    // A made-up word, so parallel runs and leftovers never match each other.
    const token = `spora${Math.random().toString(36).slice(2, 8)}`;
    const { data, error } = await client.rpc('create_edition', {
      entry: { work: { title: `La città dei funghi ${token}`, authors: [{ name: 'Ada Muskio' }] }, edition: {} },
    });
    expect(error).toBeNull();
    workId = (data as { work_id: string }).work_id;

    const response = await request.get(searchPath(`CITTA ${token}`), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
    const body = await response.json();
    expect(body).toMatchObject({
      query: `CITTA ${token}`,
      sources: { openlibrary: 'unavailable', googlebooks: 'skipped' },
      candidates: [],
    });
    expect(body.catalog).toEqual([
      expect.objectContaining({
        id: workId,
        title: `La città dei funghi ${token}`,
        authors: [expect.objectContaining({ name: 'Ada Muskio' })],
      }),
    ]);
  });
});
