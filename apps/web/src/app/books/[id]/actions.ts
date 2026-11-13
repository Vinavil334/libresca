'use server';

import {
  type CatalogEditResult,
  type CopyResult,
  type ReadingResult,
  addCopy,
  addReading,
  deleteCopy,
  deleteReading,
  updateCopy,
  updateEdition,
  updateReading,
  updateWork,
} from '@libresca/data';
import type { CopyInput, EditionEditInput, ReadingInput, WorkEditInput } from '@libresca/domain';
import { revalidatePath } from 'next/cache';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Copy and reading actions for the book page. `today` is the user's date (`YYYY-MM-DD`), so a copy
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

export async function addOwnReading(workId: string, input: ReadingInput, today: string): Promise<ReadingResult> {
  const result = await addReading(await createSupabaseServerClient(), workId, input, today);
  if (result.ok) revalidatePath(`/books/${workId}`);
  return result;
}

export async function saveOwnReading(
  workId: string,
  readingId: string,
  input: ReadingInput,
  today: string,
): Promise<ReadingResult> {
  const result = await updateReading(await createSupabaseServerClient(), readingId, input, today);
  if (result.ok) revalidatePath(`/books/${workId}`);
  return result;
}

export async function removeOwnReading(workId: string, readingId: string): Promise<boolean> {
  const removed = await deleteReading(await createSupabaseServerClient(), readingId);
  if (removed) revalidatePath(`/books/${workId}`);
  return removed;
}

export type CorrectionResult =
  { ok: true } | { ok: false; part: 'work' | 'edition'; result: Exclude<CatalogEditResult, { ok: true }> };

/**
 * Saves the corrections of a book card: the work first, then the chosen edition. Both
 * go through the catalog functions, which mark what changed as written by a person.
 */
export async function saveCorrections(
  workId: string,
  editionId: string,
  work: WorkEditInput,
  edition: EditionEditInput,
): Promise<CorrectionResult> {
  const client = await createSupabaseServerClient();
  const workResult = await updateWork(client, workId, work);
  if (!workResult.ok) return { ok: false, part: 'work', result: workResult };
  const editionResult = await updateEdition(client, editionId, edition);
  revalidatePath(`/books/${workId}`);
  revalidatePath('/');
  return editionResult.ok ? { ok: true } : { ok: false, part: 'edition', result: editionResult };
}
