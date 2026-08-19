import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Simulations are pure and run far faster in Node. Files that genuinely need
    // a DOM opt in with a `@vitest-environment jsdom` docblock.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
