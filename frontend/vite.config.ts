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
      // Proxy /api/* → Python FastAPI backend on port 8000
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
