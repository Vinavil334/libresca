import { describe, expect, it, vi } from 'vitest';

import { type HttpResult, type SharedCache, createHttpClient, maxAgeSeconds } from './http';

function json(body: unknown, init: { status?: number; cacheControl?: string } = {}): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (init.cacheControl) headers.set('cache-control', init.cacheControl);
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

function setup(responses: (() => Response | Promise<Response>)[], minIntervalMs: Record<string, number> = {}) {
  let clock = 1_000_000;
  const slept: number[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return next();
  });
  const client = createHttpClient({
    userAgent: 'Libresca/test (contact)',
    fetch: fetchMock as unknown as typeof fetch,
    timeoutMs: 2000,
    minIntervalMs,
    now: () => clock,
    // Records the wait without moving the clock: concurrent callers see the same "now".
    sleep: async (ms) => {
      slept.push(ms);
    },
  });
  return { client, fetchMock, slept, advance: (ms: number) => (clock += ms) };
}

describe('maxAgeSeconds', () => {
  it('reads max-age and refuses no-store or no-cache', () => {
    expect(maxAgeSeconds('private, max-age=300')).toBe(300);
    expect(maxAgeSeconds('no-store')).toBe(0);
    expect(maxAgeSeconds('no-cache, max-age=60')).toBe(0);
    expect(maxAgeSeconds(null)).toBe(0);
  });
});

describe('createHttpClient', () => {
  it('sends the User-Agent and parses JSON', async () => {
    const { client, fetchMock } = setup([() => json({ ok: 1 })]);
    expect(await client.getJson('https://openlibrary.org/a', { kind: 'none' })).toEqual({
      status: 'ok',
      data: { ok: 1 },
    });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('User-Agent')).toBe('Libresca/test (contact)');
  });

  it('maps 404 to not_found, other failures to unavailable', async () => {
    const { client } = setup([
      () => json({}, { status: 404 }),
      () => json({}, { status: 503 }),
      () => {
        throw new Error('network down');
      },
      () => new Response('not json', { status: 200 }),
    ]);
    const get = () => client.getJson('https://openlibrary.org/a', { kind: 'none' });
    expect(await get()).toEqual({ status: 'not_found' });
    expect(await get()).toEqual({ status: 'unavailable' });
    expect(await get()).toEqual({ status: 'unavailable' });
    expect(await get()).toEqual({ status: 'unavailable' });
  });

  it('keeps open data for the fixed time', async () => {
    const { client, fetchMock, advance } = setup([() => json(1), () => json(2)]);
    const get = () => client.getJson('https://openlibrary.org/a', { kind: 'fixed', ttlMs: 1000 });
    expect(await get()).toEqual({ status: 'ok', data: 1 });
    expect(await get()).toEqual({ status: 'ok', data: 1 });
    advance(1001);
    expect(await get()).toEqual({ status: 'ok', data: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps Google Books data only as long as its headers allow', async () => {
    const { client, fetchMock, advance } = setup([
      () => json(1, { cacheControl: 'private, max-age=10' }),
      () => json(2),
      () => json(3),
    ]);
    const get = () => client.getJson('https://www.googleapis.com/books/v1/volumes?q=x', { kind: 'header' });
    expect(await get()).toEqual({ status: 'ok', data: 1 });
    expect(await get()).toEqual({ status: 'ok', data: 1 });
    advance(10_001);
    expect(await get()).toEqual({ status: 'ok', data: 2 });
    // No Cache-Control on the second answer: not kept.
    expect(await get()).toEqual({ status: 'ok', data: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('reads and fills a shared cache for open data only, and survives its failures', async () => {
    const store = new Map<string, HttpResult>();
    const shared: SharedCache = {
      get: async (url) => store.get(url) ?? null,
      set: async (url, result, ttl) => {
        expect(ttl).toBe(86400);
        store.set(url, result);
      },
    };
    const open = { kind: 'fixed', ttlMs: 1000, sharedTtlSeconds: 86400 } as const;
    const { client, fetchMock } = setup([() => json({ a: 1 }), () => json({ b: 2 })]);

    expect(await client.getJson('https://openlibrary.org/a', open, shared)).toEqual({ status: 'ok', data: { a: 1 } });
    expect(store.get('https://openlibrary.org/a')).toEqual({ status: 'ok', data: { a: 1 } });

    // Another instance, empty memory: the shared cache answers without a request.
    const other = setup([]);
    expect(await other.client.getJson('https://openlibrary.org/a', open, shared)).toEqual({
      status: 'ok',
      data: { a: 1 },
    });
    expect(other.fetchMock).not.toHaveBeenCalled();

    // Google Books data is never shared; a broken shared cache is just skipped.
    await client.getJson('https://www.googleapis.com/b', { kind: 'header' }, shared);
    expect(store.has('https://www.googleapis.com/b')).toBe(false);
    const broken: SharedCache = {
      get: () => Promise.reject(new Error('down')),
      set: () => Promise.reject(new Error('down')),
    };
    const third = setup([() => json({ c: 3 })]);
    expect(await third.client.getJson('https://openlibrary.org/c', open, broken)).toEqual({
      status: 'ok',
      data: { c: 3 },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ignores the key and the quota user in the cache key', async () => {
    const { client, fetchMock } = setup([() => json(1)]);
    const policy = { kind: 'fixed', ttlMs: 1000 } as const;
    await client.getJson('https://www.googleapis.com/books/v1/volumes?q=x&key=a&quotaUser=u1', policy);
    expect(await client.getJson('https://www.googleapis.com/books/v1/volumes?q=x&key=b&quotaUser=u2', policy)).toEqual({
      status: 'ok',
      data: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('paces requests to the same host', async () => {
    const { client, slept } = setup([() => json(1), () => json(2), () => json(3)], { 'opac.sbn.it': 1000 });
    await Promise.all([
      client.getJson('https://opac.sbn.it/a', { kind: 'none' }),
      client.getJson('https://opac.sbn.it/b', { kind: 'none' }),
      client.getJson('https://openlibrary.org/c', { kind: 'none' }),
    ]);
    expect(slept).toEqual([1000]);
  });

  it('gives up instead of queueing past the timeout', async () => {
    const { client, fetchMock } = setup([() => json(1), () => json(2), () => json(3)], { 'opac.sbn.it': 1500 });
    const results = await Promise.all(
      ['a', 'b', 'c'].map((path) => client.getJson(`https://opac.sbn.it/${path}`, { kind: 'none' })),
    );
    expect(results.map((r) => r.status)).toEqual(['ok', 'ok', 'unavailable']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
