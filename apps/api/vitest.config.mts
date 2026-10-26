import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';

const appRequire = createRequire(new URL('../app/package.json', import.meta.url));
export default defineConfig({
  resolve: {
    // Mobile service tests and their mocks must resolve the app's installed SDK.
    alias: Object.fromEntries(
      [
        'expo/fetch',
        'expo-file-system',
        'expo-constants',
        'expo/src/winter/fetch/convertFormData',
      ].map((name) => [name, appRequire.resolve(name)]),
    ),
  },
  test: {
    setupFiles: ['test/setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
