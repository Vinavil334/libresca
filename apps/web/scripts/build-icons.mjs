// Generates the provisional app icons from the placeholder mascot and the design tokens.
// Run with `pnpm icons` after changing the mascot or the surface color. The D4 track
// replaces the placeholder with the final mascot and logo; this script stays.
//
// Outputs (all committed, covered by ASSETS_LICENSE.md):
//   src/app/icon.svg            favicon, linked by Next.js
//   src/app/apple-icon.png      180×180, home screen on iOS (no transparency)
//   public/icons/icon-192.png   manifest, purpose "any"
//   public/icons/icon-512.png   manifest, purpose "any"
//   public/icons/maskable-512.png  manifest, purpose "maskable" (art inside the 80% safe zone)

import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const app = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const repo = (path) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

const tokens = JSON.parse(await readFile(repo('packages/tokens/tokens.json'), 'utf8'));
const color = (name) => {
  const token = tokens.color.tokens.find((t) => t.name === name);
  if (!token) throw new Error(`Missing token ${name}`);
  return token.value.giorno;
};
const surface = color('color-surface');

// The mascot drawing without its outer <svg> element, so it can be placed in a square canvas.
const mascot = await readFile(repo('docs/design/assets/motivi/topina-provvisoria.svg'), 'utf8');
const viewBox = mascot
  .match(/viewBox="([^"]+)"/)[1]
  .split(/\s+/)
  .map(Number);
const [, , artWidth, artHeight] = viewBox;
const inner = mascot.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

/**
 * A square icon: surface background, mascot centred and scaled so its widest side
 * fills `scale` of the canvas. `rounded` gives the favicon soft corners.
 */
function iconSvg({ scale, rounded = false }) {
  const size = 512;
  const fit = (size * scale) / Math.max(artWidth, artHeight);
  const x = (size - artWidth * fit) / 2;
  const y = (size - artHeight * fit) / 2;
  const radius = rounded ? size * 0.22 : 0;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${surface}"/>`,
    `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${fit.toFixed(4)})">${inner}</g>`,
    `</svg>`,
  ].join('');
}

const browser = await chromium.launch();
const page = await browser.newPage();

async function png(svg, size, out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}" style="display:block"></body></html>`,
  );
  await page.locator('img').evaluate((img) => img.decode());
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: size, height: size }, omitBackground: false });
}

await mkdir(app('public/icons'), { recursive: true });

const full = iconSvg({ scale: 0.84 });
// Maskable icons are cropped to a circle or squircle by the OS: keep the art inside the central 80%.
const maskable = iconSvg({ scale: 0.62 });

await writeFile(app('src/app/icon.svg'), `${iconSvg({ scale: 0.84, rounded: true })}\n`);
await png(full, 180, app('src/app/apple-icon.png'));
await png(full, 192, app('public/icons/icon-192.png'));
await png(full, 512, app('public/icons/icon-512.png'));
await png(maskable, 512, app('public/icons/maskable-512.png'));

await browser.close();
console.log('Icons written to src/app and public/icons.');
