import { type CoverSources, type LibrescaClient, createMetadataCache } from '@libresca/data';
import { lookupCover } from '@libresca/metadata';

import { googleBooksKey, metadataHttp, quotaUserFor } from './metadata';

/** Wires the cover run (`packages/data`) to the sources (`packages/metadata`) for one caller. */
export function coverSourcesFor(client: LibrescaClient, userId: string): CoverSources {
  const options = {
    http: metadataHttp(),
    googleBooksKey: googleBooksKey(),
    quotaUser: quotaUserFor(userId),
    shared: createMetadataCache(client),
  };
  return { coverFor: (isbn13, allowGoogle) => lookupCover(isbn13, allowGoogle, options) };
}
