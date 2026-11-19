import { describe, expect, it } from 'vitest';

import {
  foreignIsbn,
  googleBooksResponse,
  italianIsbn,
  openLibraryDetails,
  openLibraryWork,
  sbnFull,
  sbnSearch,
} from './fixtures/responses';
import type { HttpClient, HttpResult } from './http';
import { lookupCover } from './cover-lookup';
import { lookupIsbn } from './lookup';

/** Answers by URL prefix; anything else is a 404. Records every URL asked. */
function fakeHttp(routes: Record<string, HttpResult>) {
  const asked: string[] = [];
  const http: HttpClient = {
    async getJson(url) {
      asked.push(url);
      const match = Object.keys(routes).find((prefix) => url.startsWith(prefix));
      return match ? (routes[match] as HttpResult) : { status: 'not_found' };
    },
  };
  return { http, asked };
}

const ok = (data: unknown): HttpResult => ({ status: 'ok', data });

const allSources = {
  'https://openlibrary.org/api/books': ok(openLibraryDetails),
  'https://openlibrary.org/works/OL55W': ok(openLibraryWork),
  'https://www.googleapis.com/books/v1/volumes': ok(googleBooksResponse),
  'https://opac.sbn.it/opacmobilegw/search.json': ok(sbnSearch),
  'https://opac.sbn.it/opacmobilegw/full.json': ok(sbnFull),
};

describe('lookupIsbn', () => {
  it('returns null for an invalid ISBN without asking anyone', async () => {
    const { http, asked } = fakeHttp(allSources);
    expect(await lookupIsbn('123', { http, googleBooksKey: 'k' })).toBeNull();
    expect(asked).toEqual([]);
  });

  it('asks the three sources for an Italian ISBN in any form and merges them', async () => {
    const { http, asked } = fakeHttp(allSources);
    const result = await lookupIsbn('88-04-66823-7', { http, googleBooksKey: 'k', quotaUser: 'u1' });

    expect(result?.isbn13).toBe(italianIsbn);
    expect(result?.sources).toEqual({ openlibrary: 'found', googlebooks: 'found', sbn: 'found' });
    expect(result?.proposal?.title).toEqual({ value: 'Il bosco dei funghi', source: 'sbn' });
    expect(asked).toHaveLength(5);
    expect(asked.find((url) => url.includes('googleapis'))).toContain('quotaUser=u1');
  });

  it('skips SBN for a foreign ISBN and Google Books without a key', async () => {
    const { http, asked } = fakeHttp({});
    const result = await lookupIsbn(foreignIsbn, { http });
    expect(result).toEqual({
      isbn13: foreignIsbn,
      sources: { openlibrary: 'not_found', googlebooks: 'skipped', sbn: 'skipped' },
      proposal: null,
    });
    expect(asked).toHaveLength(1);
  });

  it('survives a failing source', async () => {
    const { http } = fakeHttp({
      ...allSources,
      'https://www.googleapis.com/books/v1/volumes': { status: 'unavailable' },
      'https://opac.sbn.it/opacmobilegw/full.json': { status: 'unavailable' },
    });
    const result = await lookupIsbn(italianIsbn, { http, googleBooksKey: 'k' });
    expect(result?.sources).toEqual({ openlibrary: 'found', googlebooks: 'unavailable', sbn: 'unavailable' });
    expect(result?.proposal?.title?.source).toBe('openlibrary');
  });

  it('keeps the Open Library edition when its work cannot be read', async () => {
    const { http } = fakeHttp({
      'https://openlibrary.org/api/books': ok(openLibraryDetails),
      'https://openlibrary.org/works/OL55W': { status: 'unavailable' },
    });
    const result = await lookupIsbn(italianIsbn, { http });
    expect(result?.sources.openlibrary).toBe('found');
    expect(result?.proposal?.description).toBeUndefined();
  });

  it('treats an empty answer as not found', async () => {
    const { http } = fakeHttp({
      'https://openlibrary.org/api/books': ok({}),
      'https://www.googleapis.com/books/v1/volumes': ok({ totalItems: 0 }),
      'https://opac.sbn.it/opacmobilegw/search.json': ok({ numFound: 0, briefRecords: [] }),
    });
    const result = await lookupIsbn(italianIsbn, { http, googleBooksKey: 'k' });
    expect(result?.sources).toEqual({ openlibrary: 'not_found', googlebooks: 'not_found', sbn: 'not_found' });
    expect(result?.proposal).toBeNull();
  });
});

describe('lookupIsbn for an import (googleOnlyForGaps)', () => {
  const googleAsked = (asked: string[]) => asked.some((url) => url.includes('googleapis'));
  const withoutOpenLibraryCover = {
    [`ISBN:${italianIsbn}`]: {
      ...openLibraryDetails[`ISBN:${italianIsbn}`],
      details: { ...openLibraryDetails[`ISBN:${italianIsbn}`].details, covers: [] },
    },
  };

  it('leaves Google Books out when the open sources already have a cover', async () => {
    const { http, asked } = fakeHttp(allSources);
    const result = await lookupIsbn(italianIsbn, { http, googleBooksKey: 'k', googleOnlyForGaps: true });
    expect(googleAsked(asked)).toBe(false);
    expect(result?.sources.googlebooks).toBe('skipped');
    expect(result?.proposal?.cover?.source).toBe('openlibrary');
  });

  it('asks Google Books for the cover when only SBN knows the book', async () => {
    const { http, asked } = fakeHttp({
      'https://www.googleapis.com/books/v1/volumes': ok(googleBooksResponse),
      'https://opac.sbn.it/opacmobilegw/search.json': ok(sbnSearch),
      'https://opac.sbn.it/opacmobilegw/full.json': ok(sbnFull),
    });
    const result = await lookupIsbn(italianIsbn, { http, googleBooksKey: 'k', googleOnlyForGaps: true });
    expect(googleAsked(asked)).toBe(true);
    expect(result?.sources).toEqual({ openlibrary: 'not_found', googlebooks: 'found', sbn: 'found' });
    expect(result?.proposal?.title?.source).toBe('sbn');
    expect(result?.proposal?.cover?.source).toBe('googlebooks');
  });

  it('asks Google Books when Open Library has the edition but no cover', async () => {
    const { http, asked } = fakeHttp({
      ...allSources,
      'https://openlibrary.org/api/books': ok(withoutOpenLibraryCover),
    });
    const result = await lookupIsbn(italianIsbn, { http, googleBooksKey: 'k', googleOnlyForGaps: true });
    expect(googleAsked(asked)).toBe(true);
    expect(result?.proposal?.cover?.source).toBe('googlebooks');
  });

  it('asks Google Books when the open sources found nothing', async () => {
    const { http, asked } = fakeHttp({ 'https://www.googleapis.com/books/v1/volumes': ok(googleBooksResponse) });
    const result = await lookupIsbn(italianIsbn, { http, googleBooksKey: 'k', googleOnlyForGaps: true });
    expect(googleAsked(asked)).toBe(true);
    expect(result?.sources.googlebooks).toBe('found');
  });
});

describe('lookupCover', () => {
  it('finds the Google Books cover of a book SBN knows, and counts the call', async () => {
    const { http } = fakeHttp({
      'https://www.googleapis.com/books/v1/volumes': ok(googleBooksResponse),
      'https://opac.sbn.it/opacmobilegw/search.json': ok(sbnSearch),
      'https://opac.sbn.it/opacmobilegw/full.json': ok(sbnFull),
    });
    const result = await lookupCover(italianIsbn, true, { http, googleBooksKey: 'k' });
    expect(result.usedGoogle).toBe(true);
    expect(result.cover?.source).toBe('googlebooks');
  });

  it('does not ask Google Books when it is not allowed', async () => {
    const { http, asked } = fakeHttp({
      'https://www.googleapis.com/books/v1/volumes': ok(googleBooksResponse),
      'https://opac.sbn.it/opacmobilegw/search.json': ok(sbnSearch),
      'https://opac.sbn.it/opacmobilegw/full.json': ok(sbnFull),
    });
    expect(await lookupCover(italianIsbn, false, { http, googleBooksKey: 'k' })).toEqual({
      cover: null,
      usedGoogle: false,
    });
    expect(asked.some((url) => url.includes('googleapis'))).toBe(false);
  });
});
