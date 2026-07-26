import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile } from 'node:fs/promises';

const apiProxy = process.env.VITE_API_PROXY || process.env.VITE_API_BASE_URL || 'http://localhost:8080';
const clientRouteRoots = new Set([
  'ai', 'analysis', 'analysisadmin', 'app', 'apps', 'assistant', 'budget', 'connect', 'connections',
  'destinations', 'diet', 'finance', 'home', 'login', 'memo', 'more', 'mypage', 'notes', 'partners',
  'planner', 'plans', 'portfolio', 'schedule', 'scheduler', 'signup', 'travel', 'workout'
]);

const htmlRouteFallback = {
  name: 'html-route-fallback',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      const requestUrl = request.url || '';
      const pathname = requestUrl.split('?')[0];
      const routeRoot = pathname.split('/').filter(Boolean)[0] || '';
      const isClientRoute = !pathname.includes('.') && clientRouteRoots.has(routeRoot);
      if (isClientRoute) request.url = `/${requestUrl.includes('?') ? requestUrl.slice(requestUrl.indexOf('?')) : ''}`;
      next();
    });
  }
};

const LITE_PUBLIC_FILES = [
  'manifest.webmanifest',
  'sw.js',
  'assets/lifehub-icons/app-icon-192.png',
  'assets/lifehub-icons/app-icon-512.png',
  'assets/lifehub-icons/calendar.webp',
  'assets/lifehub-icons/habit.webp'
];

const litePublicAssets = {
  name: 'lite-public-assets',
  apply: 'build',
  async buildStart() {
    await Promise.all(LITE_PUBLIC_FILES.map(async (fileName) => {
      const source = await readFile(new URL(`./public/${fileName}`, import.meta.url));
      this.emitFile({ type: 'asset', fileName, source });
    }));
  }
};

export default defineConfig(({ command }) => ({
  cacheDir: process.env.VITE_CACHE_DIR || 'node_modules/.vite-ai-assitant',
  publicDir: command === 'build' ? false : 'public',
  plugins: [htmlRouteFallback, react(), litePublicAssets],
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
}));
