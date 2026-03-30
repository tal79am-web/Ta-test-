import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    timeout: 30_000,
    testTimeout: 30_000,
    setupFiles: ['./setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@opportunityscout/db': path.resolve(__dirname, '../db/src/client.ts'),
      '@opportunityscout/ai': path.resolve(__dirname, '../ai/src/index.ts'),
      '@opportunityscout/scraper': path.resolve(__dirname, '../scraper/src'),
    },
  },
});
