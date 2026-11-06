// Run with: node --test packages/tokens/scripts/build-css.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCss, resolveValue, valueForTheme } from './build-css.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(join(ROOT, 'tokens.json'), 'utf8'));
const colors = Object.fromEntries(tokens.color.tokens.map((t) => [t.name, t]));
const THEMES = tokens.color.themes.map((t) => t.id);

function hex(name, theme) {
  const v = valueForTheme(colors[name], theme, THEMES[0]);
  const alias = /^\{(.+)\}$/.exec(v);
  return alias ? hex(alias[1], theme) : v;
}
function luminance(h) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

test('the minimum names from DESIGN_BRIEF.md exist', () => {
  const css = buildCss(tokens);
  for (const name of ['color-surface', 'color-surface-raised', 'color-text', 'color-text-muted', 'color-accent',
    'color-border', 'color-success', 'color-warning', 'color-danger', 'font-display', 'font-body',
    'radius-card', 'shadow-card', 'motion-gentle']) {
    assert.match(css, new RegExp(`--${name}:`), name);
  }
});

test('token names are unique across families', () => {
  const names = ['color', 'shadow', 'spacing', 'radius', 'border', 'duration', 'easing']
    .flatMap((f) => (tokens[f]?.tokens ?? []).map((t) => t.name));
  assert.equal(new Set(names).size, names.length);
});

test('every color token has a valid value in every theme', () => {
  for (const t of tokens.color.tokens) {
    for (const theme of THEMES) assert.match(hex(t.name, theme), /^#[0-9a-f]{6}$/i, `${t.name} in ${theme}`);
  }
});

test('aliases become CSS variables', () => {
  assert.equal(resolveValue('{color-accent}'), 'var(--color-accent)');
  assert.equal(resolveValue('#ffffff'), '#ffffff');
});

test('the notte theme overrides colors and follows prefers-color-scheme', () => {
  const css = buildCss(tokens);
  assert.match(css, /\[data-theme="notte"\] \{[^}]*--color-surface: #211a26;/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
});

test('display styles carry the soft Fraunces axes', () => {
  assert.match(buildCss(tokens), /\.type-display-xl \{[^}]*font-variation-settings: 'SOFT' 100, 'WONK' 1;/);
});

test('text pairs meet WCAG AA in both themes', () => {
  const pairs = [
    ['color-text', 'color-surface'], ['color-text', 'color-surface-raised'], ['color-text', 'color-ticket'],
    ['color-text', 'color-why'], ['color-text', 'color-canopy-soft'],
    ['color-text-muted', 'color-surface'], ['color-text-muted', 'color-surface-raised'],
    ['color-link', 'color-surface'], ['color-link', 'color-surface-raised'],
    ['color-on-accent', 'color-accent'], ['color-on-canopy', 'color-canopy'], ['color-on-honey', 'color-honey'],
    ['color-on-inverse', 'color-inverse'],
    ['color-success', 'color-surface'], ['color-success', 'color-surface-raised'], ['color-success', 'color-why'],
    ['color-warning', 'color-surface'], ['color-danger', 'color-surface'], ['color-danger', 'color-surface-raised']
  ];
  for (const theme of THEMES) {
    for (const [fg, bg] of pairs) {
      const ratio = contrast(hex(fg, theme), hex(bg, theme));
      assert.ok(ratio >= 4.5, `${fg} on ${bg} in ${theme}: ${ratio.toFixed(2)}`);
    }
  }
});

test('the focus ring reaches 3:1 on every surface', () => {
  for (const theme of THEMES) {
    for (const bg of ['color-surface', 'color-surface-raised']) {
      assert.ok(contrast(hex('color-focus', theme), hex(bg, theme)) >= 3, `${theme} ${bg}`);
    }
  }
});

test('tokens.css is up to date', () => {
  assert.equal(readFileSync(join(ROOT, 'tokens.css'), 'utf8'), buildCss(tokens));
});
