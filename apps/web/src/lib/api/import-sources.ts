import {
  type ImportSources,
  type LibrescaClient,
  createMetadataCache,
  findAuthorsByOpenLibraryIds,
  findWorksByIdentifiers,
} from '@libresca/data';
import { type ImportSourceOptions, importCandidates, importEntryForIsbn } from '@libresca/metadata';

import { googleBooksKey, metadataHttp, quotaUserFor } from './metadata';

/**
 * Wires the import engine (`packages/data`) to the sources (`packages/metadata`) for one
 * caller: their session for the catalog and the shared cache, their quota user for Google.
 */
export function importSourcesFor(client: LibrescaClient, userId: string): ImportSources {
  const options: ImportSourceOptions = {
    http: metadataHttp(),
    googleBooksKey: googleBooksKey(),
    quotaUser: quotaUserFor(userId),
    shared: createMetadataCache(client),
    catalog: {
      worksByOpenLibraryId: async (ids) =>
        (await findWorksByIdentifiers(client, { openLibraryWorkIds: ids, isbns: [] })).openLibraryWorks,
      authorsByOpenLibraryId: (ids) => findAuthorsByOpenLibraryIds(client, ids),
    },
  };
  return {
    entryForIsbn: (book, allowGoogle) => importEntryForIsbn(book, allowGoogle, options),
    candidates: (book) => importCandidates(book, options),
  };
}

/** The user's date sent by the browser, `YYYY-MM-DD`, or the server's as a fallback. */
export function requestToday(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
}
