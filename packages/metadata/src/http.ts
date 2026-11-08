/**
 * Small JSON client for the metadata sources: per-host pacing, short timeouts and a
 * bounded in-memory cache. On serverless hosts each instance has its own state, which
 * is enough for a private beta; a shared cache waits for the Goodreads import (F1.8).
 */

export type HttpResult = { status: 'ok'; data: unknown } | { status: 'not_found' } | { status: 'unavailable' };

/**
 * `fixed`: keep for the given time (open sources). `header`: keep only as long as the
 * response's Cache-Control allows, as the Google APIs terms require.
 */
export type CachePolicy = { kind: 'fixed'; ttlMs: number } | { kind: 'header' } | { kind: 'none' };

export interface HttpClientOptions {
  userAgent: string;
  fetch?: typeof fetch;
  /** Abort a request after this long. */
  timeoutMs?: number;
  /** Minimum gap between two requests to the same host. Open Library: 334 ms (3/s); SBN: 1000 ms. */
  minIntervalMs?: Record<string, number>;
  maxCacheEntries?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface HttpClient {
  getJson(url: string, cache: CachePolicy): Promise<HttpResult>;
}

/** Query parameters that must never reach a cache key or a log: secrets and per-user ids. */
const privateParams = ['key', 'quotaUser'];

function cacheKey(url: string): string {
  const parsed = new URL(url);
  for (const param of privateParams) parsed.searchParams.delete(param);
  return parsed.toString();
}

/** Seconds allowed by `Cache-Control: max-age`, or 0 when caching is not allowed. */
export function maxAgeSeconds(header: string | null): number {
  if (!header || /no-store|no-cache/i.test(header)) return 0;
  const match = /max-age=(\d+)/i.exec(header);
  return match ? Number(match[1]) : 0;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const {
    userAgent,
    fetch: fetchImpl = globalThis.fetch,
    timeoutMs = 5000,
    minIntervalMs = {},
    maxCacheEntries = 500,
    now = Date.now,
    sleep = defaultSleep,
  } = options;

  const cache = new Map<string, { expires: number; result: HttpResult }>();
  const nextSlot = new Map<string, number>();

  function remember(key: string, result: HttpResult, ttlMs: number) {
    if (ttlMs <= 0) return;
    cache.delete(key);
    cache.set(key, { expires: now() + ttlMs, result });
    // Map keeps insertion order: the first key is the oldest.
    while (cache.size > maxCacheEntries) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  /** Reserves the next free slot for the host; false when the wait would exceed the timeout. */
  async function pace(host: string): Promise<boolean> {
    const interval = minIntervalMs[host] ?? 0;
    if (interval <= 0) return true;
    const current = now();
    const slot = Math.max(current, nextSlot.get(host) ?? 0);
    const wait = slot - current;
    if (wait > timeoutMs) return false;
    nextSlot.set(host, slot + interval);
    if (wait > 0) await sleep(wait);
    return true;
  }

  return {
    async getJson(url, policy) {
      const key = cacheKey(url);
      const hit = cache.get(key);
      if (hit && hit.expires > now()) return hit.result;
      if (hit) cache.delete(key);

      if (!(await pace(new URL(url).host))) return { status: 'unavailable' };

      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: { 'User-Agent': userAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        return { status: 'unavailable' };
      }

      let result: HttpResult;
      if (response.status === 404) {
        result = { status: 'not_found' };
      } else if (!response.ok) {
        return { status: 'unavailable' };
      } else {
        try {
          result = { status: 'ok', data: await response.json() };
        } catch {
          return { status: 'unavailable' };
        }
      }

      const ttlMs =
        policy.kind === 'fixed'
          ? policy.ttlMs
          : policy.kind === 'header'
            ? maxAgeSeconds(response.headers.get('cache-control')) * 1000
            : 0;
      remember(key, result, ttlMs);
      return result;
    },
  };
}
