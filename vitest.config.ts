import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // docs/ の submodule（例: pasta の VSCode 拡張）が持つテストを拾わない
    include: ['tests/**/*.test.ts'],
  },
});
