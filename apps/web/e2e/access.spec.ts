import { expect, test } from '@playwright/test';
import it from '@libresca/i18n/messages/it.json' with { type: 'json' };

import { type TestAccount, createAccount, deleteAccount, signIn } from './support/accounts';

test('anonymous visitors land on the sign-in page', async ({ page }) => {
  for (const path of ['/', '/waiting', '/some/deep/page']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test.describe('a pending account', () => {
  let account: TestAccount;
  test.beforeEach(async ({ context, baseURL }) => {
    account = await createAccount('pending');
    await signIn(context, account, baseURL!);
  });
  test.afterEach(async () => deleteAccount(account));

  test('waits outside the app', async ({ page }) => {
    for (const path of ['/', '/login']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/waiting$/);
    }
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(it.waiting.pending.title);
    await expect(page.getByText(account.displayName)).toBeVisible();
  });
});

test.describe('a suspended account', () => {
  let account: TestAccount;
  test.beforeEach(async ({ context, baseURL }) => {
    account = await createAccount('suspended');
    await signIn(context, account, baseURL!);
  });
  test.afterEach(async () => deleteAccount(account));

  test('is told the account is paused', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/waiting$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(it.waiting.suspended.title);
  });
});

test.describe('an active account', () => {
  let account: TestAccount;
  test.beforeEach(async ({ context, baseURL }) => {
    account = await createAccount('active');
    await signIn(context, account, baseURL!);
  });
  test.afterEach(async () => deleteAccount(account));

  test('enters the app, is greeted by name, and can sign out', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(`Ciao, ${account.displayName}`)).toBeVisible();

    await page.goto('/waiting');
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole('button', { name: it.auth.signOut }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });
});
