import { describe, expect, it } from 'vitest';

import { parseBookQuery } from './book-query';
import { coverTone, coverTones } from './covers';

describe('parseBookQuery', () => {
  it('recognises an ISBN in any form', () => {
    expect(parseBookQuery('978-88-06-21935-2')).toEqual({ kind: 'isbn', isbn13: '9788806219352' });
    expect(parseBookQuery(' 8806219359 ')).toEqual({ kind: 'isbn', isbn13: '9788806219352' });
    expect(parseBookQuery('ISBN: 88 06 21935 9')).toEqual({ kind: 'isbn', isbn13: '9788806219352' });
    expect(parseBookQuery('080442957x')).toEqual({ kind: 'isbn', isbn13: '9780804429573' });
  });

  it('tells a mistyped ISBN apart from a title', () => {
    expect(parseBookQuery('9788806219353')).toEqual({ kind: 'invalid_isbn' });
    expect(parseBookQuery('88-06-21935-0')).toEqual({ kind: 'invalid_isbn' });
  });

  it('treats everything else as text', () => {
    expect(parseBookQuery('  il barone   rampante ')).toEqual({ kind: 'text', query: 'il barone rampante' });
    expect(parseBookQuery('1984')).toEqual({ kind: 'text', query: '1984' });
    expect(parseBookQuery('Fahrenheit 451')).toEqual({ kind: 'text', query: 'Fahrenheit 451' });
    expect(parseBookQuery('123456789012')).toEqual({ kind: 'text', query: '123456789012' });
  });

  it('returns null for an empty or one-letter query', () => {
    expect(parseBookQuery(undefined)).toBeNull();
    expect(parseBookQuery('  ')).toBeNull();
    expect(parseBookQuery('a')).toBeNull();
  });
});

describe('coverTone', () => {
  it('is stable and ignores case and accent encoding', () => {
    expect(coverTone('Il bosco')).toBe(coverTone('il BOSCO'));
    expect(coverTone('Città')).toBe(coverTone('Città'));
    expect(coverTones).toContain(coverTone(''));
  });

  it('spreads titles over every tone', () => {
    const tones = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map(coverTone));
    expect(tones.size).toBe(coverTones.length);
  });
});
