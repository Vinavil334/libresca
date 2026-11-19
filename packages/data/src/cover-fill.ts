import type { LibrescaClient } from './client';
import { googleDailyCap } from './imports';
import { listOwnEditionsWithoutCover } from './tana';

/**
 * Covers found later (F1.8 follow-up): walks the caller's books shown without a cover, in
 * steps, and fills the cover of each edition a source has one for. The client calls a step
 * again with `next` until it is `null`; the cursor is the last edition id looked at, so
 * every edition is asked once per run even when no source has its cover.
 */

/** What a step needs from the sources, provided by `packages/metadata` (`lookupCover`). */
export interface CoverSources {
  coverFor(
    isbn13: string,
    allowGoogle: boolean,
  ): Promise<{ cover: { source: 'openlibrary' | 'googlebooks'; id: string } | null; usedGoogle: boolean }>;
}

export interface CoverFillProgress {
  /** Editions looked at by this step. */
  checked: number;
  /** Covers filled by this step. */
  found: number;
  /** Editions still to look at in this run. */
  remaining: number;
  /** The cursor for the next step, `null` when the run is over. */
  next: string | null;
  /** Google Books calls made in this run so far, sent back by the client. */
  googleCalls: number;
}

export interface CoverFillOptions {
  /** The `next` of the previous step; absent for the first one. */
  after?: string | null;
  googleCalls?: number;
  /** A step stops after this long, to fit in one serverless call. */
  budgetMs: number;
  now?: () => number;
}

const batchSize = 20;

/** One step of the run. `null` when the Tana or the catalog cannot be read. */
export async function runCoverFillStep(
  client: LibrescaClient,
  sources: CoverSources,
  options: CoverFillOptions,
): Promise<CoverFillProgress | null> {
  const now = options.now ?? Date.now;
  const started = now();
  const all = await listOwnEditionsWithoutCover(client);
  if (!all) return null;

  const after = options.after ?? null;
  const pending = after ? all.filter((id) => id > after) : all;
  let googleCalls = Math.max(0, Math.trunc(options.googleCalls ?? 0));
  let checked = 0;
  let found = 0;
  let cursor = after;

  steps: for (let offset = 0; offset < pending.length; offset += batchSize) {
    const batch = pending.slice(offset, offset + batchSize);
    const { data, error } = await client.from('editions').select('id, isbn13').in('id', batch);
    // Without the ISBNs the step cannot move on: failing beats sending back the same cursor.
    if (error || !data) return null;
    const isbns = new Map(data.map((edition) => [edition.id, edition.isbn13]));

    for (const id of batch) {
      if (checked > 0 && now() - started > options.budgetMs) break steps;
      const isbn13 = isbns.get(id);
      if (isbn13) {
        const result = await sources.coverFor(isbn13, googleCalls < googleDailyCap);
        if (result.usedGoogle) googleCalls += 1;
        if (result.cover) {
          const { data: filled, error: fillError } = await client.rpc('fill_edition_cover', {
            target_edition_id: id,
            new_cover_source: result.cover.source,
            new_cover_id: result.cover.id,
          });
          // A database that cannot save covers must not look like sources without covers.
          if (fillError) return null;
          if (filled === true) found += 1;
        }
      }
      checked += 1;
      cursor = id;
    }
  }

  const remaining = cursor ? pending.filter((id) => id > cursor).length : pending.length;
  return { checked, found, remaining, next: remaining > 0 ? cursor : null, googleCalls };
}
