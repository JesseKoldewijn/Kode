import { defineConfig } from 'vitest/config';
import { ripple } from '@ripple-ts/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [ripple(), tailwindcss()] as any,
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    globals: true,
    testTimeout: 30000,
    setupFiles: ['./tests/setup.ts'],
    isolate: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/mocks/**', 'src/lib/index.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
  resolve: {
    conditions: ['browser', 'import', 'module'],
  },
});
