import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

import { E2E_ENV } from './e2e/helpers/env'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['e2e/**/*.e2e.test.ts'],
    // The suites share one Postgres schema and truncate between tests, so they
    // must not overlap. Files run in sequence; tests inside a file already do.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      ...E2E_ENV,
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://shield:shield@localhost:5433/shield_e2e',
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
