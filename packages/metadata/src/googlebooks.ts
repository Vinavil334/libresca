import { toIsbn13 } from '@libresca/domain';

import { asArray, asObject, asStrings } from './json';
import { extractYear, languageCode, positiveInt, text } from './text';
import type { SourceRecord } from './types';

export interface GoogleBooksUrlOptions {
  apiKey: string;
  /**
   * Opaque per-user id: Google counts the per-minute quota per `quotaUser`, so one
   * account cannot use up everyone's share. Never an email or a raw user id.
   */
  quotaUser?: string;
}

export function googleBooksIsbnUrl(isbn13: string, { apiKey, quotaUser }: GoogleBooksUrlOptions): string {
  const params = new URLSearchParams({ q: `isbn:${isbn13}`, country: 'IT', key: apiKey });
  if (quotaUser) params.set('quotaUser', quotaUser);
  return `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
}

/**
 * The volume that really carries the ISBN: a search by ISBN can also return
 * near matches. Nothing from Google Books is kept as raw payload (ADR-0008).
 */
export function parseGoogleBooks(isbn13: string, response: unknown): SourceRecord | null {
  const item = asArray(asObject(response).items).find((candidate) =>
    asArray(asObject(asObject(candidate).volumeInfo).industryIdentifiers).some((identifier) => {
      const value = asObject(identifier).identifier;
      return typeof value === 'string' && toIsbn13(value) === isbn13;
    }),
  );
  if (!item) return null;

  const volume = asObject(item);
  const id = text(volume.id);
  if (!id) return null;
  const info = asObject(volume.volumeInfo);
  const hasImage = Object.keys(asObject(info.imageLinks)).length > 0;

  return {
    source: 'googlebooks',
    editionId: id,
    goodreadsIds: [],
    title: text(info.title),
    authors: asStrings(info.authors).flatMap((name) => {
      const clean = text(name);
      return clean ? [{ name: clean }] : [];
    }),
    publisher: text(info.publisher),
    publishedYear: extractYear(text(info.publishedDate)),
    pageCount: positiveInt(info.pageCount),
    language: languageCode(text(info.language)),
    description: typeof info.description === 'string' ? info.description.trim() || undefined : undefined,
    coverId: hasImage ? id : undefined,
    contributors: [],
  };
}
