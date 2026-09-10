import test from 'node:test';
import assert from 'node:assert/strict';
import { newTravelDraft, validateTravelInput, validateTravelPlan, importLegacyTravelDraft, publicTravelSource, travelDateOffset } from './travelModel.js';
import { restoreTravelWorkspace } from './travelWorkspace.js';
import { createLifeHubBackup, serializeLifeHubBackup, parseLifeHubBackup } from '../backup/lifeHubBackupCodec.js';
import { isOrbitDataKey } from '../../utils/orbitIndexedDbStorage.js';

export const sampleInput = () => ({ ...newTravelDraft('2026-12-31'), destination: '서울', days: 2 });
export const samplePlan = (input = sampleInput()) => ({ title: '서울 산책', summary: '가까운 장소를 천천히 둘러봐요.', days: Array.from({ length: input.days }, (_, index) => ({ day: index + 1, title: '도심 산책', items: [{ time: '10:00', title: '공원', place: '서울숲', description: '산책 후 쉬어가요.', transport: '지하철 이동', estimatedCost: '입장료 확인 필요' }] })), tips: ['운영시간은 출발 전 확인해주세요.'], sources: [{ title: '서울 관광', url: 'https://english.visitseoul.net/' }] });

test('travel input allows only explicit travel fields and limits dates/size/count', () => {
  const input = sampleInput();
  assert.deepEqual(validateTravelInput({ ...input, privateFinance: 'never sent' }), input);
  for (const change of [{ days: 0 }, { days: 15 }, { people: 21 }, { startDate: '2026-02-30' }, { startDate: '9999-12-31' }, { destination: ' ' }, { requests: 'x'.repeat(2001) }, { interests: ['unknown'] }]) assert.throws(() => validateTravelInput({ ...input, ...change }));
  assert.equal(travelDateOffset('2026-12-31', 1), '2027-01-01');
});
test('legacy draft import keeps original and maps only travel preferences', () => {
  const legacy = { destinationName: '제주', days: 3, notes: '렌터카', accessToken: 'secret' };
  const before = structuredClone(legacy);
  const imported = importLegacyTravelDraft(legacy, '2026-10-01');
  assert.equal(imported.destination, '제주'); assert.equal(imported.requests, '렌터카');
  assert.equal(imported.accessToken, undefined); assert.deepEqual(legacy, before);
  assert.equal(importLegacyTravelDraft(null, '2026-10-01'), null);
});
test('plan validation enforces requested days, chronology, deduplication and public references', () => {
  const input = sampleInput();
  const valid = validateTravelPlan(samplePlan(), input);
  assert.equal(valid.days[1].date, '2027-01-01');
  for (const mutate of [p => p.days.pop(), p => { p.days[0].day = 2; }, p => { p.days[0] = null; }, p => { p.days[0].items[0].time = '25:00'; }, p => p.days[0].items.push({ ...p.days[0].items[0] }), p => p.days[0].items.push({ ...p.days[0].items[0], time: '09:00' })]) {
    const plan = samplePlan(); mutate(plan); assert.throws(() => validateTravelPlan(plan, input));
  }
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://127.0.0.1', 'https://user:pass@example.com', 'https://router.local', 'https://[::1]', 'https://example.com:4319']) assert.equal(publicTravelSource(url), '');
  assert.equal(publicTravelSource('https://visitseoul.net/'), 'https://visitseoul.net/');
});

test('draft and generated preview survive reload without private connection state', () => {
  const draft = { ...sampleInput(), requests: '가'.repeat(2000), people: 4, pace: '알차게' };
  const jobId = '01234567-89ab-4def-8123-456789abcdef';
  const restored = restoreTravelWorkspace({ draft, jobId, input: sampleInput(), result: samplePlan(), token: 'not-public' }, '2026-10-01');
  assert.deepEqual(restored.draft, draft); assert.equal(restored.result.title, '서울 산책');
  assert.equal(restored.jobId, jobId); assert.equal(restored.token, undefined);
  assert.equal(restoreTravelWorkspace({ draft, jobId: '../../status', input: sampleInput(), result: samplePlan() }, '2026-10-01').result, null);
  assert.ok(isOrbitDataKey('orbit-travel-workspace:v1:guest'));
  assert.ok(!isOrbitDataKey('orbit-travel-session-token'));
});
test('saved itinerary and legacy checklists round-trip through the existing versioned backup', () => {
  const itinerary = validateTravelPlan(samplePlan(), sampleInput());
  const trips = [{ id: 'old', title: '이전 여행', checklist: [{ text: '숙소', done: true }] }, { id: 'new', title: itinerary.title, plannerInput: sampleInput(), itinerary }];
  const backup = createLifeHubBackup({ owner: 'guest', createdAt: '2026-09-06T00:00:00.000Z', appVersion: '0.7.0', data: { trips } });
  const restored = parseLifeHubBackup(serializeLifeHubBackup(backup));
  assert.deepEqual(restored.data.trips, trips);
});

test('new generation stays inside 10-22 while old saved times remain readable', async () => {
  const { validateGeneratedTravelPlan } = await import('./travelModel.js');
  const input = sampleInput(), plan = samplePlan(input);
  plan.days[0].items.push({ ...plan.days[0].items[0], time: '22:00', title: '숙소에서 쉬기' });
  assert.equal(validateGeneratedTravelPlan(plan, input).days[0].items.at(-1).time, '22:00');
  for (const time of ['09:59', '22:01']) {
    const old = samplePlan(input); old.days[0].items[0].time = time;
    assert.throws(() => validateGeneratedTravelPlan(old, input), /10:00~22:00/);
    assert.equal(validateTravelPlan(old, input).days[0].items[0].time, time);
  }
});
