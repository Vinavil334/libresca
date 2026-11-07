import { defaultLocale, loadMessages } from '@libresca/i18n';
import { getRequestConfig } from 'next-intl/server';

// No locale prefix in the URLs (ADR-0005). The locale will come from the user's profile
// once accounts exist; until then everyone gets the default language.
export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return { locale, messages: await loadMessages(locale) };
});
