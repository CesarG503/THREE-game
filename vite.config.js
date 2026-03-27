import { defineConfig } from 'vite'

export default defineConfig({
  root: 'public',
  // Stop pointing to public as a static asset dir since it is now the project root
  publicDir: false,
  build: {
    // Output directly above public when compiled
    outDir: '../dist',
    emptyOutDir: true
  }
})
