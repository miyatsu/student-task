import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    testTimeout: 15_000,
    include: [
      'src/**/*.ui.test.ts',
      'src/**/*.ui.test.tsx',
      'src/**/*.app.test.ts',
      'src/**/*.app.test.tsx',
    ],
    setupFiles: ['./src/test/setup.ts'],
  },
});