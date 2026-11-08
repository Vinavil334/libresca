import type { ContributorRole, EditionFormat, ExternalIdInput, JsonValue } from '@libresca/domain';

/** The external sources queried for metadata (ADR-0008). */
export const sourceNames = ['openlibrary', 'googlebooks', 'sbn'] as const;
export type SourceName = (typeof sourceNames)[number];

/**
 * `found`: the source has the edition. `not_found`: it answered without it.
 * `unavailable`: error, timeout or rate limit. `skipped`: not asked (SBN for a
 * non-Italian ISBN, Google Books without a key).
 */
export type SourceStatus = 'found' | 'not_found' | 'unavailable' | 'skipped';

export interface SourceAuthor {
  name: string;
  /** The author's id at the source, when it has one (Open Library: `OL22242A`). */
  externalId?: string;
}

export interface SourceContributor {
  name: string;
  role: ContributorRole;
}

/** What one source says about an edition, already normalised. */
export interface SourceRecord {
  source: SourceName;
  /** Open Library edition key, Google Books volume id or SBN BID. */
  editionId: string;
  /** Open Library work key. */
  workId?: string;
  /** Goodreads book ids listed by the source: they help the Goodreads import later. */
  goodreadsIds: string[];
  title?: string;
  authors: SourceAuthor[];
  publisher?: string;
  publishedYear?: number;
  firstPublishedYear?: number;
  pageCount?: number;
  /** ISO 639-1 code when one exists, otherwise the three-letter code. */
  language?: string;
  format?: EditionFormat;
  description?: string;
  /** Open Library cover id, or the Google Books volume id when the volume has an image. */
  coverId?: string;
  contributors: SourceContributor[];
  /** Payload kept for provenance: open sources only, never Google Books (ADR-0008). */
  raw?: JsonValue;
  workRaw?: JsonValue;
}

/** Where a proposed value comes from: a source, or the user who typed or corrected it. */
export type ValueSource = SourceName | 'user';

/** A value and the source it was taken from. */
export interface Sourced<T> {
  value: T;
  source: ValueSource;
}

export interface ProposalAuthor {
  name: string;
  alternateNames: string[];
  externalIds: ExternalIdInput[];
}

/**
 * The merged card shown to the user before saving. Nothing here is stored until the
 * user confirms it in the add screen (F1.3).
 */
export interface EditionProposal {
  /** Missing for an edition without ISBN, found by a title search or typed by hand. */
  isbn13?: string;
  title?: Sourced<string>;
  authors: ProposalAuthor[];
  authorsSource?: ValueSource;
  publisher?: Sourced<string>;
  publishedYear?: Sourced<number>;
  firstPublishedYear?: Sourced<number>;
  /** `reliable` is false for Google Books, whose page counts are often wrong on Italian editions. */
  pageCount?: Sourced<number> & { reliable: boolean };
  language?: Sourced<string>;
  format?: Sourced<EditionFormat>;
  /** `storable` is false for Google Books: show it, never save it. */
  description?: Sourced<string> & { storable: boolean };
  cover?: { source: 'openlibrary' | 'googlebooks'; id: string; url: string };
  contributors: (SourceContributor & { source: ValueSource })[];
  editionExternalIds: ExternalIdInput[];
  workExternalIds: ExternalIdInput[];
}

export interface IsbnLookup {
  isbn13: string;
  sources: Record<SourceName, SourceStatus>;
  /** `null` when no source has the edition. */
  proposal: EditionProposal | null;
}
