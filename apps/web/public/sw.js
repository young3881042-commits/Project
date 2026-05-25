const CACHE_NAME = 'ai-assitant-v2';
const APP_SHELL_URL = '/app';
const APP_SHELL = [APP_SHELL_URL, '/manifest.webmanifest', '/icon.svg'];

const hasPathPrefix = (pathname, prefix) => (
  pathname === prefix || pathname.startsWith(`${prefix}/`)
);

const isNavigationRequest = (request) => (
  request.mode === 'navigate'
  || (request.headers.get('accept') || '').includes('text/html')
);

const isAppNavigationPath = (pathname) => {
  if (pathname === '/healthz' || hasPathPrefix(pathname, '/api') || hasPathPrefix(pathname, '/ws')) {
    return false;
  }
  if (hasPathPrefix(pathname, '/assets') || hasPathPrefix(pathname, '/downloads')) {
    return false;
  }
  const leaf = pathname.split('/').pop() || '';
  return !leaf.includes('.');
};

const isCacheableResponse = (response) => (
  response && response.ok && response.type === 'basic'
);

const updateCache = async (request, response) => {
  if (!isCacheableResponse(response)) return;
  const copy = response.clone();
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, copy);
};

const fetchAppShell = async () => {
  try {
    const response = await fetch(APP_SHELL_URL, { cache: 'no-store' });
    if (isCacheableResponse(response)) {
      updateCache(APP_SHELL_URL, response).catch(() => undefined);
      return response;
    }
  } catch (error) {
    // Fall back to the cached shell below.
  }
  return caches.match(APP_SHELL_URL);
};

const handleNavigation = async (request) => {
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      updateCache(APP_SHELL_URL, response).catch(() => undefined);
      return response;
    }
    return await fetchAppShell() || response;
  } catch (error) {
    return await caches.match(APP_SHELL_URL) || Response.error();
  }
};

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || hasPathPrefix(url.pathname, '/api') || hasPathPrefix(url.pathname, '/ws')) return;

  if (isNavigationRequest(request) && isAppNavigationPath(url.pathname)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (isCacheableResponse(response)) {
          updateCache(request, response).catch(() => undefined);
          return response;
        }
        return caches.match(request).then((cached) => cached || response);
      })
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});
