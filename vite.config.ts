import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/VocalTractVisualizer/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  optimizeDeps: {
    include: ['lit', 'mobx', 'three', 'd3']
  }
});