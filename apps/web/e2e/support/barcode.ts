import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A random valid ISBN-13 in the 979 range, so parallel runs never collide. */
export function randomIsbn13(): string {
  const first12 = `979${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return first12 + String((10 - (sum % 10)) % 10);
}

const left = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
const even = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
];
const right = left.map((code) => [...code].map((bit) => (bit === '1' ? '0' : '1')).join(''));
const parity = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** The 95 modules of an EAN-13 barcode, `1` for a bar: what the back of a book prints. */
export function ean13Modules(code: string): string {
  const digits = [...code].map(Number);
  const pattern = parity[digits[0]!]!;
  const leftHalf = digits
    .slice(1, 7)
    .map((digit, i) => (pattern[i] === 'L' ? left[digit] : even[digit]))
    .join('');
  const rightHalf = digits
    .slice(7)
    .map((digit) => right[digit])
    .join('');
  return `101${leftHalf}01010${rightHalf}101`;
}

/**
 * A short Y4M video of the barcode, black bars on white, for Chromium's fake camera
 * (`--use-file-for-fake-video-capture`). Chromium loops it, like a steady hand.
 */
export function barcodeVideo(code: string): string {
  const width = 640;
  const height = 360;
  const moduleWidth = 4;
  const modules = ean13Modules(code);
  const left0 = Math.floor((width - modules.length * moduleWidth) / 2);
  const top = 80;
  const barHeight = 200;

  const luma = Buffer.alloc(width * height, 235);
  for (let y = top; y < top + barHeight; y++) {
    for (let m = 0; m < modules.length; m++) {
      if (modules[m] !== '1') continue;
      luma.fill(16, y * width + left0 + m * moduleWidth, y * width + left0 + (m + 1) * moduleWidth);
    }
  }
  const chroma = Buffer.alloc((width / 2) * (height / 2) * 2, 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma]);
  const header = Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`);

  const file = join(tmpdir(), `libresca-barcode-${code}.y4m`);
  writeFileSync(file, Buffer.concat([header, ...Array.from({ length: 5 }, () => frame)]));
  return file;
}
