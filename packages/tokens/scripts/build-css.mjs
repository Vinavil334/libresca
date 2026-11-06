#!/usr/bin/env node
// Generates packages/tokens/tokens.css from packages/tokens/tokens.json.
// No dependencies: runs with plain Node until F0.3 sets up the workspace.
//
//   node packages/tokens/scripts/build-css.mjs          write tokens.css
//   node packages/tokens/scripts/build-css.mjs --check  exit 1 if tokens.css is stale

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'tokens.json');
const TARGET = join(ROOT, 'tokens.css');

/** Families that are plain {tokens:[{name,value}]} lists of theme-independent values. */
const STATIC_FAMILIES = ['spacing', 'radius', 'border', 'duration', 'easing'];
/** Families whose values may differ per theme. */
const THEMED_FAMILIES = ['color', 'shadow'];

const DISPLAY_AXES = "'SOFT' 100, 'WONK' 1";

export function resolveValue(value) {
  const alias = /^\{([A-Za-z0-9][A-Za-z0-9_.-]*)\}$/.exec(value);
  return alias ? `var(--${alias[1]})` : value;
}

export function valueForTheme(token, themeId, firstThemeId) {
  if (typeof token.value === 'string') return token.value;
  return token.value[themeId] ?? token.value[firstThemeId];
}

function declarations(tokens, themeId, firstThemeId, onlyIfDifferent = false) {
  return tokens
    .filter((t) => !onlyIfDifferent || (typeof t.value === 'object' && t.value[themeId] !== undefined))
    .map((t) => `  --${t.name}: ${resolveValue(valueForTheme(t, themeId, firstThemeId))};`);
}

function kebab(prop) {
  return prop.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

export function buildCss(tokens) {
  const themes = tokens.color.themes;
  const first = themes[0].id;
  const themed = THEMED_FAMILIES.flatMap((f) => tokens[f]?.tokens ?? []);
  const out = [];

  out.push(`/* ${tokens.name} — generated from tokens.json by packages/tokens/scripts/build-css.mjs. Do not edit by hand. */`);
  out.push('');
  out.push(`:root, [data-theme="${first}"] {`);
  out.push(...declarations(themed, first, first));
  out.push('}');

  for (const theme of themes.slice(1)) {
    const lines = declarations(themed, theme.id, first, true);
    out.push('');
    out.push(`[data-theme="${theme.id}"] {`);
    out.push(...lines);
    out.push('}');
    if (theme.id === 'notte') {
      out.push('');
      out.push('@media (prefers-color-scheme: dark) {');
      out.push(`  :root:not([data-theme="${first}"]) {`);
      out.push(...lines.map((l) => '  ' + l));
      out.push('  }');
      out.push('}');
    }
  }

  out.push('');
  out.push(':root {');
  for (const family of STATIC_FAMILIES) {
    for (const t of tokens[family]?.tokens ?? []) out.push(`  --${t.name}: ${t.value};`);
  }
  for (const [key, stack] of Object.entries(tokens.type.families)) out.push(`  --font-${key}: ${stack};`);
  out.push('}');

  for (const group of tokens.type.groups) {
    for (const style of group.styles) {
      const family = style.family ?? group.family;
      out.push('');
      out.push(`.type-${style.name} {`);
      out.push(`  font-family: var(--font-${family});`);
      for (const prop of ['fontSize', 'lineHeight', 'fontWeight', 'letterSpacing', 'fontStyle']) {
        if (style[prop] !== undefined) out.push(`  ${kebab(prop)}: ${style[prop]};`);
      }
      if (family === 'display') out.push(`  font-variation-settings: ${DISPLAY_AXES};`);
      out.push('}');
    }
  }

  return out.join('\n') + '\n';
}

function main() {
  const tokens = JSON.parse(readFileSync(SOURCE, 'utf8'));
  const css = buildCss(tokens);
  if (process.argv.includes('--check')) {
    let current = '';
    try { current = readFileSync(TARGET, 'utf8'); } catch { /* missing file counts as stale */ }
    if (current !== css) {
      console.error('tokens.css is out of date: run node packages/tokens/scripts/build-css.mjs');
      process.exit(1);
    }
    console.log('tokens.css is up to date');
    return;
  }
  writeFileSync(TARGET, css);
  console.log(`wrote ${TARGET}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
