import { coverBucket, coverPhotoMaxBytes, coverPhotoPath, isCoverPath } from '@libresca/domain';

import type { LibrescaClient } from './client';

export type UploadCoverResult =
  | { ok: true; path: string }
  /** `invalid`: ids or bytes not usable. `too_large`: over the bucket limit. `failed`: refused or unreachable. */
  | { ok: false; reason: 'invalid' | 'too_large' | 'failed' };

/** JPEG files start with FF D8 FF. The bucket also checks the declared type. */
function looksLikeJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * Uploads a cover photo, already resized to a JPEG, into the account's folder. `fileId`
 * is a fresh uuid from the caller, so this package needs no platform crypto. The storage
 * policies let only active accounts write, and only into their own folder.
 */
export async function uploadCoverPhoto(
  client: LibrescaClient,
  accountId: string,
  fileId: string,
  photo: ArrayBuffer | Uint8Array,
): Promise<UploadCoverResult> {
  const path = coverPhotoPath(accountId, fileId);
  const bytes = photo instanceof Uint8Array ? photo : new Uint8Array(photo);
  if (!path || !looksLikeJpeg(bytes)) return { ok: false, reason: 'invalid' };
  if (bytes.byteLength > coverPhotoMaxBytes) return { ok: false, reason: 'too_large' };

  const { error } = await client.storage
    .from(coverBucket)
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
  return error ? { ok: false, reason: 'failed' } : { ok: true, path };
}

/**
 * Removes a photo the user replaced or abandoned before saving. The policy refuses a
 * photo an edition already uses, so this never breaks a cover. Returns whether it went.
 */
export async function deleteCoverPhoto(client: LibrescaClient, path: string): Promise<boolean> {
  if (!isCoverPath(path)) return false;
  const { data, error } = await client.storage.from(coverBucket).remove([path]);
  return !error && (data?.length ?? 0) > 0;
}
