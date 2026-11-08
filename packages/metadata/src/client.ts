/**
 * The part of `@libresca/metadata` a client may import: response types and pure helpers
 * for the add screen. No HTTP client, no source URLs, nothing that needs a secret.
 */
export type { EditionProposal, ProposalAuthor, SourceName, SourceStatus, Sourced, ValueSource } from './types';
export type { CandidateCover, CandidateEdition, SearchSource, WorkCandidate } from './search';
export type { CatalogMatch, MatchedCandidate } from './catalog-match';
export type { ApiError, BookSearchResponse, IsbnLookupResponse } from './api';
export { type ProposalEdits, candidateProposal, editsFromProposal, emptyProposal } from './edit';
