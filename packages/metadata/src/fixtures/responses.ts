/**
 * Source responses with the real structure (checked against live answers in F1.2a)
 * and invented books and people. Never paste real export data here.
 */

/** A valid Italian ISBN-13 and its ISBN-10 form. */
export const italianIsbn = '9788804668237';
export const italianIsbn10 = '8804668237';
/** A valid non-Italian ISBN-13. */
export const foreignIsbn = '9780140449136';

export const openLibraryDetails = {
  [`ISBN:${italianIsbn}`]: {
    bib_key: `ISBN:${italianIsbn}`,
    info_url: 'http://openlibrary.org/books/OL900M/Il_bosco_dei_funghi',
    preview: 'noview',
    thumbnail_url: 'https://covers.openlibrary.org/b/id/4242-S.jpg',
    details: {
      type: { key: '/type/edition' },
      key: '/books/OL900M',
      title: 'Il bosco dei funghi',
      authors: [{ key: '/authors/OL77A', name: 'Ada Muskio' }],
      publishers: ['Edizioni Sottobosco'],
      publish_date: 'March 2019',
      number_of_pages: 312,
      physical_format: 'Mass Market Paperback',
      languages: [{ key: '/languages/ita' }],
      covers: [-1, 4242],
      works: [{ key: '/works/OL55W' }],
      identifiers: { goodreads: ['123456'], librarything: ['987'] },
      by_statement: 'Ada Muskio ; traduzione di Bruno Felce.',
      contributions: ['Felce, Bruno, 1950-'],
      isbn_13: [italianIsbn],
    },
  },
};

export const openLibraryWork = {
  key: '/works/OL55W',
  title: 'The Mushroom Wood',
  description: { type: '/type/text', value: 'Una topina attraversa il bosco in cerca di spore.' },
  first_publish_date: '1975',
  authors: [{ author: { key: '/authors/OL77A' }, type: { key: '/type/author_role' } }],
};

export const openLibraryWikipediaWork = {
  ...openLibraryWork,
  description: 'From [wikipedia](https://en.wikipedia.org/wiki/Example): a novel about mushrooms.',
};

export const googleBooksResponse = {
  kind: 'books#volumes',
  totalItems: 2,
  items: [
    {
      id: 'nearMatch1',
      volumeInfo: {
        title: 'Un altro libro',
        industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788806219352' }],
      },
    },
    {
      id: 'vol_AbC-1',
      volumeInfo: {
        title: 'Il bosco dei funghi',
        authors: ['Ada Muschio'],
        publisher: 'Sottobosco',
        publishedDate: '2019-03-01',
        description: 'Descrizione di Google Books, da mostrare ma non salvare.',
        industryIdentifiers: [
          { type: 'ISBN_10', identifier: italianIsbn10 },
          { type: 'OTHER', identifier: 'UOM:39015' },
        ],
        pageCount: 298,
        language: 'it',
        imageLinks: { smallThumbnail: 'http://books.google.com/x', thumbnail: 'http://books.google.com/y' },
      },
    },
  ],
};

export const sbnSearch = {
  numFound: 2,
  briefRecords: [
    { codiceIdentificativo: 'IT\\ICCU\\XX0\\0000001', tipo: 'Registrazione sonora musicale' },
    {
      codiceIdentificativo: 'IT\\ICCU\\TO0\\1234567',
      isbn: italianIsbn,
      autorePrincipale: 'Muschio, Ada',
      titolo: 'Il bosco dei funghi : romanzo / Ada Muschio',
      tipo: 'Testo a stampa',
    },
  ],
};

export const sbnFull = {
  codiceIdentificativo: 'IT\\ICCU\\TO0\\1234567',
  autorePrincipale: 'Muschio, Ada <1930-2001>',
  copertina: 'http://covers.librarything.com/devkey/0000/medium/isbn/9788804668237',
  titolo:
    'Il bosco dei funghi : romanzo / Ada Muschio ; traduzione di Bruno Felce ; illustrazioni di Chiara Spora e Dario Lichene ; postfazione di Elena Muffa',
  descrizioneFisica: 'xii, 305 p. : ill. ; 21 cm',
  pubblicazione: 'Milano : Edizioni Sottobosco, [2019]',
  livello: 'Monografia',
  tipo: 'Testo a stampa',
  numeri: [`[ISBN]  ${italianIsbn}`],
  note: [],
  nomi: ['[Autore]  Muschio, Ada <1930-2001>', 'Felce, Bruno', 'Spora, Chiara', 'Lichene, Dario', 'Muffa, Elena'],
  linguaPubblicazione: 'ITALIANO',
  paesePubblicazione: 'ITALIA',
  localizzazioni: [{ biblioteca: 'Biblioteca inventata' }],
  citazioni: [{ standard: 'mla', valore: 'Muschio, Ada. Il bosco dei funghi.' }],
};
