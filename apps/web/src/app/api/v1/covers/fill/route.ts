import { runCoverFillStep } from '@libresca/data';
import { type NextRequest, NextResponse } from 'next/server';

import { apiError, authenticateApi } from '@/lib/api/auth';
import { coverSourcesFor } from '@/lib/api/cover-sources';

/** Room for a step on a serverless function; the step itself stops after `budgetMs`. */
export const maxDuration = 60;
const budgetMs = 20_000;

/**
 * POST /api/v1/covers/fill: looks for the covers of the caller's books shown without one,
 * for a few seconds, and returns the progress. The client calls it again with `after: next`
 * and the `googleCalls` it got back until `next` is `null`.
 * Body: `{ "after"?: string | null, "googleCalls"?: number }`.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateApi(request);
  if (!auth.ok) return auth.response;

  const body = ((await request.json().catch(() => ({}))) ?? {}) as { after?: unknown; googleCalls?: unknown };
  const after = typeof body.after === 'string' && body.after.length <= 64 ? body.after : null;
  const googleCalls = typeof body.googleCalls === 'number' && Number.isFinite(body.googleCalls) ? body.googleCalls : 0;

  const progress = await runCoverFillStep(auth.client, coverSourcesFor(auth.client, auth.userId), {
    after,
    googleCalls,
    budgetMs,
  });
  if (!progress) return apiError('failed', 500);
  return NextResponse.json(progress, { headers: { 'Cache-Control': 'no-store' } });
}
