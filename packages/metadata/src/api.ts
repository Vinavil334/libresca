import type { MatchedCandidate } from './catalog-match';
import type { SearchSource } from './search';
import type { EditionProposal, SourceName, SourceStatus } from './types';

/**
 * Body of `GET /api/v1/books/isbn/{isbn}`, shared by the web app and a future mobile app.
 * `Edition` is the catalog edition type of the caller (`EditionDetails` in `@libresca/data`).
 *
 * - `catalog` (200): the edition is already in the catalog; no source was asked.
 * - `proposal` (200): not in the catalog; the merged card from the sources. `catalogWork`:
 *   the catalog work with the same Open Library work id, which the new edition belongs to.
 * - `not_found` (404): no source has it; the client opens manual entry.
 */
export type IsbnLookupResponse<Edition = unknown> =
  | { status: 'catalog'; isbn13: string; edition: Edition }
  | {
      status: 'proposal';
      isbn13: string;
      sources: Record<SourceName, SourceStatus>;
      proposal: EditionProposal;
      catalogWork?: { id: string; title: string };
    }
  | { status: 'not_found'; isbn13: string; sources: Record<SourceName, SourceStatus> };

/**
 * Body of `GET /api/v1/books/search?q=` (200). `Work` is the catalog work type of the caller
 * (`WorkWithAuthors` in `@libresca/data`).
 *
 * - `catalog`: works already in the catalog matching the query, best first.
 * - `candidates`: works found by Open Library and Google Books. `catalogMatch` points to the
 *   catalog work they are (`identifier`) or probably are (`title_author`): the client offers
 *   that work first instead of creating a duplicate.
 */
export interface BookSearchResponse<Work = unknown> {
  query: string;
  catalog: Work[];
  sources: Record<SearchSource, SourceStatus>;
  candidates: MatchedCandidate[];
}

/**
 * Error bodies: 400 `invalid_isbn` or `invalid_query`, 401 `unauthorized`, 403 `inactive`,
 * 429 `rate_limited`.
 */
export interface ApiError {
  error: 'invalid_isbn' | 'invalid_query' | 'unauthorized' | 'inactive' | 'rate_limited';
}
