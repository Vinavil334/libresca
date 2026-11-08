/**
 * Copies the ZXing reader WASM used by the barcode-detector polyfill into public/zxing/,
 * so iPhone and other browsers without a native BarcodeDetector load it from our own
 * origin instead of a third-party CDN. Runs before `dev` and `build`; the copy is not
 * committed. The file name carries the version, so browsers can cache it for good.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The folder of the package that contains `file`. */
function packageRoot(file, name) {
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    const manifest = join(dir, 'package.json');
    if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name === name) return dir;
  }
  throw new Error(`Cannot find the ${name} package.`);
}

const require = createRequire(import.meta.url);
// zxing-wasm is a dependency of barcode-detector, not of the app: resolve it from there.
const detectorRoot = packageRoot(require.resolve('barcode-detector'), 'barcode-detector');
const zxingRoot = packageRoot(
  createRequire(join(detectorRoot, 'package.json')).resolve('zxing-wasm/reader'),
  'zxing-wasm',
);
const { version } = JSON.parse(readFileSync(join(zxingRoot, 'package.json'), 'utf8'));

const target = fileURLToPath(new URL('../public/zxing/', import.meta.url));
mkdirSync(target, { recursive: true });
for (const old of readdirSync(target)) rmSync(join(target, old));
copyFileSync(join(zxingRoot, 'dist', 'reader', 'zxing_reader.wasm'), join(target, `zxing_reader-${version}.wasm`));
console.log(`zxing_reader-${version}.wasm copied to public/zxing/`);
