import { expect, test } from '@playwright/test';

import { type TestAccount, createAccount, deleteAccount, deleteWork, signIn, signInClient } from './support/accounts';

// The app runs with METADATA_SOURCES=off: no source knows any ISBN, and searches find
// only the catalog. The proposal from real sources is covered by the metadata unit tests.

/** A random valid ISBN-13, so parallel runs never collide on the unique index. */
function randomIsbn13(): string {
  const first12 = `979${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return first12 + String((10 - (sum % 10)) % 10);
}

/** A made-up word, so titles from parallel runs never match each other. */
const token = () => `spora${Math.random().toString(36).slice(2, 8)}`;

test.describe('adding a book', () => {
  let account: TestAccount;
  const workIds: string[] = [];

  test.beforeEach(async ({ context, baseURL }) => {
    account = await createAccount('active');
    await signIn(context, account, baseURL!);
  });
  test.afterEach(async () => {
    for (const id of workIds.splice(0)) await deleteWork(id);
    await deleteAccount(account);
  });

  test('an unknown ISBN opens the card with the code, and saving shows the book', async ({ page }) => {
    const isbn13 = randomIsbn13();
    const title = `Il sentiero dei funghi ${token()}`;

    await page.goto('/');
    await page.getByRole('link', { name: 'Aggiungi un libro' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Aggiungi un libro' })).toBeVisible();

    await page
      .getByRole('searchbox', { name: 'Titolo, autore o ISBN' })
      .fill(`${isbn13.slice(0, 3)}-${isbn13.slice(3)}`);
    await page.getByRole('button', { name: 'Cerca' }).click();

    await expect(page.getByRole('heading', { name: 'Controlla la scheda' })).toBeFocused();
    await expect(page.getByText('Nessuna fonte conosce questo ISBN')).toBeVisible();
    await expect(page.getByText(isbn13)).toBeVisible();

    await page.getByRole('textbox', { name: 'Titolo', exact: true }).fill(title);
    await page.getByRole('textbox', { name: 'Autore 1', exact: true }).fill('Àgata Funghétti');
    await page.getByRole('textbox', { name: 'Editore', exact: true }).fill('Edizioni Sottobosco');
    await page.getByLabel('Anno di questa edizione').fill('2021');
    await page.getByLabel('Formato').selectOption('paperback');
    // "L'hai letto?" is its own question, "Non ancora" unless the user says otherwise.
    const readIt = page.getByRole('group', { name: "L'hai letto?" });
    await expect(readIt.getByRole('radio', { name: 'Non ancora' })).toBeChecked();
    await readIt.getByRole('radio', { name: "L'ho letto" }).check();
    await page.getByRole('button', { name: 'Aggiungi alla Tana' }).click();

    await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}\?added=tana$/);
    workIds.push(page.url().split('/books/')[1]!.split('?')[0]!);
    await expect(page.getByRole('status')).toContainText('È nella tua Tana');
    // "Ce l'ho" was ticked by default: the copy is in the "Ce l'hai" block, lendable.
    const copies = page.getByRole('region', { name: "Ce l'hai" });
    await expect(copies.getByText('Si può prestare')).toBeVisible();
    // A book read in the past: a reading without dates, and no "Finito!" moment.
    const readings = page.getByRole('region', { name: 'Le tue letture' });
    await expect(readings.getByText('Letto', { exact: true })).toBeVisible();
    await expect(readings.getByText('date non segnate')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText('Àgata Funghétti')).toBeVisible();
    const editions = page.getByRole('region', { name: 'Edizioni' });
    await expect(editions.getByText(`ISBN ${isbn13}`)).toBeVisible();
    await expect(editions.getByText('Edizioni Sottobosco · 2021')).toBeVisible();

    // The same ISBN again leads straight to the book, without a second card.
    await page.getByRole('link', { name: 'Aggiungi un altro libro' }).click();
    await page.getByRole('searchbox', { name: 'Titolo, autore o ISBN' }).fill(isbn13);
    await page.getByRole('button', { name: 'Cerca' }).click();
    await expect(page).toHaveURL(/\?found=1$/);
    await expect(page.getByRole('status')).toContainText('era già nel catalogo');
  });

  test('a title search finds the catalog work, ignoring accents', async ({ page }) => {
    const word = token();
    const { client } = await signInClient(account);
    const { data, error } = await client.rpc('create_edition', {
      entry: { work: { title: `La città dei funghi ${word}`, authors: [{ name: 'Ada Muskio' }] }, edition: {} },
    });
    expect(error).toBeNull();
    workIds.push((data as { work_id: string }).work_id);

    await page.goto('/add');
    await page.getByRole('searchbox', { name: 'Titolo, autore o ISBN' }).fill(`citta ${word}`);
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Già nel catalogo' })).toBeVisible();
    await page.getByRole('link', { name: new RegExp(`La città dei funghi ${word}`) }).click();
    await expect(page.getByRole('heading', { level: 1, name: `La città dei funghi ${word}` })).toBeVisible();
    await expect(page.getByText('Ada Muskio')).toBeVisible();
  });

  test('a mistyped ISBN and a wrong year get a gentle message', async ({ page }) => {
    await page.goto('/add');
    const search = page.getByRole('searchbox', { name: 'Titolo, autore o ISBN' });
    await search.fill('978-88-06-21935-3');
    await page.getByRole('button', { name: 'Cerca' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Questo ISBN non torna' })).toBeVisible();
    await expect(search).toHaveAttribute('aria-invalid', 'true');

    await search.fill(`nessuno ${token()}`);
    await page.getByRole('button', { name: 'Cerca' }).click();
    await expect(page.getByText("Non l'abbiamo trovato da nessuna parte")).toBeVisible();
    await page.getByRole('button', { name: 'Inseriscilo a mano' }).click();

    await page.getByRole('textbox', { name: 'Titolo', exact: true }).fill(`Senza anno ${token()}`);
    await page.getByLabel('Anno di questa edizione').fill('duemila');
    await page.getByRole('button', { name: 'Aggiungi alla Tana' }).click();
    await expect(page.getByText('Scrivi un anno, per esempio 2019.')).toBeVisible();
    await expect(page.getByLabel('Anno di questa edizione')).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/add$/);
  });

  test('a book typed by hand gets a cover photo, a language and a translator', async ({ page }) => {
    const title = `Fotografie dal sottobosco ${token()}`;
    await page.goto('/add');
    await page.getByRole('searchbox', { name: 'Titolo, autore o ISBN' }).fill(`nessuno ${token()}`);
    await page.getByRole('button', { name: 'Cerca' }).click();
    await page.getByRole('button', { name: 'Inseriscilo a mano' }).click();

    // A large photo drawn in the browser, as a phone camera would hand it over: 1200 × 1800.
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1800;
      const context = canvas.getContext('2d')!;
      context.fillStyle = 'rgb(184, 73, 47)';
      context.fillRect(0, 0, 1200, 1800);
      return canvas.toDataURL('image/png').split(',')[1]!;
    });
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Usa una tua foto' }).click();
    await (
      await chooser
    ).setFiles({ name: 'copertina.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await expect(page.getByText('Foto pronta')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cambia foto' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Titolo', exact: true }).fill(title);
    await expect(page.getByLabel('Lingua')).toHaveValue('it');
    await page.getByLabel('Lingua').selectOption('fr');
    await page.getByRole('button', { name: 'Aggiungi un traduttore' }).click();
    await page.getByRole('textbox', { name: 'Traduttore 1', exact: true }).fill('Bruno Felce');
    await page.getByRole('button', { name: 'Aggiungi alla Tana' }).click();

    await expect(page).toHaveURL(/\/books\/[0-9a-f-]{36}\?added=tana$/);
    workIds.push(page.url().split('/books/')[1]!.split('?')[0]!);
    await expect(page.getByText('Traduzione di Bruno Felce')).toBeVisible();
    await expect(page.getByText('francese')).toBeVisible();

    // The photo is served by the public bucket, resized to a JPEG of at most 800 px.
    const cover = page.locator('img[src*="/storage/v1/object/public/covers/"]').first();
    await expect(cover).toBeVisible();
    const size = await cover.evaluate((img: HTMLImageElement) => ({
      width: img.naturalWidth,
      height: img.naturalHeight,
    }));
    expect(size).toEqual({ width: 533, height: 800 });
    const response = await page.request.get((await cover.getAttribute('src'))!);
    expect(response.headers()['content-type']).toBe('image/jpeg');
  });
});
