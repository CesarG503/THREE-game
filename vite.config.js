import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        play: resolve(__dirname, 'play.html'),
        editor: resolve(__dirname, 'editor.html'),
      },
    },
    outDir: 'dist',
    emptyOutDir: true
  }
})
