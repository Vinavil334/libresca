import { expect, test } from '@playwright/test';

import { type TestAccount, createAccount, deleteAccount, deleteWork, signIn, signInClient } from './support/accounts';

const token = () => `spora${Math.random().toString(36).slice(2, 8)}`;

test.describe('correcting a book card', () => {
  let ada: TestAccount;
  let workId: string;
  let word: string;

  test.beforeEach(async () => {
    ada = await createAccount('active');
    word = token();
    const { client } = await signInClient(ada);
    const { data, error } = await client.rpc('create_edition', {
      entry: {
        work: { title: `Le origini del mal ${word}`, authors: [{ name: 'Ada Muskio' }] },
        edition: { publisher: 'Sottobosco' },
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

  test('fixes the work and its edition, and says what is wrong', async ({ page, context, baseURL }) => {
    await signIn(context, ada, baseURL!);
    await page.goto(`/books/${workId}`);
    await page.getByRole('link', { name: 'Modifica la scheda' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Correggi la scheda' })).toBeVisible();
    await expect(page.getByText('Le correzioni valgono per tutti')).toBeVisible();

    const title = page.getByRole('textbox', { name: 'Titolo', exact: true });
    await title.fill('');
    await page.getByRole('button', { name: 'Salva le correzioni' }).click();
    await expect(page.getByText('Questo campo serve.')).toBeVisible();

    await title.fill(`Le origini del male ${word}`);
    await page.getByRole('button', { name: 'Aggiungi un autore' }).click();
    await page.getByRole('textbox', { name: 'Autore 2', exact: true }).fill('Bruno Felce');
    await page.getByLabel('Anno della prima edizione').fill('2016');
    await page.getByLabel('Di cosa parla').fill('Un risveglio, e una casa piena di silenzio.');
    await page.getByRole('textbox', { name: 'Editore', exact: true }).fill('Edizioni Sottobosco');
    await page.getByLabel('Pagine').fill('212');
    await page.getByRole('button', { name: 'Aggiungi un traduttore' }).click();
    await page.getByRole('textbox', { name: 'Traduttore 1', exact: true }).fill('Carla Felce');
    await page.getByRole('button', { name: 'Salva le correzioni' }).click();

    await expect(page).toHaveURL(new RegExp(`/books/${workId}$`));
    await expect(page.getByRole('heading', { level: 1, name: `Le origini del male ${word}` })).toBeVisible();
    await expect(page.getByText('Ada Muskio e Bruno Felce')).toBeVisible();
    await expect(page.getByText('Prima edizione: 2016')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Di cosa parla' })).toContainText('una casa piena di silenzio');
    const editions = page.getByRole('region', { name: 'Edizioni' });
    await expect(editions).toContainText('Edizioni Sottobosco · 212 pagine');
    await expect(editions).toContainText('Traduzione di Carla Felce');

    // The author kept its catalog row; the new one was added after it.
    const { client } = await signInClient(ada);
    const { data } = await client.from('work_authors').select('position, author:authors(name)').eq('work_id', workId);
    expect((data ?? []).sort((a, b) => a.position - b.position).map((row) => row.author?.name)).toEqual([
      'Ada Muskio',
      'Bruno Felce',
    ]);
  });
});
