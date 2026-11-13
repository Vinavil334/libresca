import { type ReviewChoice, resolveImportRow } from '@libresca/data';
import { type NextRequest, NextResponse } from 'next/server';

import { apiError, authenticateApi } from '@/lib/api/auth';
import { importSourcesFor, requestToday } from '@/lib/api/import-sources';

export const maxDuration = 30;

function choiceOf(body: unknown): ReviewChoice | null {
  const value = body as { kind?: unknown; key?: unknown } | null;
  if (value?.kind === 'skip' || value?.kind === 'as_exported') return { kind: value.kind };
  if (value?.kind === 'candidate' && typeof value.key === 'string' && value.key.length <= 200) {
    return { kind: 'candidate', key: value.key };
  }
  return null;
}

/**
 * POST /api/v1/imports/{id}/rows/{rowId}: settles a row in review. Body:
 * `{ "kind": "candidate", "key": "…" }`, `{ "kind": "as_exported" }` or `{ "kind": "skip" }`,
 * plus `today`.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; rowId: string }> }) {
  const auth = await authenticateApi(request);
  if (!auth.ok) return auth.response;

  const body: unknown = await request.json().catch(() => null);
  const choice = choiceOf(body);
  if (!choice) return apiError('invalid_choice', 400);
  const { rowId } = await params;
  const done = await resolveImportRow(
    auth.client,
    rowId,
    choice,
    importSourcesFor(auth.client, auth.userId),
    requestToday((body as { today?: unknown }).today),
  );
  if (!done) return apiError('not_found', 404);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
