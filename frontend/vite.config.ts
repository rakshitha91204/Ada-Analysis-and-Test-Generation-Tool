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
      // Proxy /api/* → Python FastAPI backend on port 8001 (keep the /api prefix)
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      // Proxy /analyze and /health (root-level FastAPI endpoints)
      '/analyze': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
});
