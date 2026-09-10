import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { newTravelDraft, validateTravelPlan } from './travelModel.js';

test('travel form/page render a compact accessible flow without archived destination/search widgets', async () => {
  const vite = await createServer({ root: new URL('../../../', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { default: Form } = await vite.ssrLoadModule('/src/components/travel/TravelPlannerPage.jsx');
    const html = renderToStaticMarkup(React.createElement(Form, { draft: newTravelDraft('2026-10-10'), onChange() {}, onSubmit() {}, onImportDraft() {}, busy: false }));
    for (const id of ['travel-destination', 'travel-start', 'travel-days', 'travel-people', 'travel-requests']) {
      assert.ok(html.includes(`id="${id}"`)); assert.ok(html.includes(`for="${id}"`));
    }
    assert.ok(html.includes('인원 늘리기')); assert.ok(html.includes('여행 속도')); assert.ok(html.includes('10.12까지'));
    assert.ok(html.includes('이전 초안 불러오기')); assert.ok(html.includes('여행 일정 만들기'));
    assert.ok(!html.includes('open=""')); assert.ok(!html.includes('destinationSearch'));
    const busy = renderToStaticMarkup(React.createElement(Form, { draft: newTravelDraft('2026-10-10'), busy: true }));
    assert.ok(busy.includes('<fieldset disabled=""'));
    const { default: Page } = await vite.ssrLoadModule('/src/features/travel/TravelPage.jsx');
    const page = renderToStaticMarkup(React.createElement(Page, { owner: 'test', model: { today: '2026-10-10', trips: [] }, readTrips: () => [], saveTrips: () => ({ saved: false }), refresh() {} }));
    assert.ok(!page.includes('A LITTLE FURTHER'));
    assert.ok(page.indexOf('orbitTravelForm') < page.indexOf('orbitTravelConnection'));
    assert.ok(page.includes('계획 만들기')); assert.ok(page.includes('내 여행')); assert.ok(page.includes('AI 실행 환경 확인 중'));
    assert.ok(!page.includes('accessToken')); assert.ok(!page.includes('apiKey'));
  } finally { await vite.close(); }
});
test('itinerary rendering escapes generated content and exposes dates/uncertainty without raw HTML', async () => {
  const vite = await createServer({ root: new URL('../../../', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { default: Detail } = await vite.ssrLoadModule('/src/features/travel/TravelPlanDetail.jsx');
    const input = { ...newTravelDraft('2026-10-10'), destination: '서울', days: 1 };
    const plan = validateTravelPlan({ title: '<script>bad()</script>', summary: '산책', days: [{ day: 1, title: '첫날', items: [{ time: '10:00', title: '공원', place: '서울', description: '<img onerror=bad()>', transport: '도보', estimatedCost: '확인 필요' }] }], tips: [], sources: [] }, input);
    const html = renderToStaticMarkup(React.createElement(Detail, { plan }));
    assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;script&gt;')); assert.ok(html.includes('10.10'));
    assert.ok(html.includes('orbitTravelStop')); assert.ok(html.includes('장소를 누르면'));
    assert.ok(html.includes('AI가 만든 초안')); assert.ok(html.includes('aria-pressed="true"'));
  } finally { await vite.close(); }
});
test('Android travel adapter permits only fixed loopback actions and leaves WebView restrictions intact', async () => {
  const root = new URL('../../../../../', import.meta.url);
  const source = file => readFile(new URL(file, root), 'utf8');
  const [native, policy, main, manifest, config, css, entry] = await Promise.all([
    source('apps/mobile/android/src/com/platform/aiassitant/TravelApiCoordinator.java'), source('apps/mobile/android/src/com/platform/aiassitant/TravelApiPolicy.java'),
    source('apps/mobile/android/src/com/platform/aiassitant/MainActivity.java'), source('apps/mobile/android/AndroidManifest.xml'), source('apps/mobile/android/res/xml/travel_network_security.xml'),
    source('apps/web/src/styles/orbit-travel.css'), source('apps/web/src/lifehub-entry.css')
  ]);
  assert.ok(native.includes('http://127.0.0.1:4319/api/travel/')); assert.ok(native.includes('setInstanceFollowRedirects(false)'));
  assert.ok(native.includes('data = new JSONObject().put("connected", true)'));
  assert.ok(!native.includes('new URL(payload)')); assert.ok(!policy.includes('pair-code'));
  assert.match(main, /isTrustedNativeCaller\(\) && coordinator != null\) coordinator.request/);
  assert.ok(main.includes('MIXED_CONTENT_NEVER_ALLOW'));
  assert.ok(manifest.includes('android:usesCleartextTraffic="false"'));
  assert.ok(config.includes('<base-config cleartextTrafficPermitted="false" />'));
  assert.equal((config.match(/<domain /g) || []).length, 1);
  assert.ok(config.includes('<domain includeSubdomains="false">127.0.0.1</domain>'));
  assert.ok(css.includes('grid-template-columns: repeat(5, minmax(0, 1fr))'));
  assert.ok(entry.includes("@import './styles/orbit-travel.css'"));
});

test('standby connection needs no unsupported Termux service or runtime permission', async () => {
  const root = new URL('../../../../../', import.meta.url);
  const source = file => readFile(new URL(file, root), 'utf8');
  const [native, main, manifest, hook, page] = await Promise.all([
    source('apps/mobile/android/src/com/platform/aiassitant/TravelApiCoordinator.java'),
    source('apps/mobile/android/src/com/platform/aiassitant/MainActivity.java'),
    source('apps/mobile/android/AndroidManifest.xml'),
    source('apps/web/src/features/travel/useTravelPlanner.js'),
    source('apps/web/src/features/travel/TravelPage.jsx')
  ]);
  for (const text of [native, main, manifest]) assert.doesNotMatch(text, /RUN_COMMAND|TravelRuntimeLauncher|TravelRuntimeReceiver/);
  assert.match(native, /runtime\.availability\(\)/);
  assert.match(native, /putString\(TOKEN_KEY, credential\)\.commit\(\)/);
  assert.match(hook, /info\.authenticated/);
  assert.match(hook, /document\.visibilityState === 'hidden'/);
  assert.doesNotMatch(page, /권한을 허용|2분 동안/);
});

test('restored result opens directly into itinerary; pending work shows progress without editable inputs', async () => {
  const vite = await createServer({ root: new URL('../../../', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom' });
  const previous = globalThis.localStorage;
  try {
    const input = { ...newTravelDraft('2026-10-10'), destination: '서울', days: 1 };
    const result = validateTravelPlan({ title: '서울 산책', summary: '공원에서 쉬기', days: [{ day: 1, title: '가벼운 하루', items: [{ time: '10:00', title: '공원', place: '서울', description: '산책해요', transport: '도보', estimatedCost: '무료' }] }], tips: [], sources: [] }, input);
    const workspace = { draft: input, input, result, jobId: '11111111-1111-4111-8111-111111111111' };
    globalThis.localStorage = { getItem: key => key === 'orbit-travel-workspace:v1:stage' ? JSON.stringify(workspace) : null };
    const { default: Page } = await vite.ssrLoadModule('/src/features/travel/TravelPage.jsx');
    const props = { owner: 'stage', model: { today: '2026-10-10', trips: [] }, readTrips: () => [], saveTrips: () => ({ saved: true }), refresh() {} };
    const html = renderToStaticMarkup(React.createElement(Page, props));
    assert.ok(html.includes('여행 일정 완성')); assert.ok(html.includes('조건 수정')); assert.ok(html.includes('저장하기'));
    assert.ok(html.includes('모두 펼치기')); assert.ok(!html.includes('id="travel-destination"'));
    workspace.result = null;
    const pending = renderToStaticMarkup(React.createElement(Page, props));
    assert.ok(pending.includes('여행 생성 진행 상태')); assert.ok(pending.includes('생성 취소'));
    assert.ok(!pending.includes('id="travel-destination"')); assert.ok(!pending.includes('여행 일정 완성'));
  } finally { globalThis.localStorage = previous; await vite.close(); }
});
