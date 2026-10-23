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
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./index.html', import.meta.url)),
      output: {
        manualChunks(id) {
          if (id.includes('animejs')) {
            return 'animejs';
          }
        }
      }
    }
  },
  server: {
    watch: {
      ignored: ['**/playwright-report/**', '**/test-results/**', '**/graphify-out/**', '**/.git/**']
    }
  }
});
