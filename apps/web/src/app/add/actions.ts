'use server';

import {
  type CreateEditionResult,
  type UploadCoverResult,
  addCopy,
  createEdition,
  deleteCoverPhoto,
  findAuthorsByOpenLibraryIds,
  uploadCoverPhoto,
} from '@libresca/data';
import { coverPhotoUrl, localDate } from '@libresca/domain';
import { type EditionProposal, type ProposalEdits, editedCatalogEntry, openLibraryAuthorIds } from '@libresca/metadata';
import { randomUUID } from 'node:crypto';

import { supabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient, currentUserId } from '@/lib/supabase/server';

export interface AddEditionInput {
  proposal: EditionProposal;
  edits: ProposalEdits;
  /** Add the edition to this catalog work instead of creating a new one. */
  workId?: string;
  /** "Ce l'ho": also put a copy of the edition in the caller's Tana. */
  copy?: { isLendable: boolean };
}

export type AddEditionResponse =
  Exclude<CreateEditionResult, { ok: true }> | { ok: true; workId: string; editionId: string; copyAdded: boolean };

/**
 * Saves a confirmed proposal to the catalog with the user's session. The proposal comes
 * back from the client, so it is treated as user input: `createEdition` validates it and
 * the database checks the account and repeats the essential rules (no Google Books
 * description, no Google Books payload, cover paths of the expected shape).
 */
export async function addEdition({ proposal, edits, workId, copy }: AddEditionInput): Promise<AddEditionResponse> {
  const client = await createSupabaseServerClient();
  const knownAuthors = workId ? {} : await findAuthorsByOpenLibraryIds(client, openLibraryAuthorIds(proposal));
  const result = await createEdition(client, editedCatalogEntry(proposal, edits, { workId, knownAuthors }));
  if (!result.ok) return result;
  // The book is in the catalog either way; a failed copy shows up as "not in your Tana yet".
  const added = copy ? await addCopy(client, result.editionId, copy, localDate(new Date())) : null;
  return { ...result, copyAdded: added?.ok ?? false };
}

export type UploadCoverResponse = (UploadCoverResult & { ok: false }) | { ok: true; path: string; url: string };

/**
 * Stores a cover photo the browser already resized. The storage policies decide who may
 * write; this only finds the account and names the file.
 */
export async function uploadCover(form: FormData): Promise<UploadCoverResponse> {
  const photo = form.get('photo');
  if (!(photo instanceof File)) return { ok: false, reason: 'invalid' };
  const client = await createSupabaseServerClient();
  const accountId = await currentUserId(client);
  if (!accountId) return { ok: false, reason: 'failed' };

  const result = await uploadCoverPhoto(client, accountId, randomUUID(), await photo.arrayBuffer());
  return result.ok ? { ok: true, path: result.path, url: coverPhotoUrl(supabaseEnv().url, result.path) } : result;
}

/** Removes a photo replaced or abandoned before saving; a photo in use is never removed. */
export async function discardCover(path: string): Promise<void> {
  await deleteCoverPhoto(await createSupabaseServerClient(), path);
}
