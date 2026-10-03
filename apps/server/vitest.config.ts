import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'server',
    setupFiles: ['./test/setup.ts'],
  },
});
