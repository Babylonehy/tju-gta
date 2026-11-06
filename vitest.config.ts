import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'beiyang-field-notes',
    environment: 'node',
    include: ['assets/**/__tests__/*.test.ts'],
  },
});
