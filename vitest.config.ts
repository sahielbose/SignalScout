import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'evals/**/*.test.ts', 'tests/**/*.test.ts'],
    globals: true,
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
