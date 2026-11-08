import { coverPhotoMaxBytes, coverPhotoQuality, coverPhotoSize } from '@libresca/domain';

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Turns a photo from the camera or the gallery into the small JPEG the `covers` bucket
 * accepts: upright (EXIF orientation applied), longest side at most 800 px. JPEG because
 * every browser, Safari on iPhone included, can encode it. `null` when the browser
 * cannot read the file.
 */
export async function resizeCoverPhoto(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
  const size = coverPhotoSize(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!size || !context) {
    bitmap.close();
    return null;
  }
  canvas.width = size.width;
  canvas.height = size.height;
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();

  const blob = await encode(canvas, coverPhotoQuality);
  // A very detailed photo can stay big: one more try at a lower quality.
  if (blob && blob.size > coverPhotoMaxBytes) return encode(canvas, 0.6);
  return blob;
}
