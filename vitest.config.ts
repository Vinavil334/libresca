import { defineConfig } from 'vitest/config';

// One command runs the unit tests of every shared package.
// The web app gets its own project when it has unit tests; its browser tests use Playwright.
export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
});
