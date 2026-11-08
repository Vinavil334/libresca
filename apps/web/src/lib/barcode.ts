import { type ScannedCode, bookBarcodeFormats, isbnFromBarcodes } from '@libresca/domain';

/** The part of the Barcode Detection API the scanner uses, native or polyfilled. */
interface Detector {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

interface NativeDetectorClass {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
}

/** The browser's own detector, when it reads EAN-13 (Chrome on Android, macOS, ChromeOS). */
async function nativeDetector(): Promise<Detector | null> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  if (!Native) return null;
  try {
    const supported = await Native.getSupportedFormats();
    if (!supported.includes('ean_13')) return null;
    return new Native({ formats: bookBarcodeFormats.filter((format) => supported.includes(format)) });
  } catch {
    return null;
  }
}

/**
 * The ZXing polyfill for Safari and the others, loaded only when needed. Its WASM comes
 * from our own /zxing/ folder (scripts/copy-zxing-wasm.mjs), never from a CDN, and
 * starts downloading as soon as the scanner opens.
 */
async function polyfillDetector(): Promise<Detector | null> {
  try {
    const { BarcodeDetector, ZXING_WASM_VERSION, prepareZXingModule } = await import('barcode-detector/ponyfill');
    void prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith('.wasm') ? `/zxing/zxing_reader-${ZXING_WASM_VERSION}.wasm` : prefix + path,
      },
      fireImmediately: true,
    });
    return new BarcodeDetector({ formats: [...bookBarcodeFormats] });
  } catch {
    return null;
  }
}

let detector: Promise<Detector | null> | undefined;

/** One detector per page, created on first use. `null` when the browser cannot read barcodes. */
export function bookDetector(): Promise<Detector | null> {
  detector ??= nativeDetector().then((native) => native ?? polyfillDetector());
  return detector;
}

/** What a frame or a photo shows: an ISBN, only other codes, or no code at all (`null`). */
export async function readBookCode(detector: Detector, source: ImageBitmapSource): Promise<ScannedCode | null> {
  try {
    const found = await detector.detect(source);
    return isbnFromBarcodes(found.map((code) => code.rawValue));
  } catch {
    return null;
  }
}

/** Reads the ISBN barcode in a photo, for when the camera cannot stream. */
export async function readBookCodeFromPhoto(file: File): Promise<ScannedCode | null | 'unsupported'> {
  const reader = await bookDetector();
  if (!reader) return 'unsupported';
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
  try {
    return await readBookCode(reader, bitmap);
  } finally {
    bitmap.close();
  }
}
