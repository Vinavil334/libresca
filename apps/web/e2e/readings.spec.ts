import { expect, test } from '@playwright/test';

import { type TestAccount, createAccount, deleteAccount, deleteWork, signIn, signInClient } from './support/accounts';

/** A made-up word, so titles from parallel runs never match each other. */
const token = () => `spora${Math.random().toString(36).slice(2, 8)}`;

test.describe('readings', () => {
  let ada: TestAccount;
  let carla: TestAccount;
  let workId: string;
  let title: string;

  test.beforeEach(async () => {
    ada = await createAccount('active');
    carla = await createAccount('active');
    title = `Il bosco delle letture ${token()}`;
    const { client } = await signInClient(ada);
    const { data, error } = await client.rpc('create_edition', {
      entry: {
        work: { title, authors: [{ name: 'Ada Muskio' }] },
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

  test('from the Dispensa to "Finito!", with a rating and notes, then a reread', async ({ page, context, baseURL }) => {
    await signIn(context, ada, baseURL!);
    await page.goto(`/books/${workId}`);
    const ask = page.getByRole('region', { name: "L'hai letto?" });
    await expect(ask.getByText("Vale anche se non ce l'hai")).toBeVisible();

    await ask.getByRole('button', { name: 'Voglio leggerlo · in Dispensa' }).click();
    const readings = page.getByRole('region', { name: 'Le tue letture' });
    await expect(readings.getByText('In Dispensa · da leggere')).toBeVisible();

    await readings.getByRole('button', { name: 'Comincio a leggerlo' }).click();
    await expect(readings.getByText('In lettura', { exact: true })).toBeVisible();
    // No date is ever filled in for the user.
    await expect(readings.getByText('inizio non segnato')).toBeVisible();

    await readings.getByRole('button', { name: "L'ho finito" }).click();
    const finished = page.getByRole('dialog', { name: 'Finito!' });
    await expect(finished.getByText(`«${title}» è tra i tuoi letti.`)).toBeVisible();
    // A tap gives five mushrooms, a second tap on the same one takes half off.
    await finished.getByRole('button', { name: 'Dai 5 funghetti' }).click();
    await finished.getByRole('button', { name: 'Dai 4,5 funghetti' }).click();
    await expect(finished.getByText('4,5 funghetti')).toBeVisible();
    await finished.getByRole('button', { name: 'Scrivi due righe' }).click();

    const sheet = page.getByRole('dialog', { name: 'La tua lettura' });
    await expect(sheet.getByText(`${title} · prima lettura`)).toBeVisible();
    await expect(sheet.getByRole('radio', { name: "L'ho letto" })).toBeChecked();
    await expect(sheet.getByRole('textbox', { name: 'Note' })).toBeFocused();
    await expect(sheet.getByText('4,5 funghetti')).toBeVisible();
    await sheet.getByRole('textbox', { name: 'Note' }).fill('Una topina indimenticabile');
    await sheet.getByLabel('Iniziato').fill('2024-03-01');
    await sheet.getByLabel('Finito', { exact: true }).fill('2024-03-20');
    await sheet.getByRole('button', { name: 'Salva la lettura' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await expect(readings.getByText('Letto', { exact: true })).toBeVisible();
    await expect(readings.getByText('dal 1 al 20 marzo 2024')).toBeVisible();
    await expect(readings.getByRole('img', { name: '4,5 funghetti' })).toBeVisible();
    await expect(readings.getByText('Una topina indimenticabile')).toBeVisible();

    // A reread is a new reading; the first one stays with its dates and rating.
    await readings.getByRole('button', { name: 'Inizia una rilettura' }).click();
    await expect(readings.getByRole('listitem')).toHaveCount(2);
    await page.reload();
    await expect(readings.getByRole('listitem').first()).toContainText('Seconda lettura');
    await expect(readings.getByRole('listitem').first()).toContainText('In lettura');
    await expect(readings.getByRole('listitem').nth(1)).toContainText('Prima lettura');
    await expect(readings.getByRole('listitem').nth(1)).toContainText('dal 1 al 20 marzo 2024');
  });

  test('a past reading: wrong dates are refused gently, and there is no "Finito!"', async ({
    page,
    context,
    baseURL,
  }) => {
    await signIn(context, ada, baseURL!);
    await page.goto(`/books/${workId}`);
    await page.getByRole('button', { name: "L'ho già letto" }).click();
    const sheet = page.getByRole('dialog', { name: 'La tua lettura' });
    await expect(sheet.getByText('Non ricordi una data? Lasciala vuota: va bene così.')).toBeVisible();
    await sheet.getByLabel('Iniziato').fill('2024-03-02');
    await sheet.getByLabel('Finito', { exact: true }).fill('2024-03-01');
    await sheet.getByRole('button', { name: 'Salva la lettura' }).click();
    await expect(sheet.getByText("La fine viene prima dell'inizio: controlla le date.")).toBeVisible();

    await sheet.getByLabel('Iniziato').fill('');
    await sheet.getByRole('button', { name: 'Salva la lettura' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const readings = page.getByRole('region', { name: 'Le tue letture' });
    await expect(readings.getByText('finita il 1 marzo 2024 · inizio non segnato')).toBeVisible();
  });

  test('"Messo da parte" without judgement, and deleting asks first', async ({ page, context, baseURL }) => {
    await signIn(context, ada, baseURL!);
    await page.goto(`/books/${workId}`);
    await page.getByRole('button', { name: 'Lo sto leggendo' }).click();
    const readings = page.getByRole('region', { name: 'Le tue letture' });
    await readings.getByRole('button', { name: 'Lo metto da parte' }).click();
    await expect(readings.getByText('Messo da parte', { exact: true })).toBeVisible();
    await expect(page.getByText(/abbandonat/i)).toHaveCount(0);

    await readings.getByRole('button', { name: 'Modifica' }).click();
    const sheet = page.getByRole('dialog', { name: 'La tua lettura' });
    await expect(sheet.getByRole('radio', { name: 'Messo da parte' })).toBeChecked();
    await sheet.getByRole('button', { name: 'Elimina questa lettura' }).click();
    await expect(sheet.getByText('Eliminare questa lettura? Le altre restano.')).toBeVisible();
    await sheet.getByRole('button', { name: 'Sì, eliminala' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('region', { name: "L'hai letto?" })).toBeVisible();
  });

  test("another account never sees someone else's readings", async ({ page, context, baseURL }) => {
    const { client } = await signInClient(ada);
    const { error } = await client
      .from('readings')
      .insert({ work_id: workId, status: 'read', rating_half: 10, review: 'Il giudizio di Ada' });
    expect(error).toBeNull();

    await signIn(context, carla, baseURL!);
    await page.goto(`/books/${workId}`);
    await expect(page.getByRole('region', { name: "L'hai letto?" })).toBeVisible();
    await expect(page.getByText('Il giudizio di Ada')).toHaveCount(0);
  });
});
