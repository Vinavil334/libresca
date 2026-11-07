import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { fileURLToPath } from 'node:url';

// One .env.local at the repository root serves the whole workspace.
// Variables already set in the environment (Vercel, CI, Playwright) win over the file.
loadEnvConfig(fileURLToPath(new URL('../..', import.meta.url)));

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Shared packages ship TypeScript sources, compiled by the app.
  transpilePackages: ['@libresca/data', '@libresca/domain', '@libresca/i18n', '@libresca/tokens'],
  // Covers load straight from their sources: Vercel image optimisation has a small free quota.
  images: { unoptimized: true },
};

export default withNextIntl(nextConfig);
