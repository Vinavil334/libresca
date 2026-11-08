import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

/**
 * One .env.local at the repository root serves the whole workspace, while Next.js
 * only reads env files next to the app. Variables already set in the environment
 * (Vercel, CI, Playwright) win over the file.
 */
function loadRootEnv(): void {
  const file = new URL('../../.env.local', import.meta.url);
  if (!existsSync(file)) return;
  for (const [name, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (process.env[name] === undefined && value !== undefined) process.env[name] = value;
  }
}

loadRootEnv();

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Shared packages ship TypeScript sources, compiled by the app.
  transpilePackages: ['@libresca/data', '@libresca/domain', '@libresca/i18n', '@libresca/metadata', '@libresca/tokens'],
  // Covers load straight from their sources: Vercel image optimisation has a small free quota.
  images: { unoptimized: true },
  // Cover photos reach a Server Action already resized (at most 1 MB, the bucket limit), plus form overhead.
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
};

export default withNextIntl(nextConfig);
