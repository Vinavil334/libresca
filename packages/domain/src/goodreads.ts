import type { CatalogEntryInput, ExternalIdInput } from './catalog';
import { isCalendarDate } from './dates';
import { toIsbn13 } from './isbn';
import { type ReadingStatus, reviewMaxLength } from './readings';
import { validateShelfName } from './shelves';
import { foldText } from './tana';

/**
 * The Goodreads library export (F1.8). The CSV is parsed by column name, never by position
 * (`.claude/skills/metadati-libri/goodreads-csv.md`). Nothing is guessed: the start of a
 * reading is not in the export and stays empty, `Date Added` is never a reading date.
 */

/** Splits CSV text into rows of fields: quotes, doubled quotes and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((fields) => fields.some((value) => value.trim() !== ''));
}

/** Exclusive shelves Goodreads always has. */
const builtInShelves = { read: 'read', 'currently-reading': 'reading', 'to-read': 'want' } as const;

/** Custom exclusive shelves that mean "not finished": they become "Messo da parte". */
const pausedShelves = new Set([
  'did-not-finish',
  'dnf',
  'abandoned',
  'abbandonati',
  'abbandonato',
  'non-finiti',
  'non-finito',
  'messi-da-parte',
  'lasciati',
]);

/** At most this many copies from `Owned Copies`: a typo should not fill the Tana. */
const maxCopies = 5;

export interface GoodreadsBook {
  /** The line in the file, for the report. */
  line: number;
  goodreadsId: string;
  title: string;
  /** The title without the series in brackets, for searching: "Dune (Dune, #1)" → "Dune". */
  searchTitle: string;
  author: string | null;
  isbn13: string | null;
  publisher: string | null;
  pageCount: number | null;
  publishedYear: number | null;
  originalYear: number | null;
  /** `null` for a custom exclusive shelf that is not a "did not finish" shelf. */
  status: ReadingStatus | null;
  exclusiveShelf: string;
  ratingQuarter: number | null;
  finishedOn: string | null;
  readCount: number;
  copies: number;
  /** Shelf names for Libresca, without the exclusive ones. */
  shelves: string[];
  /** My Review and Private Notes, as plain text. */
  review: string | null;
}

export type GoodreadsIssue =
  | { line: number; code: 'missing_title' | 'invalid_date' | 'review_cut' | 'invalid_isbn' }
  | { line: number; code: 'custom_shelf'; shelf: string };

export type GoodreadsParse =
  { ok: true; books: GoodreadsBook[]; issues: GoodreadsIssue[] } | { ok: false; reason: 'empty' | 'not_goodreads' };

const requiredColumns = ['Book Id', 'Title', 'Exclusive Shelf'];

/** `="9788806..."`, the spreadsheet wrapper Goodreads puts around ISBNs. */
function unwrap(value: string): string {
  return value.trim().replace(/^="?/, '').replace(/"$/, '').trim();
}

function count(value: string): number {
  const number = Number.parseInt(value.trim(), 10);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function year(value: string): number | null {
  const number = Number.parseInt(value.trim(), 10);
  return Number.isInteger(number) && number >= 1000 && number <= 2100 ? number : null;
}

/** Goodreads reviews keep a little HTML: line breaks become new lines, other tags go. */
function plainText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** "fantasy-italiano" → "fantasy italiano": Goodreads shelf names are slugs. */
export function goodreadsShelfName(slug: string): string | null {
  const validation = validateShelfName(slug.replace(/-/g, ' '));
  return validation.ok ? validation.name : null;
}

/** Removes a trailing series in brackets: "Il nome della rosa (Biblioteca, #3)" → "Il nome della rosa". */
export function stripSeries(title: string): string {
  const stripped = title.replace(/\s*\([^()]*#[^()]*\)\s*$/, '').trim();
  return stripped || title.trim();
}

/**
 * Parses a Goodreads export. Rows without a title are reported, never dropped in silence;
 * every other row becomes a book, even without ISBN.
 */
export function parseGoodreadsExport(text: string): GoodreadsParse {
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header) return { ok: false, reason: 'empty' };
  const index = new Map(header.map((name, i) => [name.trim(), i]));
  if (!requiredColumns.every((column) => index.has(column))) return { ok: false, reason: 'not_goodreads' };
  const field = (row: string[], column: string) => {
    const i = index.get(column);
    return i === undefined ? '' : (row[i] ?? '').trim();
  };

  const books: GoodreadsBook[] = [];
  const issues: GoodreadsIssue[] = [];
  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const title = field(row, 'Title');
    if (!title) return issues.push({ line, code: 'missing_title' });

    const exclusiveShelf = field(row, 'Exclusive Shelf') || 'read';
    const builtIn = builtInShelves[exclusiveShelf as keyof typeof builtInShelves];
    const status: ReadingStatus | null = builtIn ?? (pausedShelves.has(exclusiveShelf) ? 'abandoned' : null);
    if (!status) issues.push({ line, code: 'custom_shelf', shelf: exclusiveShelf });

    const rating = count(field(row, 'My Rating'));
    const dateRead = field(row, 'Date Read').replace(/\//g, '-');
    const finishedOn = dateRead && isCalendarDate(dateRead) ? dateRead : null;
    if (dateRead && !finishedOn) issues.push({ line, code: 'invalid_date' });

    const rawIsbn = unwrap(field(row, 'ISBN13')) || unwrap(field(row, 'ISBN'));
    const isbn13 = rawIsbn ? toIsbn13(rawIsbn) : null;
    if (rawIsbn && !isbn13) issues.push({ line, code: 'invalid_isbn' });

    const notes = [plainText(field(row, 'My Review')), plainText(field(row, 'Private Notes'))].filter(Boolean);
    let review = notes.join('\n\n') || null;
    if (review && review.length > reviewMaxLength) {
      review = review.slice(0, reviewMaxLength).trimEnd();
      issues.push({ line, code: 'review_cut' });
    }

    const exclusive = new Set([...Object.keys(builtInShelves), exclusiveShelf]);
    const shelves = field(row, 'Bookshelves')
      .split(',')
      .map((shelf) => shelf.trim())
      .filter((shelf) => shelf && !exclusive.has(shelf));
    // A custom exclusive shelf that is not "did not finish" is kept as a shelf.
    if (!status) shelves.push(exclusiveShelf);

    const readCount = count(field(row, 'Read Count'));
    const owned = count(field(row, 'Owned Copies'));
    books.push({
      line,
      goodreadsId: field(row, 'Book Id'),
      title,
      searchTitle: stripSeries(title),
      author: field(row, 'Author') || null,
      isbn13,
      publisher: field(row, 'Publisher') || null,
      pageCount: count(field(row, 'Number of Pages')) || null,
      publishedYear: year(field(row, 'Year Published')),
      originalYear: year(field(row, 'Original Publication Year')),
      status,
      exclusiveShelf,
      ratingQuarter: rating >= 1 && rating <= 5 ? rating * 4 : null,
      finishedOn,
      readCount: status === 'read' ? Math.max(1, readCount) : readCount,
      // Every book read is taken as owned; the user removes the ones they do not have.
      copies: Math.min(maxCopies, owned > 0 ? owned : status === 'read' ? 1 : 0),
      shelves: [...new Set(shelves.map(goodreadsShelfName).filter((name): name is string => name !== null))],
      review,
    });
  });
  return { ok: true, books, issues };
}

/** A reading to create, in the shape of `ReadingInput`. */
export interface PlannedReading {
  status: ReadingStatus;
  finishedOn?: string;
  ratingQuarter?: number | null;
  review?: string;
}

/**
 * The readings of a book, newest first. Only the latest reading gets the end date, the
 * rating and the notes; earlier reads of a reread stay without dates, never invented.
 */
export function plannedReadings(book: GoodreadsBook): PlannedReading[] {
  if (!book.status) return [];
  const latest: PlannedReading = {
    status: book.status,
    ...(book.status === 'read' || book.status === 'abandoned'
      ? { finishedOn: book.finishedOn ?? undefined, ratingQuarter: book.ratingQuarter }
      : {}),
    ...(book.review ? { review: book.review } : {}),
  };
  const earlier = book.status === 'read' ? book.readCount - 1 : book.status === 'reading' ? book.readCount : 0;
  return [latest, ...Array.from({ length: earlier }, () => ({ status: 'read' as const }))];
}

export interface GoodreadsSummary {
  books: number;
  withIsbn: number;
  byStatus: Record<ReadingStatus, number>;
  rated: number;
  readWithoutDate: number;
  rereads: number;
  copies: number;
  shelves: { name: string; books: number }[];
}

/** What an import would bring in, shown before anything is saved. */
export function summarizeGoodreads(books: GoodreadsBook[]): GoodreadsSummary {
  const byStatus: Record<ReadingStatus, number> = { want: 0, reading: 0, read: 0, abandoned: 0 };
  const shelves = new Map<string, number>();
  for (const book of books) {
    if (book.status) byStatus[book.status] += 1;
    for (const shelf of book.shelves) {
      const key = shelf.toLocaleLowerCase();
      shelves.set(key, (shelves.get(key) ?? 0) + 1);
    }
  }
  const names = new Map<string, string>();
  for (const book of books) for (const shelf of book.shelves) names.set(shelf.toLocaleLowerCase(), shelf);
  return {
    books: books.length,
    withIsbn: books.filter((book) => book.isbn13).length,
    byStatus,
    rated: books.filter((book) => book.ratingQuarter !== null).length,
    readWithoutDate: books.filter((book) => book.status === 'read' && !book.finishedOn).length,
    rereads: books.filter((book) => book.readCount > 1).length,
    copies: books.reduce((sum, book) => sum + book.copies, 0),
    shelves: [...shelves.entries()]
      .map(([key, count]) => ({ name: names.get(key) ?? key, books: count }))
      .sort((a, b) => b.books - a.books || a.name.localeCompare(b.name)),
  };
}

/**
 * A catalog entry from the export alone, for a book no source knows: the title without
 * the series, the main author, the edition details and the Goodreads id for provenance.
 * Additional authors are left out: on Goodreads they are often translators.
 */
export function goodreadsCatalogEntry(book: GoodreadsBook): CatalogEntryInput {
  const sources = { title: 'goodreads' as const };
  return {
    work: {
      title: book.searchTitle,
      authors: book.author ? [{ name: book.author }] : [],
      ...(book.originalYear ? { firstPublishedYear: book.originalYear } : {}),
      fieldSources: sources,
    },
    edition: {
      ...(book.isbn13 ? { isbn: book.isbn13 } : {}),
      ...(book.publisher ? { publisher: book.publisher } : {}),
      ...(book.publishedYear ? { publishedYear: book.publishedYear } : {}),
      ...(book.pageCount ? { pageCount: book.pageCount } : {}),
      metadataStatus: 'incomplete',
      fieldSources: sources,
      externalIds: goodreadsExternalIds(book),
    },
  };
}

/** The Goodreads id of the exported edition, kept on the edition for provenance. */
export function goodreadsExternalIds(book: GoodreadsBook): ExternalIdInput[] {
  return /^\d{1,20}$/.test(book.goodreadsId) ? [{ source: 'goodreads', value: book.goodreadsId }] : [];
}

/**
 * Whether a found book is surely the exported one when there is no ISBN: the same title
 * (series aside) and the same author, ignoring case and accents. Anything less goes to
 * the review screen.
 */
export function sameGoodreadsBook(book: GoodreadsBook, title: string, authors: string[]): boolean {
  const fold = (text: string) =>
    foldText(stripSeries(text))
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  if (fold(title) !== fold(book.searchTitle)) return false;
  if (!book.author) return authors.length === 0;
  const author = fold(book.author);
  return authors.some((name) => fold(name) === author);
}
