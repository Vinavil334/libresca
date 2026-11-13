import { startGoodreadsImport } from '@libresca/data';
import { type NextRequest, NextResponse } from 'next/server';

import { apiError, authenticateApi } from '@/lib/api/auth';

/** A Goodreads export of several thousand books stays well below this. */
const maxBytes = 5 * 1024 * 1024;

/**
 * POST /api/v1/imports: starts an import from the text of a Goodreads export (`text/csv`).
 * The server parses the file itself and stores one row per book; nothing reaches the
 * Tana until the steps run (`POST /api/v1/imports/{id}/step`).
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateApi(request);
  if (!auth.ok) return auth.response;

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > maxBytes) return apiError('too_large', 413);
  const csv = await request.text();
  if (csv.length > maxBytes) return apiError('too_large', 413);

  const result = await startGoodreadsImport(auth.client, csv);
  if (!result.ok) {
    return apiError(result.reason, result.reason === 'forbidden' ? 403 : result.reason === 'failed' ? 500 : 400);
  }
  return NextResponse.json(result.progress, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
