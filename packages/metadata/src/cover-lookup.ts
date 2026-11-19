import { type LookupOptions, lookupIsbn } from './lookup';

/** A cover the catalog can point to: the image itself stays at its source. */
export interface FoundCover {
  source: 'openlibrary' | 'googlebooks';
  id: string;
}

/**
 * The cover of an edition already in the catalog, as an import would find it: the open
 * sources first (from the shared cache when they were asked before), Google Books only
 * when they have no cover and only when `allowGoogle`.
 */
export async function lookupCover(
  isbn13: string,
  allowGoogle: boolean,
  options: Omit<LookupOptions, 'googleOnlyForGaps'>,
): Promise<{ cover: FoundCover | null; usedGoogle: boolean }> {
  const lookup = await lookupIsbn(isbn13, {
    ...options,
    googleBooksKey: allowGoogle ? options.googleBooksKey : undefined,
    googleOnlyForGaps: true,
  });
  const usedGoogle = lookup !== null && lookup.sources.googlebooks !== 'skipped';
  const cover = lookup?.proposal?.cover;
  return { cover: cover ? { source: cover.source, id: cover.id } : null, usedGoogle };
}
