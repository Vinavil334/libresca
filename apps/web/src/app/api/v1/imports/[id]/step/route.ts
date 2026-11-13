import { runImportStep } from '@libresca/data';
import { type NextRequest, NextResponse } from 'next/server';

import { apiError, authenticateApi } from '@/lib/api/auth';
import { importSourcesFor, requestToday } from '@/lib/api/import-sources';

/** Room for a step on a serverless function; the step itself stops after `budgetMs`. */
export const maxDuration = 60;
const budgetMs = 20_000;

/**
 * POST /api/v1/imports/{id}/step: processes the next rows of an import and returns the
 * progress. The client calls it again until `status` is `finished`. Body: `{ "today": "YYYY-MM-DD" }`.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApi(request);
  if (!auth.ok) return auth.response;

  const body: unknown = await request.json().catch(() => ({}));
  const today = requestToday((body as { today?: unknown } | null)?.today);
  const progress = await runImportStep(auth.client, (await params).id, importSourcesFor(auth.client, auth.userId), {
    today,
    budgetMs,
  });
  if (!progress) return apiError('not_found', 404);
  return NextResponse.json(progress, { headers: { 'Cache-Control': 'no-store' } });
}
