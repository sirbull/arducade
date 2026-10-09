import { defineConfig } from 'vite';

// Relative base so the build works both in the web root and in a sub folder.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
  worker: {
    format: 'es',
  },
});
