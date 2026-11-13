import {
  type CatalogEntryInput,
  type CatalogIssue,
  type EditionEditInput,
  type WorkEditInput,
  type ContributorRole,
  type CoverSource,
  type EditionFormat,
  type MetadataSource,
  type MetadataStatus,
  toIsbn13,
  validateCatalogEntry,
  validateEditionEdit,
  validateWorkEdit,
} from '@libresca/domain';

import type { LibrescaClient } from './client';
import type { Enums, Json, Tables } from './database.types';

// Compile-time guard: the domain's option lists must match the database enums.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const enumsMatch: [
  Same<Enums<'metadata_source'>, MetadataSource>,
  Same<Enums<'cover_source'>, CoverSource>,
  Same<Enums<'metadata_status'>, MetadataStatus>,
  Same<Enums<'edition_format'>, EditionFormat>,
  Same<Enums<'contributor_role'>, ContributorRole>,
] = [true, true, true, true, true];
void enumsMatch;

export type Work = Tables<'works'>;
export type Edition = Tables<'editions'>;
export type CatalogAuthor = Pick<Tables<'authors'>, 'id' | 'name' | 'sort_name' | 'alternate_names'>;
export type Contributor = Pick<Tables<'contributors'>, 'name' | 'role'>;

export interface WorkWithAuthors extends Work {
  authors: CatalogAuthor[];
}

export interface EditionDetails extends Edition {
  contributors: Contributor[];
  work: WorkWithAuthors;
}

export interface WorkDetails extends WorkWithAuthors {
  editions: (Edition & { contributors: Contributor[] })[];
}

/** How many merge hops `getWork` follows before giving up: a longer chain means broken data. */
const maxMergeHops = 5;

const authorColumns = 'work_authors(position, author:authors(id, name, sort_name, alternate_names))';
const contributorColumns = 'contributors(name, role, position)';

type AuthorLinks = { position: number; author: CatalogAuthor | null }[];
type ContributorRows = (Contributor & { position: number })[];

function toAuthors(links: AuthorLinks): CatalogAuthor[] {
  return [...links].sort((a, b) => a.position - b.position).flatMap((link) => (link.author ? [link.author] : []));
}

function toContributors(rows: ContributorRows): Contributor[] {
  return [...rows].sort((a, b) => a.position - b.position).map(({ name, role }) => ({ name, role }));
}

/**
 * The edition with this ISBN, in any form, with its work, authors and contributors.
 * `null` when the ISBN is invalid, unknown, or the query fails.
 */
export async function getEditionByIsbn(client: LibrescaClient, isbn: string): Promise<EditionDetails | null> {
  const isbn13 = toIsbn13(isbn);
  if (!isbn13) return null;

  const { data, error } = await client
    .from('editions')
    .select(`*, ${contributorColumns}, work:works!inner(*, ${authorColumns})`)
    .eq('isbn13', isbn13)
    .maybeSingle();
  if (error || !data) return null;

  const { contributors, work, ...edition } = data;
  const { work_authors, ...workColumns } = work;
  return {
    ...edition,
    contributors: toContributors(contributors),
    work: { ...workColumns, authors: toAuthors(work_authors) },
  };
}

/**
 * A work with its authors and editions. A merged work resolves to the work that
 * replaced it, so old links keep working. `null` when not found or the query fails.
 */
export async function getWork(client: LibrescaClient, workId: string): Promise<WorkDetails | null> {
  let id = workId;
  for (let hop = 0; hop <= maxMergeHops; hop++) {
    const { data, error } = await client
      .from('works')
      .select(`*, ${authorColumns}, editions(*, ${contributorColumns})`)
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;

    if (data.merged_into) {
      id = data.merged_into;
      continue;
    }

    const { work_authors, editions, ...work } = data;
    return {
      ...work,
      authors: toAuthors(work_authors),
      editions: editions.map(({ contributors, ...edition }) => ({
        ...edition,
        contributors: toContributors(contributors),
      })),
    };
  }
  return null;
}

/**
 * Works matching a title, an edition title or an author name, ignoring case and accents,
 * best matches first. Queries shorter than two characters return nothing.
 */
export async function searchWorks(client: LibrescaClient, query: string, maxResults = 20): Promise<WorkWithAuthors[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await client
    .rpc('search_works', { query, max_results: maxResults })
    .select(`*, ${authorColumns}`);
  if (error || !data) return [];
  return data.map(({ work_authors, ...work }) => ({ ...work, authors: toAuthors(work_authors) }));
}

/** Catalog works reached through identifiers: identifier value to work id. */
export interface WorksByIdentifier {
  openLibraryWorks: Record<string, string>;
  isbns: Record<string, string>;
}

/** ISBNs per query: a whole Open Library work can list hundreds, and each goes in the URL. */
const isbnsPerQuery = 150;

type LinkedWork = { id: string; merged_into: string | null };

/** One merge hop: enough for search suggestions, `getWork` follows the full chain. */
const liveWorkId = (work: LinkedWork) => work.merged_into ?? work.id;

/**
 * The catalog works that share an identifier with search results: an Open Library work id
 * or the ISBN of one of their editions. Invalid values are ignored; a failed query only
 * means fewer matches.
 */
export async function findWorksByIdentifiers(
  client: LibrescaClient,
  identifiers: { openLibraryWorkIds: string[]; isbns: string[] },
): Promise<WorksByIdentifier> {
  const found: WorksByIdentifier = { openLibraryWorks: {}, isbns: {} };
  const workIds = [...new Set(identifiers.openLibraryWorkIds.filter((id) => /^OL\d+W$/.test(id)))];
  const isbns = [...new Set(identifiers.isbns.flatMap((isbn) => toIsbn13(isbn) ?? []))];

  const queries: PromiseLike<void>[] = [];
  if (workIds.length > 0) {
    queries.push(
      client
        .from('external_ids')
        .select('value, work:works!inner(id, merged_into)')
        .eq('source', 'openlibrary')
        .in('value', workIds)
        .then(({ data }) => {
          for (const row of data ?? []) found.openLibraryWorks[row.value] = liveWorkId(row.work);
        }),
    );
  }
  for (let start = 0; start < isbns.length; start += isbnsPerQuery) {
    queries.push(
      client
        .from('editions')
        .select('isbn13, work:works!inner(id, merged_into)')
        .in('isbn13', isbns.slice(start, start + isbnsPerQuery))
        .then(({ data }) => {
          for (const row of data ?? []) if (row.isbn13) found.isbns[row.isbn13] = liveWorkId(row.work);
        }),
    );
  }
  await Promise.all(queries);
  return found;
}

/**
 * Catalog authors with one of these Open Library author ids, by id: a new work by the
 * same person reuses the author instead of creating a twin. Merged authors resolve
 * to the one that replaced them (one hop). A failed query only means no reuse.
 */
export async function findAuthorsByOpenLibraryIds(
  client: LibrescaClient,
  openLibraryIds: string[],
): Promise<Record<string, string>> {
  const ids = [...new Set(openLibraryIds.filter((id) => /^OL\d+A$/.test(id)))];
  if (ids.length === 0) return {};
  const { data } = await client
    .from('external_ids')
    .select('value, author:authors!inner(id, merged_into)')
    .eq('source', 'openlibrary')
    .in('value', ids);
  return Object.fromEntries((data ?? []).map((row) => [row.value, row.author.merged_into ?? row.author.id]));
}

export type CreateEditionResult =
  | { ok: true; workId: string; editionId: string }
  | { ok: false; reason: 'invalid'; issues: CatalogIssue[] }
  /**
   * `duplicate_isbn`: the ISBN is already in the catalog. `not_found`: the work or an author
   * does not exist or was merged. `rejected`: a database constraint the domain did not foresee.
   */
  | { ok: false; reason: CreateEditionFailure };

type CreateEditionFailure = 'duplicate_isbn' | 'not_found' | 'forbidden' | 'rejected' | 'failed';

/** Postgres error codes raised by public.create_edition. */
const failureReasons: Record<string, CreateEditionFailure> = {
  '23505': 'duplicate_isbn',
  P0002: 'not_found',
  '42501': 'forbidden',
  '23514': 'rejected',
  '23502': 'rejected',
  '22023': 'rejected',
  '22P02': 'rejected',
};

/**
 * Adds an edition, with a new work or an existing one, after validating it with the domain rules.
 * The database checks again and runs everything in one transaction.
 */
export async function createEdition(client: LibrescaClient, input: CatalogEntryInput): Promise<CreateEditionResult> {
  const validation = validateCatalogEntry(input);
  if (!validation.ok) return { ok: false, reason: 'invalid', issues: validation.issues };

  // The payload is plain JSON built by the domain; interfaces just lack Json's index signature.
  const { data, error } = await client.rpc('create_edition', { entry: validation.entry as unknown as Json });
  if (error) return { ok: false, reason: failureReasons[error.code] ?? 'failed' };

  const ids = data as { work_id?: unknown; edition_id?: unknown } | null;
  if (typeof ids?.work_id !== 'string' || typeof ids.edition_id !== 'string') return { ok: false, reason: 'failed' };
  return { ok: true, workId: ids.work_id, editionId: ids.edition_id };
}

export type CatalogEditResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; issues: CatalogIssue[] }
  /** `not_found`: the work, edition or an author is gone or was merged. `forbidden`: account not active. */
  | { ok: false; reason: 'not_found' | 'forbidden' | 'rejected' | 'failed' };

function editFailure(code: string | undefined): CatalogEditResult {
  const reason = code ? failureReasons[code] : undefined;
  if (reason === 'not_found' || reason === 'forbidden' || reason === 'rejected') return { ok: false, reason };
  return { ok: false, reason: 'failed' };
}

/**
 * Corrects a work of the shared catalog: title, authors, first year, description. The
 * database marks the changed fields as written by a person. Authors whose name did not
 * change keep their id (`authorsForEdit`).
 */
export async function updateWork(
  client: LibrescaClient,
  workId: string,
  input: WorkEditInput,
): Promise<CatalogEditResult> {
  const validation = validateWorkEdit(input);
  if (!validation.ok) return { ok: false, reason: 'invalid', issues: validation.issues };
  const { error } = await client.rpc('update_work', {
    target_work_id: workId,
    changes: validation.payload as unknown as Json,
  });
  return error ? editFailure(error.code) : { ok: true };
}

/** Corrects an edition: its details, its translators and, with a new photo, its cover. */
export async function updateEdition(
  client: LibrescaClient,
  editionId: string,
  input: EditionEditInput,
): Promise<CatalogEditResult> {
  const validation = validateEditionEdit(input);
  if (!validation.ok) return { ok: false, reason: 'invalid', issues: validation.issues };
  const { error } = await client.rpc('update_edition', {
    target_edition_id: editionId,
    changes: validation.payload as unknown as Json,
  });
  return error ? editFailure(error.code) : { ok: true };
}
