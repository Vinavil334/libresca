import { type TanaBook, type TanaWork, buildTana } from '@libresca/domain';

import type { LibrescaClient } from './client';

/** PostgREST returns at most this many rows per request (`max_rows` in supabase/config.toml). */
const pageSize = 1000;

const workColumns =
  'work:works!inner(id, title, work_authors(position, author:authors(name, sort_name)), editions(id, cover_source, cover_id, cover_path))';

interface WorkRow {
  id: string;
  title: string;
  work_authors: { position: number; author: { name: string; sort_name: string | null } | null }[];
  editions: TanaWork['editions'];
}

function toWork(row: WorkRow): TanaWork {
  return {
    id: row.id,
    title: row.title,
    authors: [...row.work_authors]
      .sort((a, b) => a.position - b.position)
      .flatMap((link) => (link.author ? [link.author] : [])),
    editions: row.editions,
  };
}

/** Reads every page of a query, so a library larger than one page is never cut short. */
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

/**
 * The caller's Tana: one book per work they own, read, want to read or keep on a shelf.
 * RLS returns only the caller's rows. `null` when a query fails, so the page can tell an
 * error from an empty Tana.
 */
export async function listOwnTana(client: LibrescaClient): Promise<TanaBook[] | null> {
  const [copies, readings, shelfItems] = await Promise.all([
    readAll((from, to) =>
      client
        .from('copies')
        .select(`is_lendable, created_at, edition:editions!inner(id, ${workColumns})`)
        .order('id')
        .range(from, to),
    ),
    readAll((from, to) =>
      client
        .from('readings')
        .select(`status, started_on, finished_on, rating_half, edition_id, created_at, ${workColumns}`)
        .order('id')
        .range(from, to),
    ),
    readAll((from, to) =>
      client
        .from('shelf_items')
        .select(`shelf_id, created_at, ${workColumns}`)
        .order('shelf_id')
        .order('work_id')
        .range(from, to),
    ),
  ]);
  if (!copies || !readings || !shelfItems) return null;

  return buildTana(
    copies.map(({ edition, ...copy }) => ({ ...copy, edition_id: edition.id, work: toWork(edition.work) })),
    readings.map(({ work, ...reading }) => ({ ...reading, work: toWork(work) })),
    shelfItems.map(({ work, ...item }) => ({ ...item, work: toWork(work) })),
  );
}
