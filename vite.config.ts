import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const clientRoot = fileURLToPath(new URL('./src/client', import.meta.url));

export default defineConfig({
  root: '.',
  publicDir: 'public',
  appType: 'spa',
  resolve: {
    alias: {
      '@': clientRoot
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./index.html', import.meta.url))
    }
  }
});
