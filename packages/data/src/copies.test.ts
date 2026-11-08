import { describe, expect, it, vi } from 'vitest';

import type { LibrescaClient } from './client';
import { addCopy, deleteCopy, listOwnCopies, updateCopy } from './copies';

type Result = { data: unknown; error: unknown };

/** Records calls on a query builder and resolves to one queued result. */
function fakeClient(result: Result) {
  const calls: [string, unknown[]][] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
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
const row = { id: 'c1', edition_id: 'e1', owner_id: 'u1', is_lendable: true, notes: null };

describe('listOwnCopies', () => {
  it('filters by the work through the edition, oldest first', async () => {
    const { client, calls } = fakeClient({ data: [row], error: null });
    expect(await listOwnCopies(client, 'w1')).toEqual([row]);
    expect(calls).toContainEqual(['eq', ['edition.work_id', 'w1']]);
    expect(calls).toContainEqual(['order', ['created_at', { ascending: true }]]);
  });

  it('is empty when the query fails', async () => {
    const { client } = fakeClient({ data: null, error: { code: '500' } });
    expect(await listOwnCopies(client, 'w1')).toEqual([]);
  });
});

describe('addCopy', () => {
  it('validates before writing', async () => {
    const { client } = fakeClient({ data: row, error: null });
    expect(await addCopy(client, 'e1', { acquiredOn: '2030-01-01' }, today)).toEqual({
      ok: false,
      reason: 'invalid',
      issues: [{ path: 'acquiredOn', code: 'future_date' }],
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('inserts the cleaned copy', async () => {
    const { client, calls } = fakeClient({ data: row, error: null });
    expect(await addCopy(client, 'e1', { isLendable: false, notes: ' nota ' }, today)).toEqual({ ok: true, copy: row });
    expect(calls).toContainEqual([
      'insert',
      [{ edition_id: 'e1', is_lendable: false, acquired_on: null, notes: 'nota' }],
    ]);
  });

  it('maps refusals', async () => {
    expect(await addCopy(fakeClient({ data: null, error: { code: '42501' } }).client, 'e1', {}, today)).toEqual({
      ok: false,
      reason: 'forbidden',
    });
    expect(await addCopy(fakeClient({ data: null, error: { code: '23503' } }).client, 'e1', {}, today)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });
});

describe('updateCopy', () => {
  it('updates the copy by id and treats a hidden copy as not found', async () => {
    const { client, calls } = fakeClient({ data: row, error: null });
    expect(await updateCopy(client, 'c1', { visibility: 'private' }, today)).toEqual({ ok: true, copy: row });
    expect(calls).toContainEqual(['eq', ['id', 'c1']]);

    const hidden = fakeClient({ data: null, error: { code: 'PGRST116' } });
    expect(await updateCopy(hidden.client, 'c2', {}, today)).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('deleteCopy', () => {
  it('says whether a copy was removed', async () => {
    expect(await deleteCopy(fakeClient({ data: [{ id: 'c1' }], error: null }).client, 'c1')).toBe(true);
    expect(await deleteCopy(fakeClient({ data: [], error: null }).client, 'c2')).toBe(false);
  });
});
