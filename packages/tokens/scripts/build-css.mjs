#!/usr/bin/env node
// Generates tokens.css (CSS variables and .type-* classes) and tailwind.css (Tailwind theme)
// from packages/tokens/tokens.json. No dependencies.
//
//   pnpm tokens                                         write both files
//   node packages/tokens/scripts/build-css.mjs --check  exit 1 if either file is stale

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'tokens.json');
const TARGET = join(ROOT, 'tokens.css');
const TAILWIND_TARGET = join(ROOT, 'tailwind.css');

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

  out.push(
    `/* ${tokens.name} — generated from tokens.json by packages/tokens/scripts/build-css.mjs. Do not edit by hand. */`,
  );
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

/**
 * Tailwind 4 theme that exposes only the design tokens: bg-surface, text-text-muted, p-4, rounded-card…
 * Default palettes, sizes and fonts are reset, so utilities outside the design system do not exist.
 * Values point to the variables of tokens.css, so themes switch at runtime.
 */
export function buildTailwindTheme(tokens) {
  const out = [];
  out.push(
    `/* ${tokens.name} — Tailwind theme generated from tokens.json by packages/tokens/scripts/build-css.mjs. Do not edit by hand. */`,
  );
  out.push('');
  out.push('@theme inline reference {');
  for (const ns of ['color', 'font', 'text', 'radius', 'shadow', 'ease', 'spacing']) out.push(`  --${ns}-*: initial;`);
  out.push('  --spacing: initial;');
  for (const t of tokens.color.tokens) out.push(`  --color-${t.name.replace(/^color-/, '')}: var(--${t.name});`);
  for (const key of Object.keys(tokens.type.families)) out.push(`  --font-${key}: var(--font-${key});`);
  for (const t of tokens.radius?.tokens ?? [])
    out.push(`  --radius-${t.name.replace(/^radius-/, '')}: var(--${t.name});`);
  for (const t of tokens.shadow?.tokens ?? [])
    out.push(`  --shadow-${t.name.replace(/^shadow-/, '')}: var(--${t.name});`);
  for (const t of tokens.easing?.tokens ?? []) out.push(`  --ease-${t.name.replace(/^ease-/, '')}: var(--${t.name});`);
  for (const t of tokens.spacing?.tokens ?? [])
    out.push(`  --spacing-${t.name.replace(/^space-/, '')}: var(--${t.name});`);
  out.push('}');
  return out.join('\n') + '\n';
}

function main() {
  const tokens = JSON.parse(readFileSync(SOURCE, 'utf8'));
  const outputs = [
    [TARGET, buildCss(tokens)],
    [TAILWIND_TARGET, buildTailwindTheme(tokens)],
  ];
  if (process.argv.includes('--check')) {
    let stale = false;
    for (const [path, css] of outputs) {
      let current = '';
      try {
        current = readFileSync(path, 'utf8');
      } catch {
        /* missing file counts as stale */
      }
      if (current !== css) {
        console.error(`${path} is out of date: run pnpm tokens`);
        stale = true;
      }
    }
    if (stale) process.exit(1);
    console.log('generated CSS is up to date');
    return;
  }
  for (const [path, css] of outputs) {
    writeFileSync(path, css);
    console.log(`wrote ${path}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
