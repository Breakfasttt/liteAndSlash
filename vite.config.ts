import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist/client',
  },
  server: {
    port: 5173,
    host: true
  }
});
