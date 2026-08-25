import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

const proxyTarget = process.env.API_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    https: true,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/public': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
});
