import { type WorkWithAuthors, findWorksByIdentifiers, searchWorks } from '@libresca/data';
import { searchQuery } from '@libresca/domain';
import { type BookSearchResponse, identifiersOf, matchCatalog, searchBooks } from '@libresca/metadata';
import { type NextRequest, NextResponse } from 'next/server';

import { apiError, authenticateApi } from '@/lib/api/auth';
import { externalLookups, googleBooksKey, metadataHttp, quotaUserFor } from '@/lib/api/metadata';

/** Catalog works returned with the external candidates. */
const catalogResults = 10;

/**
 * GET /api/v1/books/search?q=: works in the catalog and works found by Open Library and
 * Google Books for free text, title or author. External candidates already in the catalog
 * point to their work, so the client can offer it instead of creating a duplicate.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApi(request);
  if (!auth.ok) return auth.response;

  const query = searchQuery(request.nextUrl.searchParams.get('q'));
  if (!query) return apiError('invalid_query', 400);
  if (!externalLookups.take(auth.userId)) return apiError('rate_limited', 429);

  const [catalog, search] = await Promise.all([
    searchWorks(auth.client, query, catalogResults),
    searchBooks(query, {
      http: metadataHttp(),
      googleBooksKey: googleBooksKey(),
      quotaUser: quotaUserFor(auth.userId),
    }),
  ]);
  const ids = await findWorksByIdentifiers(auth.client, identifiersOf(search.hits));
  const catalogRefs = catalog.map((work) => ({
    id: work.id,
    title: work.title,
    authorNames: work.authors.flatMap((author) => [author.name, ...author.alternate_names]),
  }));

  const body: BookSearchResponse<WorkWithAuthors> = {
    query,
    catalog,
    sources: search.sources,
    candidates: matchCatalog(search.hits, catalogRefs, ids),
  };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
}
