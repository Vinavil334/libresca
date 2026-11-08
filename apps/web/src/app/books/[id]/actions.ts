'use server';

import { type CopyResult, addCopy, deleteCopy, updateCopy } from '@libresca/data';
import type { CopyInput } from '@libresca/domain';
import { revalidatePath } from 'next/cache';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Copy actions for the book page. `today` is the user's date (`YYYY-MM-DD`), so a copy
 * acquired this evening is not "in the future" for a server in another time zone.
 * RLS decides whose copies these are; the actions only call the data package.
 */
export async function addOwnCopy(
  workId: string,
  editionId: string,
  input: CopyInput,
  today: string,
): Promise<CopyResult> {
  const result = await addCopy(await createSupabaseServerClient(), editionId, input, today);
  if (result.ok) revalidatePath(`/books/${workId}`);
  return result;
}

export async function saveOwnCopy(
  workId: string,
  copyId: string,
  input: CopyInput,
  today: string,
): Promise<CopyResult> {
  const result = await updateCopy(await createSupabaseServerClient(), copyId, input, today);
  if (result.ok) revalidatePath(`/books/${workId}`);
  return result;
}

export async function removeOwnCopy(workId: string, copyId: string): Promise<boolean> {
  const removed = await deleteCopy(await createSupabaseServerClient(), copyId);
  if (removed) revalidatePath(`/books/${workId}`);
  return removed;
}
