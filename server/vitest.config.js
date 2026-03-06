import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals:     true,
    // Run tests sequentially — they share a real DB
    pool:        'forks',
    poolOptions: { forks: { singleFork: true } },
    // Load test env before anything else
    setupFiles: ['./tests/setup.js'],
  },
});
