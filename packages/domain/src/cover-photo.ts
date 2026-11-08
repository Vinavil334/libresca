/**
 * Cover photos taken by users (F1.3b). The browser resizes the photo to a small JPEG
 * before uploading it to the public `covers` bucket, at "{account id}/{random uuid}.jpg".
 * The database checks the same shape (private.is_cover_path).
 */

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const coverPathPattern = new RegExp(String.raw`^${uuid}/${uuid}\.jpg$`);

/** The storage bucket for cover photos. */
export const coverBucket = 'covers';

/** Longest side of a stored cover photo, in pixels: sharp on a phone, about 60–100 KB. */
export const coverPhotoMaxSide = 800;

/** JPEG quality used when encoding the photo. */
export const coverPhotoQuality = 0.82;

/** The bucket refuses larger files. */
export const coverPhotoMaxBytes = 1024 * 1024;

export function isCoverPath(path: string): boolean {
  return coverPathPattern.test(path);
}

/** Where an account's new photo goes. Both ids are lowercase uuids. */
export function coverPhotoPath(accountId: string, fileId: string): string | null {
  const path = `${accountId.toLowerCase()}/${fileId.toLowerCase()}.jpg`;
  return isCoverPath(path) ? path : null;
}

/**
 * The size to encode a photo at: the same proportions, the longest side at most
 * `maxSide`, never enlarged. `null` for a picture without a usable size.
 */
export function coverPhotoSize(
  width: number,
  height: number,
  maxSide = coverPhotoMaxSide,
): { width: number; height: number } | null {
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) return null;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Public URL of a stored photo, from the Supabase project URL. */
export function coverPhotoUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${coverBucket}/${path}`;
}
