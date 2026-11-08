import { expect, test } from '@playwright/test';

import { type TestAccount, createAccount, deleteAccount, signIn } from './support/accounts';
import { barcodeVideo, randomIsbn13 } from './support/barcode';

// Chromium only (see playwright.config.ts): its fake camera plays a video of a barcode.
// Windows and Linux Chromium have no native BarcodeDetector, so this exercises the
// ZXing polyfill and the WASM served from /zxing/.
const isbn13 = randomIsbn13();

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${barcodeVideo(isbn13)}`,
    ],
  },
});

test.describe('the barcode scanner', () => {
  let account: TestAccount;
  test.beforeEach(async ({ context, baseURL }) => {
    account = await createAccount('active');
    await signIn(context, account, baseURL!);
  });
  test.afterEach(async () => deleteAccount(account));

  test('reads the ISBN from the camera and opens its card', async ({ page }) => {
    const wasm = page.waitForResponse((response) => /\/zxing\/zxing_reader-[\d.]+\.wasm$/.test(response.url()));
    await page.goto('/add');
    await page.getByRole('button', { name: 'Scansiona il codice a barre' }).click();

    const scanner = page.getByRole('dialog', { name: 'Scansiona il codice a barre' });
    expect((await wasm).status()).toBe(200);

    // The sources are off in tests: the ISBN is unknown, so the card opens with the code.
    await expect(page.getByRole('heading', { name: 'Controlla la scheda' })).toBeVisible({ timeout: 20_000 });
    await expect(scanner).toBeHidden();
    await expect(page.getByText(isbn13)).toBeVisible();
  });
});
