import { describe, expect, it } from 'vitest';

import { isbnFromBarcode, isbnFromBarcodes } from './barcode';

describe('isbnFromBarcode', () => {
  it('reads an ISBN barcode in the Bookland range', () => {
    expect(isbnFromBarcode('9788806219352')).toEqual({ kind: 'isbn', isbn13: '9788806219352' });
    expect(isbnFromBarcode('9791254960011')).toEqual({ kind: 'isbn', isbn13: '9791254960011' });
  });

  it('turns an ISBN-10 barcode into ISBN-13', () => {
    expect(isbnFromBarcode('8806219359')).toEqual({ kind: 'isbn', isbn13: '9788806219352' });
  });

  it('refuses codes that are not ISBNs', () => {
    expect(isbnFromBarcode('51200')).toEqual({ kind: 'not_isbn' }); // price add-on
    expect(isbnFromBarcode('036000291452')).toEqual({ kind: 'not_isbn' }); // UPC-A
    expect(isbnFromBarcode('9771234567003')).toEqual({ kind: 'not_isbn' }); // ISSN, a magazine
    expect(isbnFromBarcode('9788806219353')).toEqual({ kind: 'not_isbn' }); // misread check digit
    expect(isbnFromBarcode('https://example.com')).toEqual({ kind: 'not_isbn' });
  });
});

describe('isbnFromBarcodes', () => {
  it('prefers the ISBN when a frame also shows the price add-on', () => {
    expect(isbnFromBarcodes(['51200', '9788806219352'])).toEqual({ kind: 'isbn', isbn13: '9788806219352' });
  });

  it('tells nothing seen apart from only other codes seen', () => {
    expect(isbnFromBarcodes([])).toBeNull();
    expect(isbnFromBarcodes(['51200'])).toEqual({ kind: 'not_isbn' });
  });
});
