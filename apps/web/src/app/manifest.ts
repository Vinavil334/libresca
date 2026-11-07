import { defaultLocale, loadMessages } from '@libresca/i18n';
import type { MetadataRoute } from 'next';

import { tokenColor } from '@/lib/theme-colors';

/** Web app manifest: installs Libresca on the phone's home screen, opening full screen. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { metadata } = await loadMessages(defaultLocale);
  const surface = tokenColor('color-surface', 'giorno');

  return {
    id: '/',
    name: metadata.title,
    short_name: metadata.title,
    description: metadata.description,
    lang: defaultLocale,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: surface,
    theme_color: surface,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
