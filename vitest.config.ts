import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{apps,packages}/*/{src,test}/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    // Server tests open their own PGlite inside the test; under the parallel suite that passes 5 s.
    testTimeout: 30_000,
  },
});
