const CACHE_NAME = 'orbit-web-v26';
const APP_SHELL_URL = '/app';
const APP_ICON_URL = '/assets/lifehub-icons/app-icon-192.png';
const APP_SHELL = [
  APP_SHELL_URL,
  '/manifest.webmanifest',
  APP_ICON_URL,
  '/assets/lifehub-icons/app-icon-512.png',
  '/assets/lifehub-icons/calendar.webp',
  '/assets/lifehub-icons/habit.webp'
];
const BUILD_ASSET_PATTERN = /(?:["']|url\()([^"'()\\\s,]+\.(?:css|js|mjs|png|svg|webp|woff2?))(?:["']|\))/g;

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

const discoverBuildAssets = (source, baseUrl) => {
  const assets = new Set();
  for (const match of source.matchAll(BUILD_ASSET_PATTERN)) {
    try {
      const assetPath = match[1].startsWith('assets/') ? `/${match[1]}` : match[1];
      const url = new URL(assetPath, baseUrl);
      if (url.origin === self.location.origin && hasPathPrefix(url.pathname, '/assets')) {
        assets.add(url.href);
      }
    } catch (error) {
      // Ignore strings that are not valid same-origin asset URLs.
    }
  }
  return assets;
};

const cacheBuildAssetGraph = async (cache) => {
  const shellResponse = await fetch(APP_SHELL_URL, { cache: 'no-store' });
  if (!isCacheableResponse(shellResponse)) return;

  const shellSource = await shellResponse.clone().text();
  await cache.put(APP_SHELL_URL, shellResponse);
  const pending = [...discoverBuildAssets(shellSource, new URL(APP_SHELL_URL, self.location.origin))];
  const visited = new Set();

  while (pending.length) {
    const assetUrl = pending.shift();
    if (visited.has(assetUrl)) continue;
    visited.add(assetUrl);
    try {
      const response = await fetch(assetUrl, { cache: 'no-store' });
      if (!isCacheableResponse(response)) continue;
      const shouldInspect = /\.(?:js|mjs|css)$/.test(new URL(assetUrl).pathname);
      const source = shouldInspect ? await response.clone().text() : '';
      await cache.put(assetUrl, response);
      if (source) {
        discoverBuildAssets(source, assetUrl).forEach((url) => {
          if (!visited.has(url)) pending.push(url);
        });
      }
    } catch (error) {
      // A single optional asset must not prevent the worker from installing.
    }
  }
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
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(APP_SHELL.map(async (url) => {
        try {
          await cache.add(url);
        } catch (error) {
          // Keep installing when an optional shell asset is unavailable.
        }
      }));
      await cacheBuildAssetGraph(cache).catch(() => undefined);
    })
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

self.addEventListener('notificationclick', (event) => {
  const targetPath = event.notification?.data?.path || '/schedule';
  const targetUrl = new URL(targetPath, self.location.origin).href;
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const visibleClient = clientList.find((client) => 'focus' in client);
      if (visibleClient) {
        visibleClient.navigate(targetUrl).catch(() => undefined);
        return visibleClient.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
      return undefined;
    })
  );
});
