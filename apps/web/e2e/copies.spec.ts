import { expect, test } from '@playwright/test';

import { type TestAccount, createAccount, deleteAccount, deleteWork, signIn, signInClient } from './support/accounts';

/** A made-up word, so titles from parallel runs never match each other. */
const token = () => `spora${Math.random().toString(36).slice(2, 8)}`;

test.describe('copies in the Tana', () => {
  let ada: TestAccount;
  let carla: TestAccount;
  let workId: string;

  test.beforeEach(async () => {
    ada = await createAccount('active');
    carla = await createAccount('active');
    const { client } = await signInClient(ada);
    const { data, error } = await client.rpc('create_edition', {
      entry: {
        work: { title: `Il bosco delle copie ${token()}`, authors: [{ name: 'Ada Muskio' }] },
        edition: { publisher: 'Edizioni Sottobosco', published_year: 2019 },
      },
    });
    expect(error).toBeNull();
    workId = (data as { work_id: string }).work_id;
  });
  test.afterEach(async () => {
    await deleteWork(workId);
    await deleteAccount(ada);
    await deleteAccount(carla);
  });

  test('a book in the catalog goes into the Tana, is edited and taken out again', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, ada, baseURL!);
    await page.goto(`/books/${workId}`);
    const copies = page.getByRole('region', { name: "Ce l'hai" });
    await expect(copies.getByText('Non è ancora nella tua Tana.')).toBeVisible();

    await copies.getByRole('button', { name: "Ce l'ho" }).click();
    await copies.getByLabel("Quando l'hai presa").fill('2024-05-01');
    await copies.getByLabel('Note').fill('Regalo di compleanno, con dedica');
    await copies.getByRole('button', { name: 'Mettila nella Tana' }).click();

    await expect(copies.getByText('Si può prestare · Presa il 1 maggio 2024')).toBeVisible();
    await expect(copies.getByText('Regalo di compleanno, con dedica')).toBeVisible();

    await copies.getByRole('button', { name: 'Modifica' }).click();
    await copies.getByLabel('Si può prestare').uncheck();
    await copies.getByRole('button', { name: 'Salva' }).click();
    await expect(copies.getByText('Non la presti · Presa il 1 maggio 2024')).toBeVisible();

    // Edits survive a reload: they are in the database, not in the page.
    await page.reload();
    await expect(copies.getByText('Non la presti · Presa il 1 maggio 2024')).toBeVisible();

    await copies.getByRole('button', { name: 'Togli dalla Tana' }).click();
    await copies.getByRole('button', { name: 'Sì, toglila' }).click();
    await expect(copies.getByText('Non è ancora nella tua Tana.')).toBeVisible();
  });

  test('a date in the future is refused', async ({ page, context, baseURL }) => {
    await signIn(context, ada, baseURL!);
    await page.goto(`/books/${workId}`);
    const copies = page.getByRole('region', { name: "Ce l'hai" });
    await copies.getByRole('button', { name: "Ce l'ho" }).click();
    await copies.getByLabel("Quando l'hai presa").fill('2999-01-01');
    await copies.getByRole('button', { name: 'Mettila nella Tana' }).click();
    await expect(copies.getByText('Questa data non è ancora arrivata.')).toBeVisible();
  });

  test("another account never sees someone else's copy", async ({ page, context, baseURL }) => {
    const { client } = await signInClient(ada);
    const { data: edition } = await client.from('editions').select('id').eq('work_id', workId).single();
    const { error } = await client.from('copies').insert({ edition_id: edition!.id, notes: 'La copia di Ada' });
    expect(error).toBeNull();

    await signIn(context, carla, baseURL!);
    await page.goto(`/books/${workId}`);
    const copies = page.getByRole('region', { name: "Ce l'hai" });
    await expect(copies.getByText('Non è ancora nella tua Tana.')).toBeVisible();
    await expect(page.getByText('La copia di Ada')).toHaveCount(0);
  });
});

test.describe('adding without owning', () => {
  let account: TestAccount;
  let workId: string | undefined;
  test.beforeEach(async ({ context, baseURL }) => {
    account = await createAccount('active');
    await signIn(context, account, baseURL!);
  });
  test.afterEach(async () => {
    if (workId) await deleteWork(workId);
    await deleteAccount(account);
  });

  test('unticking "Ce l\'ho" puts the book in the catalog only', async ({ page }) => {
    await page.goto('/add');
    await page.getByRole('searchbox', { name: 'Titolo, autore o ISBN' }).fill(`nessuno ${token()}`);
    await page.getByRole('button', { name: 'Cerca' }).click();
    await page.getByRole('button', { name: 'Inseriscilo a mano' }).click();
    await page.getByRole('textbox', { name: 'Titolo', exact: true }).fill(`Preso in biblioteca ${token()}`);
    await page.getByLabel("Ce l'ho").uncheck();
    await expect(page.getByLabel('Si può prestare')).toBeHidden();
    await page.getByRole('button', { name: 'Aggiungi al catalogo' }).click();

    await expect(page).toHaveURL(/\?added=catalog$/);
    workId = page.url().split('/books/')[1]!.split('?')[0]!;
    await expect(page.getByRole('status')).toContainText('Aggiunto al catalogo');
    await expect(
      page.getByRole('region', { name: "Ce l'hai" }).getByText('Non è ancora nella tua Tana.'),
    ).toBeVisible();
  });
});
