import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { initializeOrbitIndexedDbStorage } from './utils/orbitIndexedDbStorage.js';
import './lifehub-entry.css';

async function renderOrbit() {
  await initializeOrbitIndexedDbStorage();
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void renderOrbit();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const embeddedAndroidApp = Boolean(window.AiAssistantNative)
      && window.location.hostname === 'appassets.androidplatform.net';
    if (embeddedAndroidApp) {
      const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
      await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
      if ('caches' in window) {
        const cacheKeys = await window.caches.keys().catch(() => []);
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key).catch(() => false)));
      }
      return;
    }
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
