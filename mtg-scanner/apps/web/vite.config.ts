import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mtg-scanner/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
      '@mtg-scanner/core/components': path.resolve(__dirname, '../../packages/core/src/components.ts'),
    },
  },
  optimizeDeps: {
    exclude: ['tesseract.js'],
  },
  server: {
    port: 5173,
  },
});
