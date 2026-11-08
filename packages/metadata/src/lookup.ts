import { toIsbn13 } from '@libresca/domain';

import { googleBooksIsbnUrl, parseGoogleBooks } from './googlebooks';
import { type CachePolicy, type HttpClient, type HttpResult, createHttpClient } from './http';
import { mergeRecords } from './merge';
import {
  openLibraryEdition,
  openLibraryEditionUrl,
  openLibraryWorkId,
  openLibraryWorkUrl,
  parseOpenLibrary,
} from './openlibrary';
import { isItalianIsbn, parseSbn, sbnBidFromSearch, sbnFullUrl, sbnSearchUrl } from './sbn';
import type { IsbnLookup, SourceName, SourceRecord, SourceStatus } from './types';

/** Open data may be kept for a while; Google Books only as long as its headers allow. */
const openData: CachePolicy = { kind: 'fixed', ttlMs: 60 * 60 * 1000 };
const googleData: CachePolicy = { kind: 'header' };

/** The pacing the sources ask for (docs/ARCHITECTURE.md): Open Library 3/s when identified, SBN 1/s. */
export const sourcePacing: Record<string, number> = {
  'openlibrary.org': 334,
  'opac.sbn.it': 1000,
};

/**
 * HTTP client for the sources. `contact` goes in the User-Agent, as Open Library
 * requires: an email or a URL, read from configuration, never hard-coded.
 */
export function createMetadataHttpClient(contact: string, fetchImpl?: typeof fetch): HttpClient {
  return createHttpClient({
    userAgent: `Libresca/0.1 (${contact})`,
    fetch: fetchImpl,
    timeoutMs: 4000,
    minIntervalMs: sourcePacing,
  });
}

export interface LookupOptions {
  http: HttpClient;
  /** Without a key Google Books is skipped: its anonymous quota is zero. */
  googleBooksKey?: string;
  quotaUser?: string;
}

type SourceOutcome = { status: SourceStatus; record?: SourceRecord };

function failed(result: Exclude<HttpResult, { status: 'ok' }>): SourceOutcome {
  return { status: result.status === 'not_found' ? 'not_found' : 'unavailable' };
}

async function fromOpenLibrary(isbn13: string, http: HttpClient): Promise<SourceOutcome> {
  const response = await http.getJson(openLibraryEditionUrl(isbn13), openData);
  if (response.status !== 'ok') return failed(response);
  const edition = openLibraryEdition(isbn13, response.data);
  if (!edition) return { status: 'not_found' };

  // The work holds the description; without it the edition is still useful.
  const workId = openLibraryWorkId(edition);
  const work = workId ? await http.getJson(openLibraryWorkUrl(workId), openData) : null;
  const record = parseOpenLibrary(edition, work?.status === 'ok' ? work.data : null);
  return record ? { status: 'found', record } : { status: 'not_found' };
}

async function fromGoogleBooks(isbn13: string, options: LookupOptions): Promise<SourceOutcome> {
  if (!options.googleBooksKey) return { status: 'skipped' };
  const url = googleBooksIsbnUrl(isbn13, { apiKey: options.googleBooksKey, quotaUser: options.quotaUser });
  const response = await options.http.getJson(url, googleData);
  if (response.status !== 'ok') return failed(response);
  const record = parseGoogleBooks(isbn13, response.data);
  return record ? { status: 'found', record } : { status: 'not_found' };
}

async function fromSbn(isbn13: string, http: HttpClient): Promise<SourceOutcome> {
  if (!isItalianIsbn(isbn13)) return { status: 'skipped' };
  const search = await http.getJson(sbnSearchUrl(isbn13), openData);
  if (search.status !== 'ok') return failed(search);
  const bid = sbnBidFromSearch(search.data);
  if (!bid) return { status: 'not_found' };

  const full = await http.getJson(sbnFullUrl(bid), openData);
  if (full.status !== 'ok') return failed(full);
  const record = parseSbn(full.data);
  return record ? { status: 'found', record } : { status: 'not_found' };
}

/**
 * Asks every relevant source in parallel and merges what they found (ADR-0008).
 * Returns null for an invalid ISBN. A failing source never fails the lookup.
 */
export async function lookupIsbn(isbn: string, options: LookupOptions): Promise<IsbnLookup | null> {
  const isbn13 = toIsbn13(isbn);
  if (!isbn13) return null;

  const [openlibrary, googlebooks, sbn] = await Promise.all([
    fromOpenLibrary(isbn13, options.http),
    fromGoogleBooks(isbn13, options),
    fromSbn(isbn13, options.http),
  ]);
  const outcomes: Record<SourceName, SourceOutcome> = { openlibrary, googlebooks, sbn };

  const records = Object.values(outcomes).flatMap((outcome) => (outcome.record ? [outcome.record] : []));
  return {
    isbn13,
    sources: { openlibrary: openlibrary.status, googlebooks: googlebooks.status, sbn: sbn.status },
    proposal: records.length > 0 ? mergeRecords(isbn13, records) : null,
  };
}
