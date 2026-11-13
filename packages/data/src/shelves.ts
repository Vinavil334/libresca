import { type ShelfNameIssue, validateShelfName } from '@libresca/domain';

import type { LibrescaClient } from './client';
import type { Tables } from './database.types';

export type Shelf = Tables<'shelves'>;

export type ShelfResult =
  | { ok: true; shelf: Shelf }
  | { ok: false; reason: 'invalid'; issue: ShelfNameIssue }
  /** `duplicate`: the account already has a shelf with this name. `forbidden`: account not active. */
  | { ok: false; reason: 'duplicate' | 'not_found' | 'forbidden' | 'failed' };

function failure(code: string | undefined): ShelfResult {
  if (code === '23505') return { ok: false, reason: 'duplicate' };
  if (code === '42501') return { ok: false, reason: 'forbidden' };
  if (code === 'PGRST116') return { ok: false, reason: 'not_found' };
  return { ok: false, reason: 'failed' };
}

/** The caller's shelves in the order they chose, then oldest first. `null` when the query fails. */
export async function listOwnShelves(client: LibrescaClient): Promise<Shelf[] | null> {
  const { data, error } = await client.from('shelves').select('*').order('position').order('created_at').order('id');
  return error || !data ? null : data;
}

/** One of the caller's shelves; `null` when it is someone else's, missing, or the query fails. */
export async function getOwnShelf(client: LibrescaClient, shelfId: string): Promise<Shelf | null> {
  const { data, error } = await client.from('shelves').select('*').eq('id', shelfId).maybeSingle();
  return error ? null : data;
}

export async function createShelf(client: LibrescaClient, name: string): Promise<ShelfResult> {
  const validation = validateShelfName(name);
  if (!validation.ok) return { ok: false, reason: 'invalid', issue: validation.issue };
  const { data, error } = await client.from('shelves').insert({ name: validation.name }).select().single();
  return error || !data ? failure(error?.code) : { ok: true, shelf: data };
}

export async function renameShelf(client: LibrescaClient, shelfId: string, name: string): Promise<ShelfResult> {
  const validation = validateShelfName(name);
  if (!validation.ok) return { ok: false, reason: 'invalid', issue: validation.issue };
  const { data, error } = await client
    .from('shelves')
    .update({ name: validation.name })
    .eq('id', shelfId)
    .select()
    .single();
  return error || !data ? failure(error?.code) : { ok: true, shelf: data };
}

/** Removes the caller's shelf; the books stay in the Tana. Returns whether a shelf was removed. */
export async function deleteShelf(client: LibrescaClient, shelfId: string): Promise<boolean> {
  const { data, error } = await client.from('shelves').delete().eq('id', shelfId).select('id');
  return !error && (data?.length ?? 0) > 0;
}

/** The ids of the caller's shelves that hold a work. */
export async function listShelvesOfWork(client: LibrescaClient, workId: string): Promise<string[]> {
  const { data, error } = await client.from('shelf_items').select('shelf_id').eq('work_id', workId);
  return error || !data ? [] : data.map((item) => item.shelf_id);
}

/** Puts a work on one of the caller's shelves, or takes it off. Returns whether it worked. */
export async function setOnShelf(
  client: LibrescaClient,
  shelfId: string,
  workId: string,
  on: boolean,
): Promise<boolean> {
  if (on) {
    const { error } = await client
      .from('shelf_items')
      .upsert({ shelf_id: shelfId, work_id: workId }, { onConflict: 'shelf_id,work_id', ignoreDuplicates: true });
    return !error;
  }
  const { error } = await client.from('shelf_items').delete().eq('shelf_id', shelfId).eq('work_id', workId);
  return !error;
}
