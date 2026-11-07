import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { tokenColor } from '@/lib/theme-colors';

import { fontBody, fontDisplay } from './fonts';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return {
    title: t('title'),
    description: t('description'),
    // iOS ignores most of the manifest: these make "Add to Home Screen" open full screen.
    appleWebApp: { capable: true, title: t('title'), statusBarStyle: 'default' },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // The browser bar takes the page background, by day and by night.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: tokenColor('color-surface', 'giorno') },
    { media: '(prefers-color-scheme: dark)', color: tokenColor('color-surface', 'notte') },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className={`${fontDisplay.variable} ${fontBody.variable}`}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
