import { Bricolage_Grotesque, Fraunces } from 'next/font/google';

// The two families of the Sottobosco design system (docs/design/DESIGN_SYSTEM.md).
// next/font downloads them at build time and serves them from our domain: browsers never contact Google.
// The `variable` names override --font-display and --font-body from tokens.css on <body>,
// so every .type-* class and font-* utility picks up the self-hosted files.

export const fontDisplay = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display',
});

export const fontBody = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz', 'wdth'],
  display: 'swap',
  variable: '--font-body',
});
