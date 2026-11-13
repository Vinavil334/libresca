import { expect, test } from '@playwright/test';

import { type TestAccount, createAccount, deleteAccount, deleteWork, signIn, signInClient } from './support/accounts';

/** A made-up word, so titles from parallel runs never match each other. */
const token = () => `spora${Math.random().toString(36).slice(2, 8)}`;

test.describe('shelves', () => {
  let ada: TestAccount;
  let carla: TestAccount;
  let workId: string;
  let title: string;

  test.beforeEach(async () => {
    ada = await createAccount('active');
    carla = await createAccount('active');
    title = `Il bosco degli scaffali ${token()}`;
    const { client } = await signInClient(ada);
    const { data, error } = await client.rpc('create_edition', {
      entry: { work: { title, authors: [{ name: 'Ada Muskio' }] }, edition: { publisher: 'Edizioni Sottobosco' } },
    });
    expect(error).toBeNull();
    const ids = data as { work_id: string; edition_id: string };
    workId = ids.work_id;
    expect((await client.from('copies').insert({ edition_id: ids.edition_id })).error).toBeNull();
  });
  test.afterEach(async () => {
    await deleteWork(workId);
    await deleteAccount(ada);
    await deleteAccount(carla);
  });

  test('a shelf is made, filled from the book page, renamed and removed', async ({ page, context, baseURL }) => {
    await signIn(context, ada, baseURL!);
    await page.goto('/shelves');
    await expect(page.getByText('come li sistemi tu · ancora nessuno')).toBeVisible();

    await page.getByRole('button', { name: 'Nuovo scaffale' }).click();
    const sheet = page.getByRole('dialog', { name: 'Nuovo scaffale' });
    await expect(sheet.getByLabel('Nome dello scaffale')).toBeFocused();
    await sheet.getByLabel('Nome dello scaffale').fill('  Comodino ');
    await sheet.getByRole('button', { name: 'Crea lo scaffale' }).click();
    await expect(page).toHaveURL(/\/shelves\/[0-9a-f-]{36}$/);
    const shelfUrl = page.url();
    await expect(page.getByRole('heading', { level: 1, name: 'Comodino' })).toBeVisible();
    await expect(page.getByText('Questo scaffale è ancora vuoto.')).toBeVisible();

    // The same name again, in another case, is refused gently.
    await page.goto('/shelves');
    await page.getByRole('button', { name: 'Nuovo scaffale' }).click();
    await page.getByLabel('Nome dello scaffale').fill('comodino');
    await page.getByRole('button', { name: 'Crea lo scaffale' }).click();
    await expect(page.getByText('Hai già uno scaffale con questo nome.')).toBeVisible();
    await page.keyboard.press('Escape');

    // From the book page, a tap puts the book on the shelf.
    await page.goto(`/books/${workId}`);
    const onBook = page.getByRole('region', { name: 'Sui tuoi scaffali' });
    const chip = onBook.getByRole('button', { name: 'Comodino' });
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(onBook.getByRole('button', { name: 'Comodino' })).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/shelves');
    await expect(page.getByRole('link', { name: /Comodino/ })).toContainText('1 libro');
    await page.getByRole('link', { name: /Comodino/ }).click();
    await expect(page.getByText('uno scaffale della tua Tana · 1 libro')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Griglia' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
    await page.getByRole('button', { name: 'Dispensa' }).click();
    await expect(page.getByText('0 su 1 · solo Dispensa')).toBeVisible();
    await page.getByRole('button', { name: 'Togli il filtro Dispensa' }).click();

    await page.getByRole('button', { name: 'Modifica lo scaffale' }).click();
    const edit = page.getByRole('dialog', { name: 'Modifica lo scaffale' });
    await edit.getByLabel('Nome dello scaffale').fill('Sul comodino');
    await edit.getByRole('button', { name: 'Salva il nome' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sul comodino' })).toBeVisible();

    // Another account never reaches the shelf.
    const carlaContext = await context.browser()!.newContext();
    await signIn(carlaContext, carla, baseURL!);
    const carlaPage = await carlaContext.newPage();
    await carlaPage.goto(shelfUrl);
    await expect(carlaPage.getByRole('heading', { name: 'Sul comodino' })).toHaveCount(0);
    await carlaContext.close();

    await page.getByRole('button', { name: 'Modifica lo scaffale' }).click();
    await page.getByRole('button', { name: 'Elimina lo scaffale' }).click();
    await expect(page.getByText('Eliminare lo scaffale? I libri restano nella tua Tana.')).toBeVisible();
    await page.getByRole('button', { name: 'Sì, eliminalo' }).click();
    await expect(page).toHaveURL(/\/shelves$/);
    await expect(page.getByText('come li sistemi tu · ancora nessuno')).toBeVisible();

    // The book is still in the Tana.
    await page.goto('/');
    await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
  });
});
