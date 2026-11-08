import { describe, expect, it } from 'vitest';

import { extractYear, formatFromText, invertName, languageCode, matchKey, positiveInt, surnameKey } from './text';

describe('text helpers', () => {
  it('turns catalogue headings into display names', () => {
    expect(invertName('Levi, Primo <1919-1987>')).toBe('Primo Levi');
    expect(invertName('[Autore]  Tolkien, J. R. R.')).toBe('J. R. R. Tolkien');
    expect(invertName('McDuff, David, 1945-')).toBe('David McDuff');
    expect(invertName('Omero')).toBe('Omero');
  });

  it('compares names without accents, case or punctuation', () => {
    expect(matchKey('Fëdor  Dostoevskij!')).toBe('fedor dostoevskij');
    expect(surnameKey('J.R.R. Tolkien')).toBe('tolkien');
  });

  it('finds the year in free-text dates', () => {
    expect(extractYear('Milano : Bompiani, [2014]')).toBe(2014);
    expect(extractYear('March 2019')).toBe(2019);
    expect(extractYear('c2021')).toBe(2021);
    expect(extractYear('n.d.')).toBeUndefined();
    expect(extractYear('ISBN 978880466')).toBeUndefined();
  });

  it('maps language codes and names to ISO 639-1', () => {
    expect(languageCode('ita')).toBe('it');
    expect(languageCode('ITALIANO')).toBe('it');
    expect(languageCode('it')).toBe('it');
    expect(languageCode('hun')).toBe('hun');
    expect(languageCode('Lingua sconosciuta')).toBeUndefined();
  });

  it('reads edition formats from free text', () => {
    expect(formatFromText('Mass Market Paperback')).toBe('paperback');
    expect(formatFromText('Hardcover')).toBe('hardcover');
    expect(formatFromText('Kindle Edition')).toBe('ebook');
    expect(formatFromText('Audio CD')).toBe('audiobook');
    expect(formatFromText('Unknown binding')).toBeUndefined();
  });

  it('accepts only positive integers', () => {
    expect(positiveInt(312)).toBe(312);
    expect(positiveInt('42')).toBe(42);
    expect(positiveInt(0)).toBeUndefined();
    expect(positiveInt('12 p.')).toBeUndefined();
  });
});
