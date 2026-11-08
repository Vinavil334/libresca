import { type EditionDetails, getEditionByIsbn } from '@libresca/data';
import { toIsbn13 } from '@libresca/domain';
import { type IsbnLookupResponse, lookupIsbn } from '@libresca/metadata';
import { type NextRequest, NextResponse } from 'next/server';

import { apiError, authenticateApi } from '@/lib/api/auth';
import { externalLookups, googleBooksKey, metadataHttp, quotaUserFor } from '@/lib/api/metadata';

/**
 * GET /api/v1/books/isbn/{isbn}: the catalog edition with this ISBN, or a card
 * proposed by the metadata sources (ADR-0008). Nothing is saved here: the client
 * shows the proposal and saves it with create_edition once the user confirms.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ isbn: string }> }) {
  const auth = await authenticateApi(request);
  if (!auth.ok) return auth.response;

  const isbn13 = toIsbn13((await params).isbn);
  if (!isbn13) return apiError('invalid_isbn', 400);

  const reply = (body: IsbnLookupResponse<EditionDetails>, status = 200) =>
    NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

  // The local catalog first: no external request for a book someone already added.
  const edition = await getEditionByIsbn(auth.client, isbn13);
  if (edition) return reply({ status: 'catalog', isbn13, edition });

  if (!externalLookups.take(auth.userId)) return apiError('rate_limited', 429);

  const lookup = await lookupIsbn(isbn13, {
    http: metadataHttp(),
    googleBooksKey: googleBooksKey(),
    quotaUser: quotaUserFor(auth.userId),
  });
  if (!lookup) return apiError('invalid_isbn', 400);

  return lookup.proposal
    ? reply({ status: 'proposal', isbn13, sources: lookup.sources, proposal: lookup.proposal })
    : reply({ status: 'not_found', isbn13, sources: lookup.sources }, 404);
}
