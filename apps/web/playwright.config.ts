import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 3100;
const isCI = Boolean(process.env.CI);
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/**
 * End-to-end tests always run against the local Supabase stack, never the remote project:
 * they create and delete accounts. URL and keys come from the running stack.
 */
function localSupabase(): { url: string; publishableKey: string; secretKey: string } {
  let status: Record<string, string>;
  try {
    status = JSON.parse(execSync('pnpm exec supabase status -o json', { cwd: repoRoot, stdio: 'pipe' }).toString());
  } catch {
    throw new Error('The local Supabase stack is not running: start it with `pnpm db:start`.');
  }
  const url = status.API_URL;
  const publishableKey = status.PUBLISHABLE_KEY;
  const secretKey = status.SECRET_KEY;
  if (!url || !publishableKey || !secretKey) throw new Error('`supabase status` did not return URL and keys.');
  return { url, publishableKey, secretKey };
}

const supabase = localSupabase();
// Read by the test helpers in e2e/support, which run in worker processes that inherit this environment.
process.env.E2E_SUPABASE_URL = supabase.url;
process.env.E2E_SUPABASE_PUBLISHABLE_KEY = supabase.publishableKey;
process.env.E2E_SUPABASE_SECRET_KEY = supabase.secretKey;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? 'github' : 'list',
  // Locally the app runs in dev mode and compiles each page on its first visit: allow for it.
  expect: { timeout: isCI ? 5_000 : 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  // The phone is the main device: every test runs on a mobile viewport too. iPhone (WebKit)
  // runs the add and scanner tests, where Safari differs most; the fake camera is Chromium only.
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone', use: { ...devices['iPhone 14'] }, testMatch: /(add-book|scanner-photo)\.spec\.ts$/ },
  ],
  webServer: {
    command: isCI ? `pnpm build && pnpm start --port ${PORT}` : `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    // These win over .env.local, so the app under test talks to the local stack.
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
      METADATA_SOURCES: 'off',
      NEXT_PUBLIC_SUPABASE_URL: supabase.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabase.publishableKey,
    },
  },
});
