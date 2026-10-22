import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Migration utilities use node:test and are run by test:migration.
    include: ['src/**/*.{spec,test}.ts'],
  },
});
