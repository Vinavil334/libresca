import { isValidIsbn10, isValidIsbn13, isbn10To13 } from './isbn';

/**
 * What a scanned barcode means for adding a book:
 * - `isbn`: an EAN-13 in the Bookland range (978, 979) with a valid check digit, or an
 *   ISBN-10 printed as a barcode on some old books;
 * - `not_isbn`: anything else on a cover, such as the 5-digit price add-on, a UPC on an
 *   American paperback, an ISSN (977) on a magazine or a shop label.
 */
export type ScannedCode = { kind: 'isbn'; isbn13: string } | { kind: 'not_isbn' };

/** Barcode formats worth asking a detector for: books carry EAN-13, rarely the others. */
export const bookBarcodeFormats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] as const;

export function isbnFromBarcode(rawValue: string): ScannedCode {
  const digits = rawValue.replace(/[\s-]/g, '').toUpperCase();
  if (/^97[89]\d{10}$/.test(digits) && isValidIsbn13(digits)) return { kind: 'isbn', isbn13: digits };
  if (isValidIsbn10(digits)) return { kind: 'isbn', isbn13: isbn10To13(digits) };
  return { kind: 'not_isbn' };
}

/** The first ISBN among the codes a detector found in one frame, or whether only other codes were seen. */
export function isbnFromBarcodes(rawValues: string[]): ScannedCode | null {
  if (rawValues.length === 0) return null;
  for (const value of rawValues) {
    const code = isbnFromBarcode(value);
    if (code.kind === 'isbn') return code;
  }
  return { kind: 'not_isbn' };
}
