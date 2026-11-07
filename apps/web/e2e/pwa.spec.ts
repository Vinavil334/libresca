import { expect, test } from '@playwright/test';
import it from '@libresca/i18n/messages/it.json' with { type: 'json' };

test('the manifest describes an installable app with its icons', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();

  expect(manifest).toMatchObject({
    name: it.metadata.title,
    short_name: it.metadata.title,
    lang: 'it',
    start_url: '/',
    display: 'standalone',
  });
  expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);

  const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
  expect(purposes).toContain('maskable');
  for (const icon of manifest.icons as { src: string; type: string }[]) {
    const file = await request.get(icon.src);
    expect(file.ok(), icon.src).toBe(true);
    expect(file.headers()['content-type'], icon.src).toBe(icon.type);
  }
});

test('pages link the manifest, the icons and a theme color for day and night', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
});

test('Chrome finds and parses the manifest without errors', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Manifest parsing is read through Chrome DevTools.');
  await page.goto('/login');

  // Page.getInstallabilityErrors reports nothing in headless Chrome, even without a manifest:
  // getAppManifest does tell a parsed manifest from a missing one.
  const cdp = await page.context().newCDPSession(page);
  const { url, errors, data } = await cdp.send('Page.getAppManifest');
  expect(url).toMatch(/\/manifest\.webmanifest$/);
  expect(errors).toEqual([]);
  expect(data).toBeTruthy();
});
