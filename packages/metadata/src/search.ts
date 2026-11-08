import { coverUrl, toIsbn13 } from '@libresca/domain';

import type { CachePolicy, HttpClient } from './http';
import { asArray, asObject, asStrings, keyId } from './json';
import { extractYear, languageCode, matchKey, positiveInt, surnameKey, text } from './text';
import type { SourceStatus } from './types';

/** The sources asked by a title search: SBN is kept for ISBN lookups, where its data matter most. */
export type SearchSource = 'openlibrary' | 'googlebooks';

export interface CandidateCover {
  source: SearchSource;
  id: string;
  url: string;
}

/** An edition found by a search: enough to recognise it and to look it up by ISBN. */
export interface CandidateEdition {
  source: SearchSource;
  /** Open Library edition key or Google Books volume id. */
  editionId: string;
  /** Missing for editions without an ISBN: the client offers manual entry instead. */
  isbn13?: string;
  title?: string;
  publisher?: string;
  publishedYear?: number;
  language?: string;
  cover?: CandidateCover;
}

/**
 * A work found by the sources, with the editions this search turned up. Choosing an
 * edition with an ISBN leads to `GET /api/v1/books/isbn/{isbn}` for the full card.
 */
export interface WorkCandidate {
  /** Unique within a response, for list keys: `openlibrary:OL15W`, `googlebooks:<volume id>`. */
  key: string;
  title: string;
  authors: string[];
  firstPublishedYear?: number;
  /** The Open Library work key: the only work-level identifier the sources give. */
  openLibraryWorkId?: string;
  /** Editions Open Library knows for the work; `editions` holds only those found here. */
  editionCount?: number;
  cover?: CandidateCover;
  editions: CandidateEdition[];
  sources: SearchSource[];
}

/** A candidate with every ISBN known for its work, used to recognise it in the catalog. */
export interface SearchHit extends WorkCandidate {
  isbns: string[];
}

export interface BookSearch {
  sources: Record<SearchSource, SourceStatus>;
  hits: SearchHit[];
}

const openLibraryLimit = 10;
const googleBooksLimit = 20;
/** Most candidates returned by one search. */
export const maxCandidates = 20;

const openLibraryFields = [
  'key',
  'title',
  'author_name',
  'first_publish_year',
  'edition_count',
  'cover_i',
  'isbn',
  'editions',
  'editions.key',
  'editions.title',
  'editions.isbn',
  'editions.publisher',
  'editions.publish_year',
  'editions.language',
  'editions.cover_i',
].join(',');

/** `lang=it` makes Open Library put its best Italian edition of each work under `editions`. */
export function openLibrarySearchUrl(query: string): string {
  const params = new URLSearchParams({
    q: query,
    fields: openLibraryFields,
    limit: String(openLibraryLimit),
    lang: 'it',
  });
  return `https://openlibrary.org/search.json?${params.toString()}`;
}

export function googleBooksSearchUrl(
  query: string,
  { apiKey, quotaUser }: { apiKey: string; quotaUser?: string },
): string {
  const params = new URLSearchParams({
    q: query,
    country: 'IT',
    printType: 'books',
    maxResults: String(googleBooksLimit),
    fields: 'items(id,volumeInfo(title,authors,publisher,publishedDate,industryIdentifiers,language,imageLinks))',
    key: apiKey,
  });
  if (quotaUser) params.set('quotaUser', quotaUser);
  return `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
}

function isbnsOf(values: unknown): string[] {
  const found = asStrings(values).flatMap((value) => {
    const isbn13 = toIsbn13(value);
    return isbn13 ? [isbn13] : [];
  });
  return [...new Set(found)];
}

function cover(source: SearchSource, id: string | undefined): CandidateCover | undefined {
  const url = id ? coverUrl(source, id) : null;
  return id && url ? { source, id, url } : undefined;
}

function openLibraryCoverId(value: unknown): string | undefined {
  return typeof value === 'number' && value > 0 ? String(value) : undefined;
}

function names(values: unknown): string[] {
  return asStrings(values).flatMap((name) => {
    const clean = text(name);
    return clean ? [clean] : [];
  });
}

/** Works from an Open Library search, in its order of relevance. */
export function parseOpenLibrarySearch(response: unknown): SearchHit[] {
  return asArray(asObject(response).docs).flatMap((item): SearchHit[] => {
    const doc = asObject(item);
    const workId = keyId(doc.key);
    const title = text(doc.title);
    if (!workId || !title) return [];

    const editionDoc = asObject(asArray(asObject(doc.editions).docs)[0]);
    const editionId = keyId(editionDoc.key);
    const editionCover = cover('openlibrary', openLibraryCoverId(editionDoc.cover_i));
    const editions: CandidateEdition[] = editionId
      ? [
          {
            source: 'openlibrary',
            editionId,
            isbn13: isbnsOf(editionDoc.isbn)[0],
            title: text(editionDoc.title),
            publisher: text(asStrings(editionDoc.publisher)[0]),
            publishedYear: positiveInt(asArray(editionDoc.publish_year)[0]),
            language: languageCode(text(asStrings(editionDoc.language)[0])),
            cover: editionCover,
          },
        ]
      : [];

    return [
      {
        key: `openlibrary:${workId}`,
        title,
        authors: names(doc.author_name),
        firstPublishedYear: positiveInt(doc.first_publish_year),
        openLibraryWorkId: workId,
        editionCount: positiveInt(doc.edition_count),
        cover: cover('openlibrary', openLibraryCoverId(doc.cover_i)) ?? editionCover,
        editions,
        sources: ['openlibrary'],
        isbns: [...new Set([...isbnsOf(doc.isbn), ...editions.flatMap((e) => (e.isbn13 ? [e.isbn13] : []))])],
      },
    ];
  });
}

/** A Google Books volume: one edition, with the title and authors it was published under. */
export interface GoogleBooksVolume {
  edition: CandidateEdition;
  title: string;
  authors: string[];
}

/** Volumes from a Google Books search, in its order of relevance. Nothing is kept as payload. */
export function parseGoogleBooksSearch(response: unknown): GoogleBooksVolume[] {
  return asArray(asObject(response).items).flatMap((item): GoogleBooksVolume[] => {
    const volume = asObject(item);
    const id = text(volume.id);
    const info = asObject(volume.volumeInfo);
    const title = text(info.title);
    if (!id || !title) return [];

    const identifiers = asArray(info.industryIdentifiers).map((entry) => asObject(entry).identifier);
    const hasImage = Object.keys(asObject(info.imageLinks)).length > 0;
    return [
      {
        title,
        authors: names(info.authors),
        edition: {
          source: 'googlebooks',
          editionId: id,
          isbn13: isbnsOf(identifiers)[0],
          title,
          publisher: text(info.publisher),
          publishedYear: extractYear(text(info.publishedDate)),
          language: languageCode(text(info.language)),
          cover: hasImage ? cover('googlebooks', id) : undefined,
        },
      },
    ];
  });
}

/** Same title and same first-author surname: how Google Books volumes are grouped. */
function groupKey(title: string, authors: string[]): string {
  return `${matchKey(title)}|${surnameKey(authors[0] ?? '')}`;
}

/**
 * Joins the two result lists into works. A Google Books volume joins an Open Library work
 * only through a shared ISBN, so no work identity is ever claimed from a title alone.
 * Volumes left over are grouped by title and first author; they carry no work id.
 * Candidates keep the relevance order of their sources, Open Library first on a tie.
 */
export function mergeSearchResults(openLibrary: SearchHit[], googleBooks: GoogleBooksVolume[]): SearchHit[] {
  const ranked = openLibrary.map((hit, rank) => ({ hit: structuredClone(hit), rank, tie: 0 }));
  const byGroup = new Map<string, (typeof ranked)[number]>();

  googleBooks.forEach((volume, rank) => {
    const { edition } = volume;
    const isbn13 = edition.isbn13;
    const work = isbn13 ? ranked.find((entry) => entry.tie === 0 && entry.hit.isbns.includes(isbn13)) : undefined;
    const key = groupKey(volume.title, volume.authors);
    const target = work ?? byGroup.get(key);

    if (target) {
      const { hit } = target;
      if (!isbn13 || !hit.editions.some((known) => known.isbn13 === isbn13)) hit.editions.push(edition);
      if (!hit.sources.includes('googlebooks')) hit.sources.push('googlebooks');
      if (isbn13 && !hit.isbns.includes(isbn13)) hit.isbns.push(isbn13);
      hit.cover ??= edition.cover;
      return;
    }

    const entry = {
      hit: {
        key: `googlebooks:${edition.editionId}`,
        title: volume.title,
        authors: volume.authors,
        cover: edition.cover,
        editions: [edition],
        sources: ['googlebooks'] as SearchSource[],
        isbns: isbn13 ? [isbn13] : [],
      },
      rank,
      tie: 1,
    };
    ranked.push(entry);
    byGroup.set(key, entry);
  });

  return ranked
    .sort((a, b) => a.rank - b.rank || a.tie - b.tie)
    .slice(0, maxCandidates)
    .map((entry) => entry.hit);
}

/** Open search results may be kept for a while; Google Books only as long as its headers allow. */
const openData: CachePolicy = { kind: 'fixed', ttlMs: 10 * 60 * 1000 };
const googleData: CachePolicy = { kind: 'header' };

export interface SearchOptions {
  http: HttpClient;
  /** Without a key Google Books is skipped. */
  googleBooksKey?: string;
  quotaUser?: string;
}

function status(found: number): SourceStatus {
  return found > 0 ? 'found' : 'not_found';
}

async function searchOpenLibrary(query: string, http: HttpClient) {
  const response = await http.getJson(openLibrarySearchUrl(query), openData);
  if (response.status !== 'ok') return { status: 'unavailable' as const, hits: [] };
  const hits = parseOpenLibrarySearch(response.data);
  return { status: status(hits.length), hits };
}

async function searchGoogleBooks(query: string, options: SearchOptions) {
  if (!options.googleBooksKey) return { status: 'skipped' as const, volumes: [] };
  const url = googleBooksSearchUrl(query, { apiKey: options.googleBooksKey, quotaUser: options.quotaUser });
  const response = await options.http.getJson(url, googleData);
  if (response.status !== 'ok') return { status: 'unavailable' as const, volumes: [] };
  const volumes = parseGoogleBooksSearch(response.data);
  return { status: status(volumes.length), volumes };
}

/**
 * Searches Open Library and Google Books in parallel for free text (title, author or
 * both) and merges the results into works. A failing source never fails the search.
 * The query must already be validated with `searchQuery` from `@libresca/domain`.
 */
export async function searchBooks(query: string, options: SearchOptions): Promise<BookSearch> {
  const [openLibrary, googleBooks] = await Promise.all([
    searchOpenLibrary(query, options.http),
    searchGoogleBooks(query, options),
  ]);
  return {
    sources: { openlibrary: openLibrary.status, googlebooks: googleBooks.status },
    hits: mergeSearchResults(openLibrary.hits, googleBooks.volumes),
  };
}
