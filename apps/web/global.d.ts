import type { Locale, Messages } from '@libresca/i18n';

// Typed message keys and locales for next-intl.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
