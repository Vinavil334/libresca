import { type CoverSource, coverUrl } from './catalog';
import { coverPhotoUrl } from './cover-photo';
import { type ReadingStatus, sortReadings } from './readings';

/**
 * The Tana (F1.7): every work the person owns a copy of, has read or wants to read, or
 * has put on a shelf, as one entry. Owning and reading stay separate facts on the entry
 * (DATA_MODEL.md): the Tana only puts them side by side.
 */

/** The cover columns of an edition. */
export interface CoverEdition {
  id: string;
  cover_source: CoverSource | null;
  cover_id: string | null;
  cover_path: string | null;
}

export interface TanaWork {
  id: string;
  title: string;
  /** In order of position. */
  authors: { name: string; sort_name: string | null }[];
  editions: CoverEdition[];
}

export interface TanaCopyRow {
  edition_id: string;
  is_lendable: boolean;
  created_at: string;
  work: TanaWork;
}

export interface TanaReadingRow {
  status: ReadingStatus;
  started_on: string | null;
  finished_on: string | null;
  rating_half: number | null;
  edition_id: string | null;
  created_at: string;
  work: TanaWork;
}

export interface TanaShelfRow {
  shelf_id: string;
  created_at: string;
  work: TanaWork;
}

export interface TanaBook {
  workId: string;
  title: string;
  authors: string[];
  /** The first author's sort name ("Calvino, Italo"), for sorting by author. */
  authorSort: string;
  /** The edition whose cover stands for the book: the copy's, then the reading's, then any. */
  coverEdition: CoverEdition | null;
  copies: number;
  /** At least one copy may be lent. */
  lendable: boolean;
  /** The status of the most recent reading, `null` without readings. */
  status: ReadingStatus | null;
  /** Finished readings: "Letto 2 volte". */
  readCount: number;
  /** The rating of the most recent reading that has one. */
  ratingHalf: number | null;
  /** The end of the most recent finished reading, when known. */
  lastFinishedOn: string | null;
  /** When the book first entered the Tana. */
  addedAt: string;
  shelfIds: string[];
}

/**
 * Builds the Tana from the person's copies, readings and shelf items. Rows of the same
 * work become one book; readings are ordered as on the book page (`sortReadings`).
 */
export function buildTana(
  copies: TanaCopyRow[],
  readings: TanaReadingRow[],
  shelfItems: TanaShelfRow[] = [],
): TanaBook[] {
  const works = new Map<
    string,
    { work: TanaWork; copies: TanaCopyRow[]; readings: TanaReadingRow[]; shelves: TanaShelfRow[] }
  >();
  const entry = (work: TanaWork) => {
    let found = works.get(work.id);
    if (!found) {
      found = { work, copies: [], readings: [], shelves: [] };
      works.set(work.id, found);
    }
    return found;
  };
  for (const copy of copies) entry(copy.work).copies.push(copy);
  for (const reading of readings) entry(reading.work).readings.push(reading);
  for (const item of shelfItems) entry(item.work).shelves.push(item);

  return [...works.values()].map(({ work, copies: owned, readings: read, shelves }) => {
    const sorted = sortReadings(read);
    const withCover = (editionId: string | null) =>
      work.editions.find((edition) => edition.id === editionId && edition.cover_source !== null);
    const coverEdition =
      owned.map((copy) => withCover(copy.edition_id)).find(Boolean) ??
      sorted.map((reading) => withCover(reading.edition_id)).find(Boolean) ??
      work.editions.find((edition) => edition.cover_source !== null) ??
      null;
    const finished = sorted.filter((reading) => reading.status === 'read');
    const first = work.authors[0];
    return {
      workId: work.id,
      title: work.title,
      authors: work.authors.map((author) => author.name),
      authorSort: first ? (first.sort_name ?? first.name) : '',
      coverEdition,
      copies: owned.length,
      lendable: owned.some((copy) => copy.is_lendable),
      status: sorted[0]?.status ?? null,
      readCount: finished.length,
      ratingHalf: sorted.find((reading) => reading.rating_half !== null)?.rating_half ?? null,
      lastFinishedOn: finished.find((reading) => reading.finished_on !== null)?.finished_on ?? null,
      addedAt: [...owned, ...read, ...shelves].map((row) => row.created_at).sort()[0] ?? '',
      shelfIds: [...new Set(shelves.map((item) => item.shelf_id))],
    };
  });
}

/** The image of an edition: a photo from our bucket, or a cover loaded live from its source. */
export function editionCoverUrl(edition: Omit<CoverEdition, 'id'> | null, supabaseUrl: string): string | null {
  if (!edition) return null;
  const source = edition.cover_source;
  if (source === 'upload') return edition.cover_path ? coverPhotoUrl(supabaseUrl, edition.cover_path) : null;
  if (!edition.cover_id || (source !== 'openlibrary' && source !== 'googlebooks')) return null;
  return coverUrl(source, edition.cover_id);
}

/** Filter chips: four on readings, two on copies (SCHERMATE_TANA.md). */
export const tanaReadingFilters = ['reading', 'read', 'want', 'abandoned'] as const;
export const tanaCopyFilters = ['owned', 'lendable'] as const;
export const tanaFilters = [...tanaReadingFilters, ...tanaCopyFilters] as const;
export type TanaFilter = (typeof tanaFilters)[number];

export const tanaOrders = ['recent', 'title', 'author'] as const;
export type TanaOrder = (typeof tanaOrders)[number];

/** Lowercase without accents, so "citta" finds "Città". */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

function hasFilter(book: TanaBook, filter: TanaFilter): boolean {
  switch (filter) {
    case 'reading':
      return book.status === 'reading';
    case 'read':
      // Read at least once, even while a reread is in progress.
      return book.readCount > 0;
    case 'want':
      return book.status === 'want';
    case 'abandoned':
      return book.status === 'abandoned';
    case 'owned':
      return book.copies > 0;
    case 'lendable':
      return book.lendable;
  }
}

/**
 * Whether a book matches the search and the chips. Reading chips widen each other
 * ("In lettura" or "Dispensa"); copy chips narrow ("Ce l'ho" and "Si può prestare").
 */
export function matchesTana(book: TanaBook, query: string, filters: readonly TanaFilter[]): boolean {
  const folded = foldText(query);
  if (folded && !foldText([book.title, ...book.authors].join(' ')).includes(folded)) return false;
  const reading = filters.filter((filter) => (tanaReadingFilters as readonly string[]).includes(filter));
  if (reading.length > 0 && !reading.some((filter) => hasFilter(book, filter))) return false;
  return filters.every((filter) => reading.includes(filter) || hasFilter(book, filter));
}

/** How many books each chip would show on its own, for the counts on desktop. */
export function tanaCounts(books: TanaBook[]): Record<TanaFilter, number> {
  const counts = Object.fromEntries(tanaFilters.map((filter) => [filter, 0])) as Record<TanaFilter, number>;
  for (const book of books) for (const filter of tanaFilters) if (hasFilter(book, filter)) counts[filter] += 1;
  return counts;
}

/** Sorts a copy of the books: newest first, or by title or author in the user's language. */
export function sortTana<T extends TanaBook>(books: T[], order: TanaOrder, locale: string): T[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  return [...books].sort((a, b) => {
    if (order === 'recent') return b.addedAt.localeCompare(a.addedAt) || collator.compare(a.title, b.title);
    if (order === 'author') return collator.compare(a.authorSort, b.authorSort) || collator.compare(a.title, b.title);
    return collator.compare(a.title, b.title);
  });
}
