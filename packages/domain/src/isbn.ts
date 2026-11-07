/**
 * ISBN normalisation. Libresca always stores the ISBN-13 form.
 *
 * Accepts what users and exports actually contain: spaces, hyphens, a lowercase x,
 * and the spreadsheet wrapper that Goodreads adds (="8845292614").
 */

/** Strips everything that is not a digit or a check character X. */
export function cleanIsbn(raw: string): string {
  return raw
    .replace(/^\s*="?|"\s*$/g, '')
    .replace(/[^0-9Xx]/g, '')
    .toUpperCase();
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = [...isbn].reduce((total, char, i) => total + (10 - i) * (char === 'X' ? 10 : Number(char)), 0);
  return sum % 11 === 0;
}

function isbn13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  return isbn13CheckDigit(isbn.slice(0, 12)) === Number(isbn[12]);
}

/** Converts a valid ISBN-10 to its ISBN-13 form with the 978 prefix. */
export function isbn10To13(isbn10: string): string {
  const first12 = '978' + isbn10.slice(0, 9);
  return first12 + String(isbn13CheckDigit(first12));
}

/**
 * Returns the ISBN-13 form of any valid ISBN-10 or ISBN-13, or null.
 * A barcode that is not an ISBN (for example an EAN starting with 977 or 590) returns null.
 */
export function toIsbn13(raw: string): string | null {
  const isbn = cleanIsbn(raw);
  if (isbn.length === 13) return isValidIsbn13(isbn) ? isbn : null;
  if (isbn.length === 10) return isValidIsbn10(isbn) ? isbn10To13(isbn) : null;
  return null;
}
