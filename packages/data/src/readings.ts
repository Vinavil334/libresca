import {
  type ReadingInput,
  type ReadingIssue,
  type ReadingStatus,
  sortReadings,
  validateReading,
} from '@libresca/domain';

import type { LibrescaClient } from './client';
import type { Enums, Tables } from './database.types';

// Compile-time guard: the domain's statuses must match the database enum.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const statusesMatch: Same<Enums<'reading_status'>, ReadingStatus> = true;
void statusesMatch;

export type Reading = Tables<'readings'>;

export type ReadingResult =
  | { ok: true; reading: Reading }
  | { ok: false; reason: 'invalid'; issues: ReadingIssue[] }
  /**
   * `already_open`: this book is already in the Dispensa or being read; update that reading.
   * `not_found`: no such reading, work or edition for this account. `forbidden`: account not active.
   */
  | { ok: false; reason: 'already_open' | 'not_found' | 'forbidden' | 'rejected' | 'failed' };

function failure(code: string | undefined): ReadingResult {
  if (code === '23505') return { ok: false, reason: 'already_open' };
  if (code === '42501') return { ok: false, reason: 'forbidden' };
  if (code === '23503' || code === 'PGRST116') return { ok: false, reason: 'not_found' };
  if (code === '23514') return { ok: false, reason: 'rejected' };
  return { ok: false, reason: 'failed' };
}

/**
 * The caller's readings of a work, the open one first and then the most recent. RLS
 * returns only the caller's own rows. Empty when the query fails.
 */
export async function listOwnReadings(client: LibrescaClient, workId: string): Promise<Reading[]> {
  const { data, error } = await client.from('readings').select('*').eq('work_id', workId);
  return error || !data ? [] : sortReadings(data);
}

/** Starts a reading of a work for the caller. `today` is the user's date, `YYYY-MM-DD`. */
export async function addReading(
  client: LibrescaClient,
  workId: string,
  input: ReadingInput,
  today: string,
): Promise<ReadingResult> {
  const validation = validateReading(input, today);
  if (!validation.ok) return { ok: false, reason: 'invalid', issues: validation.issues };
  const { data, error } = await client
    .from('readings')
    .insert({ work_id: workId, ...validation.payload })
    .select()
    .single();
  return error || !data ? failure(error?.code) : { ok: true, reading: data };
}

/** Changes the caller's reading, for example from the Dispensa to finished. */
export async function updateReading(
  client: LibrescaClient,
  readingId: string,
  input: ReadingInput,
  today: string,
): Promise<ReadingResult> {
  const validation = validateReading(input, today);
  if (!validation.ok) return { ok: false, reason: 'invalid', issues: validation.issues };
  const { data, error } = await client
    .from('readings')
    .update(validation.payload)
    .eq('id', readingId)
    .select()
    .single();
  return error || !data ? failure(error?.code) : { ok: true, reading: data };
}

/** Removes the caller's reading. Returns whether a reading was removed. */
export async function deleteReading(client: LibrescaClient, readingId: string): Promise<boolean> {
  const { data, error } = await client.from('readings').delete().eq('id', readingId).select('id');
  return !error && (data?.length ?? 0) > 0;
}
