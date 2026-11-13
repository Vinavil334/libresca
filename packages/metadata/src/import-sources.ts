import { type CatalogEntryInput, type GoodreadsBook, goodreadsExternalIds, sameGoodreadsBook } from '@libresca/domain';

import { candidateProposal, editedCatalogEntry, editsFromProposal, openLibraryAuthorIds } from './edit';
import { type LookupOptions, lookupIsbn } from './lookup';
import { type WorkCandidate, searchBooks } from './search';
import type { EditionProposal } from './types';

/**
 * The sources as an import sees them (F1.8): from a Goodreads row to a catalog entry
 * ready for `create_edition`, reusing works and authors the catalog already has.
 */

/** What the import needs from the catalog, provided by `packages/data`. */
export interface ImportCatalogLookups {
  /** Open Library work id → catalog work id. */
  worksByOpenLibraryId(ids: string[]): Promise<Record<string, string>>;
  /** Open Library author id → catalog author id. */
  authorsByOpenLibraryId(ids: string[]): Promise<Record<string, string>>;
}

export interface ImportSourceOptions extends Omit<LookupOptions, 'googleOnlyForGaps'> {
  catalog: ImportCatalogLookups;
}

/** A candidate book for a row in review, small enough to keep in `import_rows.candidates`. */
export interface ImportCandidate {
  key: string;
  title: string;
  authors: string[];
  year?: number;
  isbn13?: string;
  coverUrl?: string;
  /** Present when the candidate has no ISBN: the entry to create if the user picks it. */
  entry?: CatalogEntryInput;
}

/** The entry for a proposal, attached to the catalog work and authors it already shares ids with. */
async function entryFor(
  proposal: EditionProposal,
  book: GoodreadsBook,
  catalog: ImportCatalogLookups,
): Promise<CatalogEntryInput> {
  const workIds = proposal.workExternalIds.flatMap((id) => (id.source === 'openlibrary' ? [id.value] : []));
  const [works, knownAuthors] = await Promise.all([
    workIds.length > 0 ? catalog.worksByOpenLibraryId(workIds) : Promise.resolve({} as Record<string, string>),
    catalog.authorsByOpenLibraryId(openLibraryAuthorIds(proposal)),
  ]);
  const workId = workIds.map((id) => works[id]).find((id) => id !== undefined);
  const entry = editedCatalogEntry(proposal, editsFromProposal(proposal), { workId, knownAuthors });
  return {
    ...entry,
    edition: { ...entry.edition, externalIds: [...(entry.edition.externalIds ?? []), ...goodreadsExternalIds(book)] },
  };
}

/**
 * The entry for a row with an ISBN: the open sources first, Google Books only for their
 * gaps and only when `allowGoogle`. `null` when no source knows the ISBN.
 */
export async function importEntryForIsbn(
  book: GoodreadsBook & { isbn13: string },
  allowGoogle: boolean,
  options: ImportSourceOptions,
): Promise<{ entry: CatalogEntryInput | null; usedGoogle: boolean }> {
  const lookup = await lookupIsbn(book.isbn13, {
    ...options,
    googleBooksKey: allowGoogle ? options.googleBooksKey : undefined,
    googleOnlyForGaps: true,
  });
  const usedGoogle = lookup !== null && lookup.sources.googlebooks !== 'skipped';
  if (!lookup?.proposal) return { entry: null, usedGoogle };
  return { entry: await entryFor(lookup.proposal, book, options.catalog), usedGoogle };
}

/**
 * Candidates for a row without ISBN, from Open Library only (Google's quota is kept for
 * ISBNs). `sure` is set when one candidate has the same title and author.
 */
export async function importCandidates(
  book: GoodreadsBook,
  options: ImportSourceOptions,
): Promise<{ sure: ImportCandidate | null; candidates: ImportCandidate[] }> {
  const query = [book.searchTitle, book.author].filter(Boolean).join(' ');
  const search = await searchBooks(query, { http: options.http });
  const candidates = await Promise.all(search.hits.slice(0, 3).map((hit) => toCandidate(hit, book, options.catalog)));
  const sure = search.hits.slice(0, 3).findIndex((hit) => sameGoodreadsBook(book, hit.title, hit.authors));
  return { sure: sure >= 0 ? (candidates[sure] ?? null) : null, candidates };
}

async function toCandidate(
  hit: WorkCandidate,
  book: GoodreadsBook,
  catalog: ImportCatalogLookups,
): Promise<ImportCandidate> {
  const withIsbn = hit.editions.find((edition) => edition.isbn13);
  const edition = withIsbn ?? hit.editions[0];
  return {
    key: hit.key,
    title: hit.title,
    authors: hit.authors,
    ...(hit.firstPublishedYear ? { year: hit.firstPublishedYear } : {}),
    ...(withIsbn?.isbn13 ? { isbn13: withIsbn.isbn13 } : {}),
    ...(hit.cover ? { coverUrl: hit.cover.url } : {}),
    ...(!withIsbn && edition ? { entry: await entryFor(candidateProposal(hit, edition), book, catalog) } : {}),
  };
}
