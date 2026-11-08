import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const HEX_COLOR = String.raw`#[0-9a-fA-F]{3,8}\b`;

// Spacing utilities outside the token scale (1-6 and 8, see packages/tokens): Tailwind
// silently drops them, so `pl-12` or `inset-0` render nothing. Use a token step or an
// arbitrary value such as `inset-[0]`.
const SPACING =
  '(?:p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|bottom|left|right|w|h|size|min-w|min-h|translate-x|translate-y)';
const OFF_SCALE = String.raw`(?:^|\s|:)-?${SPACING}-(?:0|7|9|[1-9][0-9]+|px|[0-9]\.5)(?:\s|$)`;

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/.next/',
    '**/next-env.d.ts',
    '**/playwright-report/',
    '**/test-results/',
    'data/',
    'tools/spikes/',
  ]),

  // Shared packages and root config files.
  {
    files: ['packages/**/*.{ts,mjs}', '*.{ts,mjs}'],
    extends: [js.configs.recommended, tseslint.configs.strict],
    languageOptions: { globals: globals.node },
  },

  // Shared packages must stay usable by a future React Native app (ADR-0005).
  {
    files: ['packages/**/*.{ts,mjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['next', 'next/*', 'next-intl', 'next-intl/*'],
              message: 'Shared packages must not depend on Next.js.',
            },
            { group: ['react-dom', 'react-dom/*'], message: 'Shared packages must not depend on React DOM.' },
          ],
        },
      ],
    },
  },

  // Web app: Next.js rules.
  {
    files: ['apps/web/**/*.{ts,tsx,mjs}'],
    extends: [nextVitals, nextTypescript],
    settings: { next: { rootDir: 'apps/web' } },
  },

  // The UI uses only semantic tokens: no colors written by hand (CLAUDE.md).
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=/${HEX_COLOR}/]`,
          message: 'Use a token class (bg-surface, text-text…) instead of a hex color.',
        },
        {
          selector: `TemplateElement[value.raw=/${HEX_COLOR}/]`,
          message: 'Use a token class (bg-surface, text-text…) instead of a hex color.',
        },
        {
          selector: `Literal[value=/${OFF_SCALE}/]`,
          message: 'Spacing outside the token scale (1-6, 8) renders nothing: use a token step or an arbitrary value.',
        },
        {
          selector: `TemplateElement[value.raw=/${OFF_SCALE}/]`,
          message: 'Spacing outside the token scale (1-6, 8) renders nothing: use a token step or an arbitrary value.',
        },
      ],
    },
  },
]);
