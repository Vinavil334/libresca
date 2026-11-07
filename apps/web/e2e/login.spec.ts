import { expect, test } from '@playwright/test';
import it from '@libresca/i18n/messages/it.json' with { type: 'json' };

test('the sign-in page speaks Italian and uses the design tokens', async ({ page }) => {
  await page.goto('/login');

  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await expect(page).toHaveTitle(it.metadata.title);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(it.login.title);
  await expect(page.getByText(it.login.intro)).toBeVisible();

  // The body background comes from --color-surface, so tokens.css and Tailwind are wired.
  const { background, surface } = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--color-surface)';
    document.body.append(probe);
    const surface = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { background: getComputedStyle(document.body).backgroundColor, surface };
  });
  expect(background).toBe(surface);

  // Titles use the self-hosted Fraunces.
  const titleFont = await page.getByRole('heading', { level: 1 }).evaluate((el) => getComputedStyle(el).fontFamily);
  expect(titleFont).toContain('Fraunces');
});

test('the sign-in page never scrolls sideways', async ({ page }) => {
  await page.goto('/login');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the Google button starts the OAuth flow through Supabase', async ({ page }) => {
  // Stop at Supabase: tests never reach Google.
  await page.route('**/auth/v1/authorize**', (route) => route.fulfill({ status: 204 }));
  await page.goto('/login');

  const authorize = page.waitForRequest('**/auth/v1/authorize**');
  await page.getByRole('button', { name: it.login.google }).click();
  const url = new URL((await authorize).url());

  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('redirect_to')).toMatch(/\/auth\/callback$/);
});

test('a failed callback shows a gentle error', async ({ page }) => {
  await page.goto('/auth/callback?code=not-a-real-code');
  await expect(page).toHaveURL(/\/login\?error=callback&reason=\w+/);
  await expect(page.getByRole('alert').filter({ hasText: it.login.errors.callback })).toBeVisible();
});
