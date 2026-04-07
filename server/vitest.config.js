import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.mjs', '**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['helpers/**', 'core/**', 'graph/resolvers/**', 'models/**'],
      exclude: ['node_modules/**', '**/test/**']
    },
    setupFiles: ['./__tests__/setup.mjs']
  }
})
