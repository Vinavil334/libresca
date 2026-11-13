'use server';

import { type ShelfResult, createShelf, deleteShelf, renameShelf, setOnShelf } from '@libresca/data';
import { revalidatePath } from 'next/cache';

import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Shelf actions. RLS decides whose shelves these are; the actions only call the data
 * package and refresh the pages that show shelves.
 */
function refresh(shelfId?: string, workId?: string) {
  revalidatePath('/');
  revalidatePath('/shelves');
  if (shelfId) revalidatePath(`/shelves/${shelfId}`);
  if (workId) revalidatePath(`/books/${workId}`);
}

export async function createOwnShelf(name: string): Promise<ShelfResult> {
  const result = await createShelf(await createSupabaseServerClient(), name);
  if (result.ok) refresh();
  return result;
}

export async function renameOwnShelf(shelfId: string, name: string): Promise<ShelfResult> {
  const result = await renameShelf(await createSupabaseServerClient(), shelfId, name);
  if (result.ok) refresh(shelfId);
  return result;
}

export async function deleteOwnShelf(shelfId: string): Promise<boolean> {
  const removed = await deleteShelf(await createSupabaseServerClient(), shelfId);
  if (removed) refresh();
  return removed;
}

export async function setBookOnShelf(shelfId: string, workId: string, on: boolean): Promise<boolean> {
  const done = await setOnShelf(await createSupabaseServerClient(), shelfId, workId, on);
  if (done) refresh(shelfId, workId);
  return done;
}
