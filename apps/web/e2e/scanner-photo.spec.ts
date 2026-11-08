import { type Page, expect, test } from '@playwright/test';

import { type TestAccount, createAccount, deleteAccount, signIn } from './support/accounts';
import { ean13Modules, randomIsbn13 } from './support/barcode';

// Runs on every project, iPhone (WebKit) included: no camera is granted here, so the
// scanner falls back to a photo of the code, decoded by the same detector.

/** A PNG photo of the barcode, drawn in the page as a phone would hand it over. */
async function barcodePhoto(page: Page, code: string): Promise<Buffer> {
  const modules = ean13Modules(code);
  const base64 = await page.evaluate((bits) => {
    const moduleWidth = 6;
    const canvas = document.createElement('canvas');
    canvas.width = bits.length * moduleWidth + 160;
    canvas.height = 420;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'black';
    [...bits].forEach((bit, i) => {
      if (bit === '1') context.fillRect(80 + i * moduleWidth, 60, moduleWidth, 300);
    });
    return canvas.toDataURL('image/png').split(',')[1]!;
  }, modules);
  return Buffer.from(base64, 'base64');
}

/** A valid EAN-13 that is not an ISBN: an ISSN, as printed on magazines. */
function issnBarcode(): string {
  const first12 = '977123456700';
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return first12 + String((10 - (sum % 10)) % 10);
}

async function choosePhoto(page: Page, trigger: ReturnType<Page['getByRole']>, photo: Buffer) {
  const chooser = page.waitForEvent('filechooser');
  await trigger.click();
  await (await chooser).setFiles({ name: 'codice.png', mimeType: 'image/png', buffer: photo });
}

test.describe('scanning from a photo', () => {
  let account: TestAccount;
  test.beforeEach(async ({ context, baseURL }) => {
    account = await createAccount('active');
    await signIn(context, account, baseURL!);
  });
  test.afterEach(async () => deleteAccount(account));

  test('reads the ISBN from a photo of the code', async ({ page }) => {
    const isbn13 = randomIsbn13();
    await page.goto('/add');
    await choosePhoto(
      page,
      page.getByRole('button', { name: 'Fotografa il codice' }),
      await barcodePhoto(page, isbn13),
    );

    await expect(page.getByRole('heading', { name: 'Controlla la scheda' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(isbn13)).toBeVisible();
  });

  test('says when the code in the photo is not an ISBN', async ({ page }) => {
    await page.goto('/add');
    await choosePhoto(
      page,
      page.getByRole('button', { name: 'Fotografa il codice' }),
      await barcodePhoto(page, issnBarcode()),
    );
    await expect(page.getByRole('alert').filter({ hasText: 'non è un ISBN' })).toBeVisible({ timeout: 20_000 });
  });

  test('without a camera, the scanner offers the photo and closes with Escape', async ({ page }) => {
    await page.goto('/add');
    await page.getByRole('button', { name: 'Scansiona il codice a barre' }).click();
    const scanner = page.getByRole('dialog', { name: 'Scansiona il codice a barre' });
    await expect(scanner).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chiudi la fotocamera' })).toBeFocused();

    await expect(scanner.getByRole('alert')).toBeVisible({ timeout: 20_000 });
    await expect(scanner.getByRole('button', { name: 'Fotografa il codice' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(scanner).toBeHidden();
    await expect(page.getByRole('searchbox', { name: 'Titolo, autore o ISBN' })).toBeVisible();
  });
});
