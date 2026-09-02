import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const webRoot = new URL('../', import.meta.url);
const readWebFile = (relativePath) => readFile(new URL(relativePath, webRoot), 'utf8');

test('PWA manifest exposes the Orbit product name', async () => {
  const manifest = JSON.parse(await readWebFile('public/manifest.webmanifest'));

  assert.equal(manifest.name, 'Orbit');
  assert.equal(manifest.short_name, 'Orbit');
});

test('HTML metadata consistently exposes the Orbit product name', async () => {
  const html = await readWebFile('index.html');

  assert.match(html, /<meta name="application-name" content="Orbit" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Orbit" \/>/);
  assert.match(html, /<meta property="og:title" content="Orbit · 나의 생활 허브" \/>/);
  assert.match(html, /<title>Orbit · 나의 생활 허브<\/title>/);
  assert.match(html, /Orbit는 메모, 일정, 가계부를 한곳에서 관리하는 생활 앱입니다/);
  assert.doesNotMatch(html, /운동, 식단/);
  assert.doesNotMatch(html, /ai-assitant/i);
});

test('service worker cache revision is advanced for the lightweight local release', async () => {
  const serviceWorker = await readWebFile('public/sw.js');

  assert.match(serviceWorker, /const CACHE_NAME = 'orbit-web-v43';/);
  assert.doesNotMatch(serviceWorker, /web-v22/);
});

test('keyboard users receive a visible global focus indicator', async () => {
  const styles = await readWebFile('src/lifehub-entry.css');

  assert.match(styles, /#root :is\([\s\S]*?\):focus-visible\s*\{/);
  assert.match(styles, /outline: 3px solid #0f766e !important;/);
  assert.match(styles, /outline-offset: 2px !important;/);
  assert.match(styles, /\[tabindex\]:not\(\[tabindex="-1"\]\)/);
});

test('local app entry excludes legacy workspace bundles and keeps only LifeHub styles', async () => {
  const [main, entry, router] = await Promise.all([
    readWebFile('src/main.jsx'),
    readWebFile('src/lifehub-entry.css'),
    readWebFile('src/routes/AppRouter.jsx')
  ]);

  assert.match(main, /import '\.\/lifehub-entry\.css'/);
  assert.doesNotMatch(main, /import '\.\/styles\.css'/);
  assert.match(entry, /@import '\.\/styles\/lifehub\.css'/);
  assert.match(entry, /@import '\.\/styles\/daily-memo\.css'/);
  assert.match(entry, /@import '\.\/styles\/lifehub-home\.css'/);
  assert.match(entry, /@import '\.\/styles\/lifehub-finance\.css'/);
  assert.doesNotMatch(entry, /lifehub-ai\.css/);
  assert.doesNotMatch(entry, /@import[^;]*(BlockNote|portfolio|localtrip|workspace)/);
  assert.doesNotMatch(router, /AppRuntime|CodeEditor|BlockNote|NotesPage|SchedulerPage/);
  assert.match(router, /const LEGACY_ROUTE_ROOTS = new Set/);
});

test('production build copies only public assets used by the local LifeHub app', async () => {
  const [viteConfig, serviceWorker] = await Promise.all([
    readWebFile('vite.config.js'),
    readWebFile('public/sw.js')
  ]);

  assert.match(viteConfig, /publicDir: command === 'build' \? false : 'public'/);
  assert.match(viteConfig, /const LITE_PUBLIC_FILES = \[/);
  assert.doesNotMatch(viteConfig, /robot-guide|travel-home-hero|home-assistant-hero/);
  assert.doesNotMatch(serviceWorker, /budget\.webp|helper\.webp|workout\.webp/);
});
