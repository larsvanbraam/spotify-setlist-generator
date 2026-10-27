import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/cli.tsx'],
    platform: 'node',
    format: ['esm'],
    target: 'node24',
    clean: true,
  },
  lint: {
    ignorePatterns: ['dist/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    singleQuote: true,
    printWidth: 100,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
