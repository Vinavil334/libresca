import { expect, test } from '@playwright/test';
import it from '@libresca/i18n/messages/it.json' with { type: 'json' };

test('the home page speaks Italian and uses the design tokens', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await expect(page).toHaveTitle(it.metadata.title);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(it.home.title);
  await expect(page.getByText(it.home.intro)).toBeVisible();

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

test('the page never scrolls sideways', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
