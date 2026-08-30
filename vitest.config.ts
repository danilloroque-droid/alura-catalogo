import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@compartilhado': fileURLToPath(new URL('./shared/src', import.meta.url)),
    },
  },
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    include: ['**/tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**'],
  },
});
