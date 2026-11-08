import { expect, test } from '@playwright/test';

import { type TestAccount, createAccount, deleteAccount, deleteWork, signIn, signInClient } from './support/accounts';

// These tests never reach the external sources: they cover access, validation and the catalog hit.
const somePath = '/api/v1/books/isbn/9788804668237';

/** A random valid ISBN-13, so parallel runs never collide on the unique index. */
function randomIsbn13(): string {
  const first12 = `979${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return first12 + String((10 - (sum % 10)) % 10);
}

test('anonymous calls get 401 in JSON, not a redirect to the sign-in page', async ({ request }) => {
  const response = await request.get(somePath, { maxRedirects: 0 });
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: 'unauthorized' });
});

test('an invalid Bearer token gets 401', async ({ request }) => {
  const response = await request.get(somePath, { headers: { Authorization: 'Bearer not-a-token' } });
  expect(response.status()).toBe(401);
});

test.describe('a pending account', () => {
  let account: TestAccount;
  test.beforeEach(async () => {
    account = await createAccount('pending');
  });
  test.afterEach(async () => deleteAccount(account));

  test('gets 403 with a valid token', async ({ request }) => {
    const { accessToken } = await signInClient(account);
    const response = await request.get(somePath, { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: 'inactive' });
  });
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

  test('gets 400 for an invalid ISBN, with the browser session', async ({ context, baseURL }) => {
    await signIn(context, account, baseURL!);
    const response = await context.request.get('/api/v1/books/isbn/12345');
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_isbn' });
  });

  test('gets the catalog edition for any ISBN form, without asking the sources', async ({ request }) => {
    const { client, accessToken } = await signInClient(account);
    const isbn13 = randomIsbn13();
    const { data, error } = await client.rpc('create_edition', {
      entry: { work: { title: 'Il bosco di prova', authors: [] }, edition: { isbn13, publisher: 'Sottobosco' } },
    });
    expect(error).toBeNull();
    workId = (data as { work_id: string }).work_id;

    const hyphenated = `${isbn13.slice(0, 3)}-${isbn13.slice(3)}`;
    const response = await request.get(`/api/v1/books/isbn/${hyphenated}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(await response.json()).toMatchObject({
      status: 'catalog',
      isbn13,
      edition: { isbn13, publisher: 'Sottobosco', work: { title: 'Il bosco di prova', authors: [] } },
    });
  });
});
