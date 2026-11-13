import type { LibrescaClient } from './client';
import type { Json } from './database.types';

/** A cached response of an open source: data, or a firm "not found". */
export type CachedResponse = { status: 'ok'; data: unknown } | { status: 'not_found' };

/**
 * The shared cache of the open metadata sources (Open Library, OPAC SBN), in Postgres.
 * Shaped like `SharedCache` in `packages/metadata`. The database refuses other hosts and
 * accounts that are not active; failures read as a miss.
 */
export function createMetadataCache(client: LibrescaClient) {
  return {
    async get(url: string): Promise<CachedResponse | null> {
      const { data, error } = await client.rpc('metadata_cache_get', { cache_url: url });
      if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null;
      const status = (data as { status?: unknown }).status;
      return status === 'ok' || status === 'not_found' ? (data as CachedResponse) : null;
    },
    async set(url: string, response: { status: string; data?: unknown }, ttlSeconds: number): Promise<void> {
      if (response.status !== 'ok' && response.status !== 'not_found') return;
      await client.rpc('metadata_cache_put', {
        cache_url: url,
        cache_response: response as unknown as Json,
        ttl_seconds: ttlSeconds,
      });
    },
  };
}
