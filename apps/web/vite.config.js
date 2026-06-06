import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxy = process.env.VITE_API_PROXY || process.env.VITE_API_BASE_URL || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxy,
        changeOrigin: true
      },
      '/ws': {
        target: apiProxy,
        changeOrigin: true,
        ws: true
      }
    }
  }
});
