import { describe, expect, it } from 'vitest';
import { cleanIsbn, isValidIsbn10, isValidIsbn13, isbn10To13, toIsbn13 } from './isbn';

// Public ISBNs of published books, never data from personal exports.
const SIGNORE_ANELLI_10 = '8845292614';
const SIGNORE_ANELLI_13 = '9788845292613';

describe('cleanIsbn', () => {
  it('removes hyphens, spaces and the spreadsheet wrapper', () => {
    expect(cleanIsbn('978-88-452-9261-3')).toBe(SIGNORE_ANELLI_13);
    expect(cleanIsbn(' 978 88 452 9261 3 ')).toBe(SIGNORE_ANELLI_13);
    expect(cleanIsbn('="8845292614"')).toBe(SIGNORE_ANELLI_10);
  });

  it('uppercases the check character', () => {
    expect(cleanIsbn('0-8044-2957-x')).toBe('080442957X');
  });
});

describe('isValidIsbn10', () => {
  it('accepts valid codes, including X as check digit', () => {
    expect(isValidIsbn10(SIGNORE_ANELLI_10)).toBe(true);
    expect(isValidIsbn10('080442957X')).toBe(true);
  });

  it('rejects a wrong check digit or a misplaced X', () => {
    expect(isValidIsbn10('8845292615')).toBe(false);
    expect(isValidIsbn10('X845292614')).toBe(false);
  });
});

describe('isValidIsbn13', () => {
  it('accepts 978 and 979 prefixes', () => {
    expect(isValidIsbn13(SIGNORE_ANELLI_13)).toBe(true);
    expect(isValidIsbn13('9791032305690')).toBe(true);
  });

  it('rejects a wrong check digit and EAN codes that are not books', () => {
    expect(isValidIsbn13('9788845292614')).toBe(false);
    expect(isValidIsbn13('9771234567003')).toBe(false);
  });
});

describe('isbn10To13', () => {
  it('adds the 978 prefix and recomputes the check digit', () => {
    expect(isbn10To13(SIGNORE_ANELLI_10)).toBe(SIGNORE_ANELLI_13);
    expect(isbn10To13('080442957X')).toBe('9780804429573');
  });
});

describe('toIsbn13', () => {
  it('normalises any valid input to ISBN-13', () => {
    expect(toIsbn13('="8845292614"')).toBe(SIGNORE_ANELLI_13);
    expect(toIsbn13('978-88-452-9261-3')).toBe(SIGNORE_ANELLI_13);
  });

  it('returns null for invalid or incomplete input', () => {
    expect(toIsbn13('')).toBeNull();
    expect(toIsbn13('12345')).toBeNull();
    expect(toIsbn13('8845292615')).toBeNull();
  });
});
