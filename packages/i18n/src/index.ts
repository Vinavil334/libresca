import type it from '../messages/it.json';

/** Languages the app can speak. Only Italian for now; more arrive in F5.11. */
export const locales = ['it'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'it';

/** Italian is the reference: every other language must have the same keys. */
export type Messages = typeof it;

const loaders: Record<Locale, () => Promise<{ default: Messages }>> = {
  it: () => import('../messages/it.json'),
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  return (await loaders[locale]()).default;
}
