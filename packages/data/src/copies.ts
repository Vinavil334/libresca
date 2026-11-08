import { type CopyInput, type CopyIssue, type Visibility, validateCopy } from '@libresca/domain';

import type { LibrescaClient } from './client';
import type { Enums, Tables } from './database.types';

// Compile-time guard: the domain's visibilities must match the database enum.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const visibilityMatches: Same<Enums<'visibility'>, Visibility> = true;
void visibilityMatches;

export type Copy = Tables<'copies'>;

/** A copy with the edition it is a volume of. */
export interface CopyWithEdition extends Copy {
  edition: Pick<Tables<'editions'>, 'id' | 'work_id' | 'title' | 'isbn13' | 'publisher' | 'published_year'>;
}

export type CopyResult =
  | { ok: true; copy: Copy }
  | { ok: false; reason: 'invalid'; issues: CopyIssue[] }
  /** `not_found`: no such copy or edition for this account. `forbidden`: account not active. */
  | { ok: false; reason: 'not_found' | 'forbidden' | 'failed' };

function failure(code: string | undefined): CopyResult {
  if (code === '42501') return { ok: false, reason: 'forbidden' };
  if (code === '23503' || code === 'PGRST116') return { ok: false, reason: 'not_found' };
  return { ok: false, reason: 'failed' };
}

const editionColumns = 'edition:editions!inner(id, work_id, title, isbn13, publisher, published_year)';

/**
 * The caller's copies of any edition of a work, oldest first. RLS returns only the
 * caller's own rows, so no owner filter is needed. Empty when the query fails.
 */
export async function listOwnCopies(client: LibrescaClient, workId: string): Promise<CopyWithEdition[]> {
  const { data, error } = await client
    .from('copies')
    .select(`*, ${editionColumns}`)
    .eq('edition.work_id', workId)
    .order('created_at', { ascending: true });
  return error || !data ? [] : data;
}

/** Adds a copy of an edition for the caller. `today` is the user's date, `YYYY-MM-DD`. */
export async function addCopy(
  client: LibrescaClient,
  editionId: string,
  input: CopyInput,
  today: string,
): Promise<CopyResult> {
  const validation = validateCopy(input, today);
  if (!validation.ok) return { ok: false, reason: 'invalid', issues: validation.issues };
  const { data, error } = await client
    .from('copies')
    .insert({ edition_id: editionId, ...validation.payload })
    .select()
    .single();
  return error || !data ? failure(error?.code) : { ok: true, copy: data };
}

/** Changes the caller's copy; another account's copy is `not_found`. */
export async function updateCopy(
  client: LibrescaClient,
  copyId: string,
  input: CopyInput,
  today: string,
): Promise<CopyResult> {
  const validation = validateCopy(input, today);
  if (!validation.ok) return { ok: false, reason: 'invalid', issues: validation.issues };
  const { data, error } = await client.from('copies').update(validation.payload).eq('id', copyId).select().single();
  return error || !data ? failure(error?.code) : { ok: true, copy: data };
}

/** Removes the caller's copy. Returns whether a copy was removed. */
export async function deleteCopy(client: LibrescaClient, copyId: string): Promise<boolean> {
  const { data, error } = await client.from('copies').delete().eq('id', copyId).select('id');
  return !error && (data?.length ?? 0) > 0;
}
