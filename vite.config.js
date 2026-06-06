import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
    target: ['chrome90', 'safari14'],
    minify: 'esbuild',
  },
  server: {
    port: 5173,
    host: true,
    open: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: [
      '@crestron/ch5-crcomlib',
      '@crestron/ch5-webxpanel',
    ],
  },
});
