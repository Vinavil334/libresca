import { describe, expect, it } from 'vitest';
import { defaultLocale, isLocale, loadMessages, locales } from './index';

function leaves(value: unknown, prefix = ''): [string, unknown][] {
  if (value === null || typeof value !== 'object') return [[prefix, value]];
  return Object.entries(value).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key));
}

describe('messages', () => {
  it('the default locale is one of the supported locales', () => {
    expect(isLocale(defaultLocale)).toBe(true);
    expect(isLocale('xx')).toBe(false);
  });

  it.each(locales)('%s has a non-empty string for every key', async (locale) => {
    for (const [key, value] of leaves(await loadMessages(locale))) {
      expect(typeof value, key).toBe('string');
      expect((value as string).trim(), key).not.toBe('');
    }
  });

  it.each(locales)('%s has exactly the keys of the reference language', async (locale) => {
    const reference = leaves(await loadMessages(defaultLocale)).map(([key]) => key);
    const keys = leaves(await loadMessages(locale)).map(([key]) => key);
    expect(keys.sort()).toEqual(reference.sort());
  });
});
