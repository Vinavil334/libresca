import { matchKey, surnameKey } from './text';
import type { SearchHit, WorkCandidate } from './search';

/** A catalog work as far as matching needs it. */
export interface CatalogWorkRef {
  id: string;
  title: string;
  /** Every name of every author, alternate names included. */
  authorNames: string[];
}

/** Catalog works reached through a shared identifier: value to work id. */
export interface IdentifierMatches {
  openLibraryWorks: Record<string, string>;
  isbns: Record<string, string>;
}

/**
 * `identifier`: the candidate shares an Open Library work id or an ISBN with the catalog
 * work, so it is the same work. `title_author`: same normalised title and an author in
 * common, so it probably is; the user decides. Nothing is ever merged automatically.
 */
export interface CatalogMatch {
  workId: string;
  basis: 'identifier' | 'title_author';
}

export type MatchedCandidate = WorkCandidate & { catalogMatch?: CatalogMatch };

function identifierMatch(hit: SearchHit, ids: IdentifierMatches): string | undefined {
  const byWork = hit.openLibraryWorkId ? ids.openLibraryWorks[hit.openLibraryWorkId] : undefined;
  return byWork ?? hit.isbns.map((isbn) => ids.isbns[isbn]).find((id) => id !== undefined);
}

function titleAuthorMatch(hit: SearchHit, catalog: CatalogWorkRef[]): string | undefined {
  if (hit.authors.length === 0) return undefined;
  const title = matchKey(hit.title);
  const surnames = new Set(hit.authors.map(surnameKey));
  return catalog.find(
    (work) => matchKey(work.title) === title && work.authorNames.some((name) => surnames.has(surnameKey(name))),
  )?.id;
}

/**
 * Marks the candidates already in the catalog and drops the ISBN lists used to find
 * them, which are too long to send to the client.
 */
export function matchCatalog(hits: SearchHit[], catalog: CatalogWorkRef[], ids: IdentifierMatches): MatchedCandidate[] {
  return hits.map((hit) => {
    const candidate: WorkCandidate = {
      key: hit.key,
      title: hit.title,
      authors: hit.authors,
      firstPublishedYear: hit.firstPublishedYear,
      openLibraryWorkId: hit.openLibraryWorkId,
      editionCount: hit.editionCount,
      cover: hit.cover,
      editions: hit.editions,
      sources: hit.sources,
    };
    const byIdentifier = identifierMatch(hit, ids);
    if (byIdentifier) return { ...candidate, catalogMatch: { workId: byIdentifier, basis: 'identifier' } };
    const byTitle = titleAuthorMatch(hit, catalog);
    return byTitle ? { ...candidate, catalogMatch: { workId: byTitle, basis: 'title_author' } } : candidate;
  });
}

/** The identifiers to look up in the catalog for a list of hits. */
export function identifiersOf(hits: SearchHit[]): { openLibraryWorkIds: string[]; isbns: string[] } {
  return {
    openLibraryWorkIds: [...new Set(hits.flatMap((hit) => (hit.openLibraryWorkId ? [hit.openLibraryWorkId] : [])))],
    isbns: [...new Set(hits.flatMap((hit) => hit.isbns))],
  };
}
