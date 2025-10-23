import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'public',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: '../drive_resources',
    emptyOutDir: false,
    assetsDir: '',
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'public/index.html'),
    },
  },
  publicDir: 'public',
  css: {
    preprocessorOptions: {
      scss: {}
    }
  },
});

