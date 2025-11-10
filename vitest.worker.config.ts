import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['worker/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.git', 'lib/__tests__'],
    setupFiles: ['./vitest.worker.setup.ts'],
  },
})