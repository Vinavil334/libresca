import { describe, expect, it } from 'vitest';

import { identifiersOf, matchCatalog } from './catalog-match';
import {
  googleBooksSearch,
  openLibrarySearch,
  searchIsbnA,
  searchIsbnB,
  searchIsbnGoogleOnly,
} from './fixtures/responses';
import type { HttpClient, HttpResult } from './http';
import {
  googleBooksSearchUrl,
  maxCandidates,
  mergeSearchResults,
  openLibrarySearchUrl,
  parseGoogleBooksSearch,
  parseOpenLibrarySearch,
  searchBooks,
} from './search';

const ok = (data: unknown): HttpResult => ({ status: 'ok', data });

function fakeHttp(routes: Record<string, HttpResult>) {
  const asked: string[] = [];
  const http: HttpClient = {
    async getJson(url) {
      asked.push(url);
      const match = Object.keys(routes).find((prefix) => url.startsWith(prefix));
      return match ? (routes[match] as HttpResult) : { status: 'unavailable' };
    },
  };
  return { http, asked };
}

describe('search URLs', () => {
  it('asks Open Library for works with their best Italian edition', () => {
    const url = new URL(openLibrarySearchUrl('la topina'));
    expect(url.pathname).toBe('/search.json');
    expect(url.searchParams.get('q')).toBe('la topina');
    expect(url.searchParams.get('lang')).toBe('it');
    expect(url.searchParams.get('fields')).toContain('editions.isbn');
  });

  it('asks Google Books for printed books only, with key and quota user', () => {
    const url = new URL(googleBooksSearchUrl('la topina', { apiKey: 'secret', quotaUser: 'u1' }));
    expect(url.searchParams.get('q')).toBe('la topina');
    expect(url.searchParams.get('printType')).toBe('books');
    expect(url.searchParams.get('country')).toBe('IT');
    expect(url.searchParams.get('key')).toBe('secret');
    expect(url.searchParams.get('quotaUser')).toBe('u1');
  });
});

describe('parseOpenLibrarySearch', () => {
  it('reads works, their ISBNs and the Italian edition', () => {
    const [first, second, ...rest] = parseOpenLibrarySearch(openLibrarySearch);
    expect(rest).toEqual([]);
    expect(first).toMatchObject({
      key: 'openlibrary:OL15W',
      title: 'La topina rampante',
      authors: ['Ada Muskio'],
      firstPublishedYear: 1957,
      openLibraryWorkId: 'OL15W',
      editionCount: 3,
      cover: { source: 'openlibrary', id: '1159' },
      editions: [
        {
          source: 'openlibrary',
          editionId: 'OL165M',
          isbn13: searchIsbnA,
          publisher: 'Edizioni Sottobosco',
          publishedYear: 1971,
          language: 'it',
          cover: { id: '1076' },
        },
      ],
      sources: ['openlibrary'],
    });
    expect(first?.isbns.sort()).toEqual([searchIsbnA, searchIsbnB].sort());
    expect(second).toMatchObject({ title: 'Il funghetto è nel bosco', cover: undefined, isbns: [] });
    expect(second?.title).toHaveLength('Il funghetto è nel bosco'.length);
  });

  it('survives an unexpected payload', () => {
    expect(parseOpenLibrarySearch('error')).toEqual([]);
    expect(parseOpenLibrarySearch({ docs: [null, 3] })).toEqual([]);
  });
});

describe('parseGoogleBooksSearch', () => {
  it('reads volumes with their ISBN and skips those without a title', () => {
    const volumes = parseGoogleBooksSearch(googleBooksSearch);
    expect(volumes.map((volume) => volume.edition.editionId)).toEqual(['vol_Top-B', 'vol_Spora-1', 'vol_Spora-2']);
    expect(volumes[0]).toMatchObject({
      title: 'La topina rampante',
      authors: ['Ada Muschio'],
      edition: { isbn13: searchIsbnB, publisher: 'Muffa', publishedYear: 2010, cover: { source: 'googlebooks' } },
    });
    expect(volumes[2]?.edition.isbn13).toBeUndefined();
  });
});

describe('mergeSearchResults', () => {
  const merged = () =>
    mergeSearchResults(parseOpenLibrarySearch(openLibrarySearch), parseGoogleBooksSearch(googleBooksSearch));

  it('attaches a Google Books volume to the Open Library work that lists its ISBN', () => {
    const [topina] = merged();
    expect(topina?.sources).toEqual(['openlibrary', 'googlebooks']);
    expect(topina?.editions.map((edition) => edition.isbn13)).toEqual([searchIsbnA, searchIsbnB]);
  });

  it('groups the other volumes by title and first author, keeping relevance order', () => {
    const results = merged();
    expect(results.map((hit) => hit.key)).toEqual([
      'openlibrary:OL15W',
      'openlibrary:OL99W',
      'googlebooks:vol_Spora-1',
    ]);
    const spore = results[2];
    expect(spore?.openLibraryWorkId).toBeUndefined();
    expect(spore?.editions.map((edition) => edition.editionId)).toEqual(['vol_Spora-1', 'vol_Spora-2']);
    expect(spore?.isbns).toEqual([searchIsbnGoogleOnly]);
  });

  it('never joins a volume to an Open Library work by title alone', () => {
    const volume = parseGoogleBooksSearch(googleBooksSearch)[0];
    if (!volume) throw new Error('fixture missing');
    const stranger = { ...volume, edition: { ...volume.edition, isbn13: searchIsbnGoogleOnly } };
    const results = mergeSearchResults(parseOpenLibrarySearch(openLibrarySearch), [stranger]);
    expect(results.map((hit) => hit.key)).toContain('googlebooks:vol_Top-B');
  });

  it('does not change the Open Library hits it was given', () => {
    const openLibrary = parseOpenLibrarySearch(openLibrarySearch);
    mergeSearchResults(openLibrary, parseGoogleBooksSearch(googleBooksSearch));
    expect(openLibrary[0]?.editions).toHaveLength(1);
  });

  it('returns at most maxCandidates works', () => {
    const many = Array.from({ length: maxCandidates + 5 }, (_, index) => ({
      title: `Libro ${index}`,
      authors: [`Autrice ${index}`],
      edition: { source: 'googlebooks' as const, editionId: `v${index}` },
    }));
    expect(mergeSearchResults([], many)).toHaveLength(maxCandidates);
  });
});

describe('searchBooks', () => {
  it('asks both sources in parallel and merges them', async () => {
    const { http, asked } = fakeHttp({
      'https://openlibrary.org/search.json': ok(openLibrarySearch),
      'https://www.googleapis.com/books/v1/volumes': ok(googleBooksSearch),
    });
    const result = await searchBooks('la topina', { http, googleBooksKey: 'k', quotaUser: 'u1' });
    expect(asked).toHaveLength(2);
    expect(result.sources).toEqual({ openlibrary: 'found', googlebooks: 'found' });
    expect(result.hits).toHaveLength(3);
  });

  it('skips Google Books without a key and survives a failing source', async () => {
    const { http, asked } = fakeHttp({});
    const result = await searchBooks('la topina', { http });
    expect(asked).toHaveLength(1);
    expect(result).toEqual({ sources: { openlibrary: 'unavailable', googlebooks: 'skipped' }, hits: [] });
  });

  it('reports a source that answered with nothing', async () => {
    const { http } = fakeHttp({
      'https://openlibrary.org/search.json': ok({ docs: [] }),
      'https://www.googleapis.com/books/v1/volumes': ok({ totalItems: 0 }),
    });
    const result = await searchBooks('zzz', { http, googleBooksKey: 'k' });
    expect(result.sources).toEqual({ openlibrary: 'not_found', googlebooks: 'not_found' });
  });
});

describe('matchCatalog', () => {
  const hits = () =>
    mergeSearchResults(parseOpenLibrarySearch(openLibrarySearch), parseGoogleBooksSearch(googleBooksSearch));
  const none = { openLibraryWorks: {}, isbns: {} };

  it('lists the identifiers to look up', () => {
    const ids = identifiersOf(hits());
    expect(ids.openLibraryWorkIds).toEqual(['OL15W', 'OL99W']);
    expect(ids.isbns).toEqual(expect.arrayContaining([searchIsbnA, searchIsbnB, searchIsbnGoogleOnly]));
  });

  it('is certain through an Open Library work id or any ISBN of the work', () => {
    const byWork = matchCatalog(hits(), [], { openLibraryWorks: { OL15W: 'w1' }, isbns: {} });
    expect(byWork[0]?.catalogMatch).toEqual({ workId: 'w1', basis: 'identifier' });

    const byIsbn = matchCatalog(hits(), [], { openLibraryWorks: {}, isbns: { [searchIsbnGoogleOnly]: 'w2' } });
    expect(byIsbn[2]?.catalogMatch).toEqual({ workId: 'w2', basis: 'identifier' });
  });

  it('suggests a work with the same title and an author in common, accents and case aside', () => {
    const catalog = [
      { id: 'w3', title: 'SPORE DI CITTA', authorNames: ['C. Spora'] },
      { id: 'w4', title: 'Il funghetto è nel bosco', authorNames: ['Altra Persona'] },
    ];
    const results = matchCatalog(hits(), catalog, none);
    expect(results[2]?.catalogMatch).toEqual({ workId: 'w3', basis: 'title_author' });
    expect(results[1]?.catalogMatch).toBeUndefined();
  });

  it('drops the ISBN lists from what goes to the client', () => {
    for (const candidate of matchCatalog(hits(), [], none)) expect(candidate).not.toHaveProperty('isbns');
  });
});
