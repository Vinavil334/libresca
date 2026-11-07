import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Shared packages ship TypeScript sources, compiled by the app.
  transpilePackages: ['@libresca/data', '@libresca/domain', '@libresca/i18n', '@libresca/tokens'],
  // Covers load straight from their sources: Vercel image optimisation has a small free quota.
  images: { unoptimized: true },
};

export default withNextIntl(nextConfig);
