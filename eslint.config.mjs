import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const HEX_COLOR = String.raw`#[0-9a-fA-F]{3,8}\b`;

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
      ],
    },
  },
]);
