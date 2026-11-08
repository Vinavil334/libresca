import { describe, expect, it } from 'vitest';

import {
  foreignIsbn,
  googleBooksResponse,
  italianIsbn,
  openLibraryDetails,
  openLibraryWikipediaWork,
  openLibraryWork,
  sbnFull,
  sbnSearch,
} from './fixtures/responses';
import { googleBooksIsbnUrl, parseGoogleBooks } from './googlebooks';
import { openLibraryEdition, parseOpenLibrary } from './openlibrary';
import { isItalianIsbn, parseSbn, sbnBidFromSearch, sbnFullUrl } from './sbn';

function edition() {
  const found = openLibraryEdition(italianIsbn, openLibraryDetails);
  if (!found) throw new Error('fixture edition missing');
  return found;
}

describe('Open Library', () => {
  it('finds the edition only under the requested ISBN', () => {
    expect(openLibraryEdition(foreignIsbn, openLibraryDetails)).toBeNull();
    expect(openLibraryEdition(italianIsbn, {})).toBeNull();
    expect(openLibraryEdition(italianIsbn, 'not json')).toBeNull();
  });

  it('normalises the edition and its work', () => {
    const record = parseOpenLibrary(edition(), openLibraryWork);
    expect(record).toMatchObject({
      source: 'openlibrary',
      editionId: 'OL900M',
      workId: 'OL55W',
      goodreadsIds: ['123456'],
      title: 'Il bosco dei funghi',
      authors: [{ name: 'Ada Muskio', externalId: 'OL77A' }],
      publisher: 'Edizioni Sottobosco',
      publishedYear: 2019,
      firstPublishedYear: 1975,
      pageCount: 312,
      language: 'it',
      format: 'paperback',
      description: 'Una topina attraversa il bosco in cerca di spore.',
      coverId: '4242',
      contributors: [{ name: 'Bruno Felce', role: 'translator' }],
    });
    expect(record?.raw).toMatchObject({ key: '/books/OL900M' });
    expect(record?.workRaw).toMatchObject({ key: '/works/OL55W' });
  });

  it('drops descriptions copied from Wikipedia', () => {
    expect(parseOpenLibrary(edition(), openLibraryWikipediaWork)?.description).toBeUndefined();
  });

  it('works without the work record', () => {
    const record = parseOpenLibrary(edition(), null);
    expect(record?.description).toBeUndefined();
    expect(record?.workRaw).toBeUndefined();
  });

  it('does not guess a translator from unlabelled names', () => {
    const record = parseOpenLibrary(
      { ...edition(), by_statement: 'Ada Muskio', contributions: ['Felce, Bruno'] },
      null,
    );
    expect(record?.contributors).toEqual([]);
  });

  it('reads labelled contributors', () => {
    const record = parseOpenLibrary(
      {
        ...edition(),
        contributors: [
          { role: 'Illustrator', name: 'Spora, Chiara' },
          { role: 'Mystery', name: 'X' },
        ],
      },
      null,
    );
    expect(record?.contributors).toEqual([{ name: 'Chiara Spora', role: 'illustrator' }]);
  });
});

describe('Google Books', () => {
  it('builds the URL with the key, the country and the quota user', () => {
    const url = new URL(googleBooksIsbnUrl(italianIsbn, { apiKey: 'secret', quotaUser: 'u1' }));
    expect(url.searchParams.get('q')).toBe(`isbn:${italianIsbn}`);
    expect(url.searchParams.get('key')).toBe('secret');
    expect(url.searchParams.get('quotaUser')).toBe('u1');
    expect(url.searchParams.get('country')).toBe('IT');
  });

  it('keeps only the volume that carries the ISBN, in any form', () => {
    const record = parseGoogleBooks(italianIsbn, googleBooksResponse);
    expect(record).toMatchObject({
      source: 'googlebooks',
      editionId: 'vol_AbC-1',
      title: 'Il bosco dei funghi',
      authors: [{ name: 'Ada Muschio' }],
      publisher: 'Sottobosco',
      publishedYear: 2019,
      pageCount: 298,
      language: 'it',
      coverId: 'vol_AbC-1',
    });
  });

  it('never keeps the payload', () => {
    expect(parseGoogleBooks(italianIsbn, googleBooksResponse)).not.toHaveProperty('raw');
  });

  it('returns null when no volume carries the ISBN', () => {
    expect(parseGoogleBooks(foreignIsbn, googleBooksResponse)).toBeNull();
    expect(parseGoogleBooks(italianIsbn, { totalItems: 0 })).toBeNull();
  });
});

describe('SBN', () => {
  it('is asked only about Italian ISBNs', () => {
    expect(isItalianIsbn(italianIsbn)).toBe(true);
    expect(isItalianIsbn('9791254960016')).toBe(true);
    expect(isItalianIsbn(foreignIsbn)).toBe(false);
  });

  it('picks the first printed text from a search', () => {
    expect(sbnBidFromSearch(sbnSearch)).toBe('IT\\ICCU\\TO0\\1234567');
    expect(sbnBidFromSearch({ numFound: 0, briefRecords: [] })).toBeNull();
    expect(sbnFullUrl('IT\\ICCU\\TO0\\1')).toBe('https://opac.sbn.it/opacmobilegw/full.json?bid=IT%5CICCU%5CTO0%5C1');
  });

  it('normalises a full record', () => {
    expect(parseSbn(sbnFull)).toMatchObject({
      source: 'sbn',
      editionId: 'IT\\ICCU\\TO0\\1234567',
      title: 'Il bosco dei funghi',
      authors: [{ name: 'Ada Muschio' }],
      publisher: 'Edizioni Sottobosco',
      publishedYear: 2019,
      pageCount: 305,
      language: 'it',
      contributors: [
        { name: 'Bruno Felce', role: 'translator' },
        { name: 'Chiara Spora', role: 'illustrator' },
        { name: 'Dario Lichene', role: 'illustrator' },
        { name: 'Elena Muffa', role: 'other' },
      ],
    });
  });

  it('never stores the LibraryThing cover URL, holdings or citations', () => {
    const raw = parseSbn(sbnFull)?.raw;
    expect(raw).not.toHaveProperty('copertina');
    expect(raw).not.toHaveProperty('localizzazioni');
    expect(raw).not.toHaveProperty('citazioni');
    expect(raw).toMatchObject({ codiceIdentificativo: 'IT\\ICCU\\TO0\\1234567' });
  });

  it('falls back to the main heading when no name is marked as author', () => {
    expect(parseSbn({ ...sbnFull, nomi: [] })?.authors).toEqual([{ name: 'Ada Muschio' }]);
  });

  it('reads an editor and a copyright year', () => {
    const record = parseSbn({
      ...sbnFull,
      titolo: 'Fiabe del sottobosco / a cura di Bruno Felce',
      pubblicazione: 'Torino : Muffa, c2021',
    });
    expect(record).toMatchObject({
      title: 'Fiabe del sottobosco',
      publisher: 'Muffa',
      publishedYear: 2021,
      contributors: [{ name: 'Bruno Felce', role: 'editor' }],
    });
  });
});
