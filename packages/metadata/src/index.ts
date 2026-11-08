/**
 * Book metadata from Open Library, Google Books and OPAC SBN (ADR-0008).
 *
 * Server-side only: Google Books needs a secret key, and clients reach this code
 * through `/api/v1`. It must not depend on Next.js, so another backend can reuse it.
 */
export type {
  EditionProposal,
  IsbnLookup,
  ProposalAuthor,
  SourceAuthor,
  SourceContributor,
  SourceName,
  SourceRecord,
  SourceStatus,
  Sourced,
} from './types';
export { sourceNames } from './types';
export { type CachePolicy, type HttpClient, type HttpResult, createHttpClient } from './http';
export { type LookupOptions, createMetadataHttpClient, lookupIsbn, sourcePacing } from './lookup';
export { mergeRecords, proposalToCatalogEntry } from './merge';
export { type WindowLimiter, createWindowLimiter } from './limiter';
export {
  type BookSearch,
  type CandidateCover,
  type CandidateEdition,
  type SearchHit,
  type SearchOptions,
  type SearchSource,
  type WorkCandidate,
  maxCandidates,
  searchBooks,
} from './search';
export {
  type CatalogMatch,
  type CatalogWorkRef,
  type IdentifierMatches,
  type MatchedCandidate,
  identifiersOf,
  matchCatalog,
} from './catalog-match';
export type { ApiError, BookSearchResponse, IsbnLookupResponse } from './api';
