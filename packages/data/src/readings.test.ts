import { describe, expect, it, vi } from 'vitest';

import type { LibrescaClient } from './client';
import { addReading, deleteReading, listOwnReadings, updateReading } from './readings';

type Result = { data: unknown; error: unknown };

/** Records calls on a query builder and resolves to one result. */
function fakeClient(result: Result) {
  const calls: [string, unknown[]][] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'insert', 'update', 'delete', 'eq']) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return chain;
    };
  }
  chain.single = async () => result;
  chain.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
  const client = { from: vi.fn(() => chain) } as unknown as LibrescaClient;
  return { client, calls };
}

const today = '2026-11-08';
const row = (id: string, status: string, finished_on: string | null, created: string) => ({
  id,
  status,
  started_on: null,
  finished_on,
  created_at: `${created}T10:00:00Z`,
});

describe('listOwnReadings', () => {
  it('returns the open reading first, then the most recent', async () => {
    const old = row('r1', 'read', '2019-01-01', '2026-01-01');
    const open = row('r2', 'want', null, '2026-02-01');
    const { client, calls } = fakeClient({ data: [old, open], error: null });
    expect(await listOwnReadings(client, 'w1')).toEqual([open, old]);
    expect(calls).toContainEqual(['eq', ['work_id', 'w1']]);
  });

  it('is empty when the query fails', async () => {
    expect(await listOwnReadings(fakeClient({ data: null, error: { code: '500' } }).client, 'w1')).toEqual([]);
  });
});

describe('addReading', () => {
  it('validates before writing', async () => {
    const { client } = fakeClient({ data: null, error: null });
    expect(await addReading(client, 'w1', { status: 'read', ratingHalf: 12 }, today)).toEqual({
      ok: false,
      reason: 'invalid',
      issues: [{ path: 'ratingHalf', code: 'invalid_rating' }],
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('inserts the normalised reading', async () => {
    const saved = row('r1', 'want', null, '2026-11-08');
    const { client, calls } = fakeClient({ data: saved, error: null });
    expect(await addReading(client, 'w1', { status: 'want', startedOn: '2024-01-01' }, today)).toEqual({
      ok: true,
      reading: saved,
    });
    expect(calls).toContainEqual([
      'insert',
      [{ work_id: 'w1', status: 'want', started_on: null, finished_on: null, rating_half: null, review: null }],
    ]);
  });

  it('says when the book already has an open reading', async () => {
    const { client } = fakeClient({ data: null, error: { code: '23505' } });
    expect(await addReading(client, 'w1', { status: 'reading' }, today)).toEqual({
      ok: false,
      reason: 'already_open',
    });
  });
});

describe('updateReading', () => {
  it('updates by id and maps a hidden reading to not found', async () => {
    const saved = row('r1', 'read', '2026-11-01', '2026-10-01');
    const { client, calls } = fakeClient({ data: saved, error: null });
    expect(
      await updateReading(client, 'r1', { status: 'read', finishedOn: '2026-11-01', ratingHalf: 8 }, today),
    ).toEqual({ ok: true, reading: saved });
    expect(calls).toContainEqual(['eq', ['id', 'r1']]);
    expect(
      await updateReading(
        fakeClient({ data: null, error: { code: 'PGRST116' } }).client,
        'r2',
        { status: 'read' },
        today,
      ),
    ).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('deleteReading', () => {
  it('says whether a reading was removed', async () => {
    expect(await deleteReading(fakeClient({ data: [{ id: 'r1' }], error: null }).client, 'r1')).toBe(true);
    expect(await deleteReading(fakeClient({ data: [], error: null }).client, 'r2')).toBe(false);
  });
});
