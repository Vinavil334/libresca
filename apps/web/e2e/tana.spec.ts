import { expect, test } from '@playwright/test';

import { type TestAccount, createAccount, deleteAccount, deleteWork, signIn, signInClient } from './support/accounts';

/** A made-up word, so titles from parallel runs never match each other. */
const token = () => `spora${Math.random().toString(36).slice(2, 8)}`;

test.describe('the Tana', () => {
  let ada: TestAccount;
  const workIds: string[] = [];

  test.beforeEach(async () => {
    ada = await createAccount('active');
  });
  test.afterEach(async () => {
    for (const id of workIds.splice(0)) await deleteWork(id);
    await deleteAccount(ada);
  });

  /** Adds a work to the catalog as Ada and returns its work and edition ids. */
  async function addWork(title: string, author: string) {
    const { client } = await signInClient(ada);
    const { data, error } = await client.rpc('create_edition', {
      entry: { work: { title, authors: [{ name: author }] }, edition: { publisher: 'Edizioni Sottobosco' } },
    });
    expect(error).toBeNull();
    const ids = data as { work_id: string; edition_id: string };
    workIds.push(ids.work_id);
    return { client, ...ids };
  }

  test('an empty Tana invites to add the first book', async ({ page, context, baseURL }) => {
    await signIn(context, ada, baseURL!);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'La tua Tana' })).toBeVisible();
    await expect(page.getByText('la tua libreria · ancora vuota')).toBeVisible();
    await expect(page.getByText('Qui stanno spuntando i primi funghetti')).toBeVisible();
    await page.getByRole('link', { name: 'Cercalo per titolo o autore' }).click();
    await expect(page).toHaveURL(/\/add$/);
  });

  test('shows owned and read books together, and finds them by search and chips', async ({
    page,
    context,
    baseURL,
  }) => {
    const word = token();
    const citta = await addWork(`Le città invisibili ${word}`, 'Italo Calvino');
    const rosa = await addWork(`Il nome della rosa ${word}`, 'Umberto Eco');
    const lezioni = await addWork(`Lezioni americane ${word}`, 'Italo Calvino');
    const { client } = citta;
    // Owned and read twice; read now, not owned; owned and in the Dispensa.
    expect((await client.from('copies').insert({ edition_id: citta.edition_id, is_lendable: true })).error).toBeNull();
    for (const [finished_on, rating_quarter] of [
      ['2019-05-01', 14],
      ['2024-03-18', 18],
    ] as const) {
      const { error } = await client
        .from('readings')
        .insert({ work_id: citta.work_id, status: 'read', finished_on, rating_quarter });
      expect(error).toBeNull();
    }
    expect((await client.from('readings').insert({ work_id: rosa.work_id, status: 'reading' })).error).toBeNull();
    expect((await client.from('copies').insert({ edition_id: lezioni.edition_id })).error).toBeNull();
    expect((await client.from('readings').insert({ work_id: lezioni.work_id, status: 'want' })).error).toBeNull();

    await signIn(context, ada, baseURL!);
    await page.goto('/');
    await expect(page.getByText('la tua libreria · 3 libri')).toBeVisible();

    const readingNow = page.getByRole('region', { name: 'Stai leggendo' });
    await expect(readingNow.getByRole('listitem')).toHaveCount(1);
    await expect(readingNow).toContainText("Umberto Eco · non ce l'hai");
    await expect(readingNow).toContainText('In lettura');

    const all = page.getByRole('region', { name: 'Tutta la Tana' });
    await expect(all.getByRole('listitem')).toHaveCount(3);
    const cittaRow = all.getByRole('listitem').filter({ hasText: 'Le città invisibili' });
    await expect(cittaRow).toContainText('Letto 2 volte');
    await expect(cittaRow.getByRole('img', { name: '4,5 funghetti' })).toBeVisible();

    // Search ignores accents; chips combine.
    const search = page.getByRole('searchbox', { name: 'Cerca nella tua Tana' });
    await search.fill('CITTA');
    await expect(all.getByRole('listitem')).toHaveCount(1);
    await expect(all.getByText('1 su 3')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Stai leggendo' })).toHaveCount(0);
    await search.fill('');

    await page.getByRole('button', { name: 'Dispensa' }).click();
    await page.getByRole('button', { name: 'In lettura' }).click();
    await expect(all.getByRole('listitem')).toHaveCount(2);
    await page.getByRole('button', { name: 'Dispensa' }).click();
    await page.getByRole('button', { name: 'In lettura' }).click();

    await page.getByRole('button', { name: 'Letti' }).click();
    await search.fill('lezioni');
    await expect(all.getByText('Nessun libro letto con «lezioni»')).toBeVisible();
    await all.getByRole('button', { name: 'Togli il filtro Letti' }).click();
    await expect(all.getByRole('listitem')).toHaveCount(1);

    await search.fill('il bosco che non c’è');
    await all.getByRole('link', { name: 'Cercalo nel catalogo' }).click();
    await expect(page).toHaveURL(/\/add\?q=/);
    await expect(page.getByRole('searchbox', { name: 'Titolo, autore o ISBN' })).toHaveValue('il bosco che non c’è');

    // A row opens the book.
    await page.goto('/');
    await page.getByRole('link', { name: /Lezioni americane/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: `Lezioni americane ${word}` })).toBeVisible();
  });
});
