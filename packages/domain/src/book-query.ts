import { searchQuery } from './catalog';
import { toIsbn13 } from './isbn';

/**
 * What the single search box of the add screen was given:
 * - `isbn`: a valid ISBN-10 or ISBN-13, in any form, to look up directly;
 * - `invalid_isbn`: digits shaped like an ISBN whose check digit is wrong, worth telling apart
 *   from a title so the user checks the digits;
 * - `text`: anything else long enough for a title or author search.
 */
export type BookQuery = { kind: 'isbn'; isbn13: string } | { kind: 'invalid_isbn' } | { kind: 'text'; query: string };

/** Only digits, an optional final X, and the separators people type or paste. */
const isbnShape = /^(?:isbn[\s:-]*)?[\d\s-]{9,}[\dx]$/i;

export function parseBookQuery(input: string | null | undefined): BookQuery | null {
  const value = (input ?? '').trim();
  if (isbnShape.test(value)) {
    const digits = value.replace(/^isbn/i, '').replace(/[^\dx]/gi, '');
    if (digits.length === 10 || digits.length === 13) {
      const isbn13 = toIsbn13(digits);
      return isbn13 ? { kind: 'isbn', isbn13 } : { kind: 'invalid_isbn' };
    }
  }
  const query = searchQuery(value);
  return query ? { kind: 'text', query } : null;
}
