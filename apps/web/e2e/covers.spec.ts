import { expect, test } from '@playwright/test';

import { type TestAccount, createAccount, deleteAccount, deleteWork, signIn, signInClient } from './support/accounts';

const token = () => `spora${Math.random().toString(36).slice(2, 8)}`;

/** A valid, made-up ISBN-13, so parallel runs never collide. */
function randomIsbn(): string {
  const digits = `979${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const sum = [...digits].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return `${digits}${(10 - (sum % 10)) % 10}`;
}

// The sources are off in the end-to-end tests (METADATA_SOURCES=off): the run looks at
// every book without cover and finds none. Filling a cover is covered by the pgTAP tests.
test.describe('missing covers', () => {
  let ada: TestAccount;
  let workId: string;

  test.beforeEach(async () => {
    ada = await createAccount('active');
    const { client } = await signInClient(ada);
    const { data, error } = await client.rpc('create_edition', {
      entry: {
        work: { title: `Il bosco senza copertina ${token()}`, authors: [{ name: 'Ada Muskio' }] },
        edition: { isbn13: randomIsbn(), publisher: 'Sottobosco' },
      },
    });
    expect(error).toBeNull();
    const ids = data as { work_id: string; edition_id: string };
    workId = ids.work_id;
    expect((await client.from('copies').insert({ edition_id: ids.edition_id })).error).toBeNull();
  });
  test.afterEach(async () => {
    await deleteWork(workId);
    await deleteAccount(ada);
  });

  test('looks for the covers of the books without one and says how it went', async ({ page, context, baseURL }) => {
    await signIn(context, ada, baseURL!);
    await page.goto('/me');
    const covers = page.getByRole('region', { name: 'Copertine mancanti' });
    await covers.getByRole('button', { name: 'Cerca le copertine' }).click();

    await expect(covers.getByText('Nessuna copertina nuova.')).toBeVisible();
    await expect(covers.getByText('Per 1 libro nessuna fonte ha la copertina')).toBeVisible();
    await expect(covers.getByRole('button', { name: 'Cerca le copertine' })).toBeHidden();
  });

  test('the API walks the Tana in steps and refuses visitors', async ({ request, baseURL }) => {
    const anonymous = await request.post(`${baseURL}/api/v1/covers/fill`, { data: {} });
    expect(anonymous.status()).toBe(401);

    const { accessToken } = await signInClient(ada);
    const response = await request.post(`${baseURL}/api/v1/covers/fill`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { after: null, googleCalls: 0 },
    });
    expect(response.ok()).toBe(true);
    expect(await response.json()).toEqual({ checked: 1, found: 0, remaining: 0, next: null, googleCalls: 0 });
  });
});
