import {
  type CatalogEntryInput,
  type GoodreadsBook,
  goodreadsCatalogEntry,
  parseGoodreadsExport,
  plannedReadings,
  sameGoodreadsBook,
} from '@libresca/domain';

import { createEdition, getEditionByIsbn, getWork, searchWorks } from './catalog';
import type { LibrescaClient } from './client';
import { addCopy, listOwnCopies } from './copies';
import type { Json, Tables } from './database.types';
import { addReading, listOwnReadings } from './readings';
import { createShelf, listOwnShelves, setOnShelf } from './shelves';

/**
 * Library imports (F1.8). The browser starts a job with the export, then asks for one
 * step at a time; each step processes a few rows within a time budget, so it fits a
 * serverless function and survives a closed tab. Running a job twice never duplicates a
 * book: rows already imported are skipped, and a book already in the Tana keeps its
 * readings and copies.
 */

export type ImportJob = Tables<'import_jobs'>;
export type ImportRow = Tables<'import_rows'>;
export type ImportRowStatus = 'pending' | 'imported' | 'review' | 'skipped' | 'failed';

/** A candidate kept for a row in review (see `ImportCandidate` in `packages/metadata`). */
export interface StoredCandidate {
  key: string;
  title: string;
  authors: string[];
  year?: number;
  isbn13?: string;
  coverUrl?: string;
  entry?: CatalogEntryInput;
}

/** The sources, provided by the caller (`packages/metadata` behind `/api/v1`). */
export interface ImportSources {
  entryForIsbn(
    book: GoodreadsBook & { isbn13: string },
    allowGoogle: boolean,
  ): Promise<{ entry: CatalogEntryInput | null; usedGoogle: boolean }>;
  candidates(book: GoodreadsBook): Promise<{ sure: StoredCandidate | null; candidates: StoredCandidate[] }>;
}

export interface ImportProgress {
  jobId: string;
  status: 'running' | 'finished';
  total: number;
  counts: Record<ImportRowStatus, number>;
}

export type StartImportResult =
  { ok: true; progress: ImportProgress } | { ok: false; reason: 'empty' | 'not_goodreads' | 'forbidden' | 'failed' };

/** Google Books calls an import may make per day, below the free 1,000 (docs/ARCHITECTURE.md). */
export const googleDailyCap = 300;
/** Rows handled by one step at most. */
const rowsPerStep = 12;
const insertBatch = 500;

function bookOf(row: Pick<ImportRow, 'raw'>): GoodreadsBook {
  return row.raw as unknown as GoodreadsBook;
}

/** The caller's most recent import, for resuming after a closed tab. */
export async function getLatestImport(client: LibrescaClient): Promise<ImportJob | null> {
  const { data } = await client
    .from('import_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** How many rows of a job are in each state. `null` when the job is not the caller's. */
export async function getImportProgress(client: LibrescaClient, jobId: string): Promise<ImportProgress | null> {
  const { data: job } = await client.from('import_jobs').select('id, status').eq('id', jobId).maybeSingle();
  if (!job) return null;
  const counts: Record<ImportRowStatus, number> = { pending: 0, imported: 0, review: 0, skipped: 0, failed: 0 };
  await Promise.all(
    (Object.keys(counts) as ImportRowStatus[]).map(async (status) => {
      const { count } = await client
        .from('import_rows')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('status', status);
      counts[status] = count ?? 0;
    }),
  );
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return { jobId, status: job.status === 'finished' ? 'finished' : 'running', total, counts };
}

/** Source keys the caller already brought in with an earlier import. */
async function importedBefore(client: LibrescaClient): Promise<Set<string>> {
  const keys = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from('import_rows')
      .select('source_key')
      .in('status', ['imported', 'skipped'])
      .order('id')
      .range(from, from + 999);
    if (error || !data) return keys;
    for (const row of data) keys.add(row.source_key);
    if (data.length < 1000) return keys;
  }
}

/**
 * Starts an import from the text of a Goodreads export. The file is parsed here, on the
 * server, with the same parser the browser used for the preview: the rows are never
 * taken from the client as they are.
 */
export async function startGoodreadsImport(client: LibrescaClient, csv: string): Promise<StartImportResult> {
  const parsed = parseGoodreadsExport(csv);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  if (parsed.books.length === 0) return { ok: false, reason: 'empty' };

  const { data: job, error } = await client.from('import_jobs').insert({ source: 'goodreads' }).select().single();
  if (error || !job) return { ok: false, reason: error?.code === '42501' ? 'forbidden' : 'failed' };

  const before = await importedBefore(client);
  const seen = new Set<string>();
  const rows = parsed.books.flatMap((book) => {
    const key = book.goodreadsId || `line-${book.line}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const done = before.has(key);
    return [
      {
        job_id: job.id,
        line: book.line,
        source_key: key,
        raw: book as unknown as { [key: string]: Json },
        status: done ? 'skipped' : 'pending',
        note: done ? 'imported_before' : null,
      },
    ];
  });
  for (let start = 0; start < rows.length; start += insertBatch) {
    const { error: rowsError } = await client.from('import_rows').insert(rows.slice(start, start + insertBatch));
    if (rowsError) {
      await client.from('import_jobs').delete().eq('id', job.id);
      return { ok: false, reason: 'failed' };
    }
  }
  const progress = await getImportProgress(client, job.id);
  return progress ? { ok: true, progress } : { ok: false, reason: 'failed' };
}

/** An edition the caller can attach personal data to. */
interface Placed {
  workId: string;
  editionId: string;
}

async function editionByGoodreadsId(client: LibrescaClient, goodreadsId: string): Promise<Placed | null> {
  if (!/^\d{1,20}$/.test(goodreadsId)) return null;
  const { data } = await client
    .from('external_ids')
    .select('edition:editions!inner(id, work_id)')
    .eq('source', 'goodreads')
    .eq('value', goodreadsId)
    .limit(1)
    .maybeSingle();
  return data?.edition ? { workId: data.edition.work_id, editionId: data.edition.id } : null;
}

async function create(client: LibrescaClient, entry: CatalogEntryInput, book: GoodreadsBook): Promise<Placed | null> {
  const result = await createEdition(client, entry);
  if (result.ok) return { workId: result.workId, editionId: result.editionId };
  // Someone added the same ISBN meanwhile: use that edition.
  if (result.reason === 'duplicate_isbn' && book.isbn13) {
    const edition = await getEditionByIsbn(client, book.isbn13);
    if (edition) return { workId: edition.work_id, editionId: edition.id };
  }
  // A source sent data the catalog refuses: the export alone is still a valid book.
  if (result.reason === 'invalid' || result.reason === 'rejected') {
    const fallback = await createEdition(client, goodreadsCatalogEntry(book));
    if (fallback.ok) return { workId: fallback.workId, editionId: fallback.editionId };
  }
  return null;
}

/** A catalog work with the same title and author, for a row without ISBN. */
async function catalogMatch(client: LibrescaClient, book: GoodreadsBook): Promise<Placed | null> {
  const works = await searchWorks(client, book.searchTitle, 10);
  const match = works.find((work) =>
    sameGoodreadsBook(
      book,
      work.title,
      work.authors.flatMap((author) => [author.name, ...author.alternate_names]),
    ),
  );
  if (!match) return null;
  const work = await getWork(client, match.id);
  const edition = work?.editions[0];
  return work && edition ? { workId: work.id, editionId: edition.id } : null;
}

type Placement =
  | { kind: 'placed'; placed: Placed; note: string; usedGoogle: boolean }
  | { kind: 'review'; candidates: StoredCandidate[] }
  | { kind: 'failed' };

/** Finds or creates the edition of a row: identifiers first, then the catalog, then the sources. */
async function place(
  client: LibrescaClient,
  book: GoodreadsBook,
  sources: ImportSources,
  allowGoogle: boolean,
): Promise<Placement> {
  const known = await editionByGoodreadsId(client, book.goodreadsId);
  if (known) return { kind: 'placed', placed: known, note: 'catalog', usedGoogle: false };

  if (book.isbn13) {
    const edition = await getEditionByIsbn(client, book.isbn13);
    if (edition)
      return {
        kind: 'placed',
        placed: { workId: edition.work_id, editionId: edition.id },
        note: 'catalog',
        usedGoogle: false,
      };
    const found = await sources.entryForIsbn({ ...book, isbn13: book.isbn13 }, allowGoogle);
    const placed = await create(client, found.entry ?? goodreadsCatalogEntry(book), book);
    if (!placed) return { kind: 'failed' };
    return {
      kind: 'placed',
      placed,
      note: found.entry ? 'from_sources' : 'from_goodreads',
      usedGoogle: found.usedGoogle,
    };
  }

  const inCatalog = await catalogMatch(client, book);
  if (inCatalog) return { kind: 'placed', placed: inCatalog, note: 'catalog', usedGoogle: false };

  const { sure, candidates } = await sources.candidates(book);
  if (sure) return choose(client, book, sure, sources, allowGoogle);
  if (candidates.length > 0) return { kind: 'review', candidates };
  const placed = await create(client, goodreadsCatalogEntry(book), book);
  return placed ? { kind: 'placed', placed, note: 'from_goodreads', usedGoogle: false } : { kind: 'failed' };
}

/** Places a row on a candidate: by its ISBN when it has one, otherwise with its entry. */
async function choose(
  client: LibrescaClient,
  book: GoodreadsBook,
  candidate: StoredCandidate,
  sources: ImportSources,
  allowGoogle: boolean,
): Promise<Placement> {
  if (candidate.isbn13) {
    return place(client, { ...book, isbn13: candidate.isbn13 }, sources, allowGoogle);
  }
  const placed = await create(client, candidate.entry ?? goodreadsCatalogEntry(book), book);
  return placed ? { kind: 'placed', placed, note: 'from_sources', usedGoogle: false } : { kind: 'failed' };
}

/** Shelf ids by lowercase name, created on demand and remembered for the step. */
type ShelfIds = Map<string, string>;

async function loadShelves(client: LibrescaClient): Promise<ShelfIds> {
  const shelves = (await listOwnShelves(client)) ?? [];
  return new Map(shelves.map((shelf) => [shelf.name.toLocaleLowerCase(), shelf.id]));
}

async function shelfId(client: LibrescaClient, shelves: ShelfIds, name: string): Promise<string | null> {
  const key = name.toLocaleLowerCase();
  const known = shelves.get(key);
  if (known) return known;
  const created = await createShelf(client, name);
  if (created.ok) {
    shelves.set(key, created.shelf.id);
    return created.shelf.id;
  }
  // Created meanwhile, in another tab or step.
  const reloaded = await loadShelves(client);
  for (const [k, id] of reloaded) shelves.set(k, id);
  return shelves.get(key) ?? null;
}

/**
 * Puts a placed book in the caller's Tana: readings, copies and shelves. A book that
 * already has readings or copies keeps them as they are, so a second import adds nothing.
 */
async function bringIn(
  client: LibrescaClient,
  book: GoodreadsBook,
  placed: Placed,
  shelves: ShelfIds,
  today: string,
): Promise<'imported' | 'already_in_tana'> {
  const [readings, copies] = await Promise.all([
    listOwnReadings(client, placed.workId),
    listOwnCopies(client, placed.workId),
  ]);
  // Oldest first, so the latest reading is created last.
  for (const planned of [...plannedReadings(book)].reverse()) {
    if (readings.length > 0) break;
    const input = { ...planned, editionId: placed.editionId };
    const result = await addReading(client, placed.workId, input, today);
    // A date the domain refuses (in the future, say) is dropped, never fixed by guessing.
    if (!result.ok && result.reason === 'invalid') {
      await addReading(client, placed.workId, { ...input, finishedOn: undefined }, today);
    }
  }
  if (copies.length === 0) {
    for (let i = 0; i < book.copies; i++) await addCopy(client, placed.editionId, {}, today);
  }
  for (const name of book.shelves) {
    const id = await shelfId(client, shelves, name);
    if (id) await setOnShelf(client, id, placed.workId, true);
  }
  return readings.length > 0 || copies.length > 0 ? 'already_in_tana' : 'imported';
}

async function updateRow(
  client: LibrescaClient,
  rowId: string,
  status: ImportRowStatus,
  fields: { work_id?: string | null; candidates?: Json | null; note?: string | null } = {},
) {
  await client
    .from('import_rows')
    .update({ status, ...fields })
    .eq('id', rowId);
}

/** Whether Google Books may still be asked today by this job, and the counters to save. */
function googleBudget(job: ImportJob, today: string) {
  const calls = job.google_day === today ? job.google_calls : 0;
  return { calls, allowed: calls < googleDailyCap };
}

/**
 * Processes the next pending rows of a job, within `budgetMs`. Returns the progress;
 * the job is finished when no row is pending (rows in review wait for the user).
 */
export async function runImportStep(
  client: LibrescaClient,
  jobId: string,
  sources: ImportSources,
  options: { today: string; budgetMs: number; now?: () => number },
): Promise<ImportProgress | null> {
  const now = options.now ?? Date.now;
  const started = now();
  const { data: job } = await client.from('import_jobs').select('*').eq('id', jobId).maybeSingle();
  if (!job) return null;

  const { data: rows } = await client
    .from('import_rows')
    .select('id, raw')
    .eq('job_id', jobId)
    .eq('status', 'pending')
    .order('line')
    .limit(rowsPerStep);

  const shelves = await loadShelves(client);
  let { calls } = googleBudget(job, options.today);
  for (const row of rows ?? []) {
    if (now() - started > options.budgetMs) break;
    const book = bookOf(row);
    try {
      const placement = await place(client, book, sources, calls < googleDailyCap);
      if (placement.kind === 'placed') {
        if (placement.usedGoogle) calls += 1;
        const outcome = await bringIn(client, book, placement.placed, shelves, options.today);
        await updateRow(client, row.id, 'imported', {
          work_id: placement.placed.workId,
          note: outcome === 'already_in_tana' ? 'already_in_tana' : placement.note,
        });
      } else if (placement.kind === 'review') {
        await updateRow(client, row.id, 'review', { candidates: placement.candidates as unknown as Json });
      } else {
        await updateRow(client, row.id, 'failed', { note: 'catalog_refused' });
      }
    } catch {
      await updateRow(client, row.id, 'failed', { note: 'error' });
    }
  }

  const { count } = await client
    .from('import_rows')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('status', 'pending');
  await client
    .from('import_jobs')
    .update({ google_day: options.today, google_calls: calls, ...(count === 0 ? { status: 'finished' } : {}) })
    .eq('id', jobId);
  return getImportProgress(client, jobId);
}

/** The rows waiting for the user's choice, in file order. */
export async function listImportRowsInReview(client: LibrescaClient, jobId: string): Promise<ImportRow[]> {
  const { data } = await client
    .from('import_rows')
    .select('*')
    .eq('job_id', jobId)
    .eq('status', 'review')
    .order('line');
  return data ?? [];
}

/** The rows that could not be imported, for the report. */
export async function listFailedImportRows(client: LibrescaClient, jobId: string): Promise<ImportRow[]> {
  const { data } = await client
    .from('import_rows')
    .select('*')
    .eq('job_id', jobId)
    .eq('status', 'failed')
    .order('line');
  return data ?? [];
}

export type ReviewChoice = { kind: 'candidate'; key: string } | { kind: 'as_exported' } | { kind: 'skip' };

/**
 * The user's answer for a row in review: one of the candidates, the book as Goodreads
 * describes it, or nothing. Returns whether the row was settled.
 */
export async function resolveImportRow(
  client: LibrescaClient,
  rowId: string,
  choice: ReviewChoice,
  sources: ImportSources,
  today: string,
): Promise<boolean> {
  const { data: row } = await client
    .from('import_rows')
    .select('*')
    .eq('id', rowId)
    .eq('status', 'review')
    .maybeSingle();
  if (!row) return false;
  if (choice.kind === 'skip') {
    await updateRow(client, row.id, 'skipped', { note: 'skipped_by_user' });
    return true;
  }
  const book = bookOf(row);
  let placement: Placement;
  if (choice.kind === 'candidate') {
    const candidate = ((row.candidates ?? []) as unknown as StoredCandidate[]).find((item) => item.key === choice.key);
    if (!candidate) return false;
    placement = await choose(client, book, candidate, sources, false);
  } else {
    const placed = await create(client, goodreadsCatalogEntry(book), book);
    placement = placed ? { kind: 'placed', placed, note: 'from_goodreads', usedGoogle: false } : { kind: 'failed' };
  }
  if (placement.kind !== 'placed') return false;
  const outcome = await bringIn(client, book, placement.placed, await loadShelves(client), today);
  await updateRow(client, row.id, 'imported', {
    work_id: placement.placed.workId,
    note: outcome === 'already_in_tana' ? 'already_in_tana' : placement.note,
  });
  return true;
}
