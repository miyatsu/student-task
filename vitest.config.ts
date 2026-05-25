import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.ui.test.ts', 'src/**/*.ui.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
  },
});