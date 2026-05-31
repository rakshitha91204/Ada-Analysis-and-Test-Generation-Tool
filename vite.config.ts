import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@hpcc-js/wasm'],
  },
  worker: {
    format: 'es',
  },
  server: {
    proxy: {
      // /analyze and /health go directly to backend (no prefix strip)
      '/analyze': { target: 'http://localhost:8001', changeOrigin: true },
      '/health':  { target: 'http://localhost:8001', changeOrigin: true },
      // /api/* goes to backend keeping the /api/ prefix intact
      '/api': { target: 'http://localhost:8001', changeOrigin: true },
    },
  },
});
