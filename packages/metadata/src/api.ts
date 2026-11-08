import type { EditionProposal, SourceName, SourceStatus } from './types';

/**
 * Body of `GET /api/v1/books/isbn/{isbn}`, shared by the web app and a future mobile app.
 * `Edition` is the catalog edition type of the caller (`EditionDetails` in `@libresca/data`).
 *
 * - `catalog` (200): the edition is already in the catalog; no source was asked.
 * - `proposal` (200): not in the catalog; the merged card from the sources.
 * - `not_found` (404): no source has it; the client opens manual entry.
 */
export type IsbnLookupResponse<Edition = unknown> =
  | { status: 'catalog'; isbn13: string; edition: Edition }
  | { status: 'proposal'; isbn13: string; sources: Record<SourceName, SourceStatus>; proposal: EditionProposal }
  | { status: 'not_found'; isbn13: string; sources: Record<SourceName, SourceStatus> };

/** Error bodies: 400 `invalid_isbn`, 401 `unauthorized`, 403 `inactive`, 429 `rate_limited`. */
export interface ApiError {
  error: 'invalid_isbn' | 'unauthorized' | 'inactive' | 'rate_limited';
}
