import { describe, expect, it, vi } from 'vitest';

import type { LibrescaClient } from './client';
import { type CoverSources, runCoverFillStep } from './cover-fill';

const edition = (id: string, cover: string | null = null) => ({
  id,
  cover_source: cover ? 'openlibrary' : null,
  cover_id: cover,
  cover_path: null,
});
const work = (id: string, editions: ReturnType<typeof edition>[]) => ({
  id,
  title: id,
  work_authors: [],
  editions,
});

/** Three books without cover (e1, e2, e3, one without ISBN) and one with a cover. */
const readings = [
  { status: 'read', edition_id: 'e1', created_at: '2026-01-01', work: work('w1', [edition('e1')]) },
  { status: 'read', edition_id: 'e2', created_at: '2026-01-01', work: work('w2', [edition('e2')]) },
  { status: 'read', edition_id: 'e3', created_at: '2026-01-01', work: work('w3', [edition('e3')]) },
  { status: 'read', edition_id: 'e4', created_at: '2026-01-01', work: work('w4', [edition('e4', '42')]) },
];
const isbns: Record<string, string | null> = { e1: '9788804668237', e2: null, e3: '9788845292613' };

function fakeClient(options: { editionsFail?: boolean } = {}) {
  const rpc = vi.fn(async () => ({ data: true, error: null }));
  const from = vi.fn((table: string) => {
    let ids: string[] = [];
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'order', 'range']) chain[method] = () => chain;
    chain.in = (_column: string, values: string[]) => {
      ids = values;
      return chain;
    };
    chain.then = (resolve: (value: unknown) => unknown) => {
      if (table === 'readings') return Promise.resolve({ data: readings, error: null }).then(resolve);
      if (table === 'editions') {
        const result = options.editionsFail
          ? { data: null, error: { code: '500' } }
          : { data: ids.map((id) => ({ id, isbn13: isbns[id] ?? null })), error: null };
        return Promise.resolve(result).then(resolve);
      }
      return Promise.resolve({ data: [], error: null }).then(resolve);
    };
    return chain;
  });
  return { client: { from, rpc } as unknown as LibrescaClient, rpc };
}

const sources = (found: Record<string, boolean>): CoverSources & { coverFor: ReturnType<typeof vi.fn> } => ({
  coverFor: vi.fn(async (isbn13: string, allowGoogle: boolean) =>
    found[isbn13] && allowGoogle
      ? { cover: { source: 'googlebooks' as const, id: `vol-${isbn13.slice(-4)}` }, usedGoogle: true }
      : { cover: null, usedGoogle: allowGoogle },
  ),
});

describe('runCoverFillStep', () => {
  it('looks at every book without cover and fills what the sources have', async () => {
    const { client, rpc } = fakeClient();
    const covers = sources({ '9788804668237': true });
    const progress = await runCoverFillStep(client, covers, { budgetMs: 10_000 });

    expect(progress).toEqual({ checked: 3, found: 1, remaining: 0, next: null, googleCalls: 2 });
    expect(covers.coverFor).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith('fill_edition_cover', {
      target_edition_id: 'e1',
      new_cover_source: 'googlebooks',
      new_cover_id: 'vol-8237',
    });
  });

  it('stops when the time is up and hands back a cursor', async () => {
    const { client } = fakeClient();
    let clock = 0;
    const progress = await runCoverFillStep(client, sources({}), {
      budgetMs: 5,
      now: () => (clock += 10),
    });
    expect(progress).toMatchObject({ checked: 1, remaining: 2, next: 'e1' });

    const second = await runCoverFillStep(client, sources({}), { budgetMs: 10_000, after: 'e1' });
    expect(second).toMatchObject({ checked: 2, remaining: 0, next: null });
  });

  it('keeps Google Books out once the run reached the daily cap', async () => {
    const { client } = fakeClient();
    const covers = sources({ '9788804668237': true });
    const progress = await runCoverFillStep(client, covers, { budgetMs: 10_000, googleCalls: 300 });
    expect(progress).toMatchObject({ found: 0, googleCalls: 300 });
    expect(covers.coverFor).toHaveBeenCalledWith('9788804668237', false);
  });

  it('fails when the cover cannot be saved, instead of reporting no cover', async () => {
    const { client, rpc } = fakeClient();
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } } as never);
    expect(await runCoverFillStep(client, sources({ '9788804668237': true }), { budgetMs: 10_000 })).toBeNull();
  });

  it('fails rather than handing back the same cursor', async () => {
    const { client } = fakeClient({ editionsFail: true });
    expect(await runCoverFillStep(client, sources({}), { budgetMs: 10_000 })).toBeNull();
  });
});
