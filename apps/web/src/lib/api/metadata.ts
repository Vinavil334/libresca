import { type HttpClient, createMetadataHttpClient, createWindowLimiter } from '@libresca/metadata';
import { createHash } from 'node:crypto';

/** Used in the Open Library User-Agent when OPEN_LIBRARY_CONTACT is not set. */
const fallbackContact = 'https://github.com/Vinavil334/libresca';

// One client per server instance, so pacing and cache are shared by its requests.
let client: HttpClient | undefined;

export function metadataHttp(): HttpClient {
  client ??= createMetadataHttpClient(process.env.OPEN_LIBRARY_CONTACT?.trim() || fallbackContact);
  return client;
}

/** Server-only. Without it Google Books is skipped. */
export function googleBooksKey(): string | undefined {
  return process.env.GOOGLE_BOOKS_API_KEY?.trim() || undefined;
}

/** Opaque per-user id for Google's per-user quota: a hash, never the user id itself. */
export function quotaUserFor(userId: string): string {
  return createHash('sha256').update(`libresca:${userId}`).digest('hex').slice(0, 32);
}

/**
 * External lookups per account and minute, on this instance. Well below Google's
 * 100 per minute, and enough for a person scanning a shelf.
 */
export const externalLookups = createWindowLimiter(30, 60_000);
