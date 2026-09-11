import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureTravelDayImage, travelImageKey } from './travelDayImageStore.js';
const input = { owner: 'test', title: '서울 여행', destination: '서울', day: { day: 1, date: '2026-10-10', title: '첫날', items: [{ time: '10:00', title: '산책', place: '경복궁' }] } };
const image = { dataUrl: 'data:image/png;base64,TEST', missingPlaces: [] };
test('saved daily image is reused without geocoding or drawing again', async () => {
  const result = await ensureTravelDayImage(input, { read: async () => image, search: () => assert.fail('must reuse'), render: () => assert.fail('must reuse'), save: () => assert.fail('must reuse') });
  assert.equal(result.dataUrl, image.dataUrl); assert.equal(result.persisted, true);
  assert.notEqual(await travelImageKey(input), await travelImageKey({ ...input, day: { ...input.day, day: 2, date: '2026-10-11' } }));
  assert.notEqual(await travelImageKey(input), await travelImageKey({ ...input, owner: 'another' }));
});
test('one generated PNG is stored, and explicit regeneration replaces that same day key', async () => {
  const writes = [], options = { read: async () => null, search: async () => ({ candidates: [{ lat: 37.5, lon: 127 }] }), render: async () => ({ dataUrl: image.dataUrl, missingTiles: false }), save: async (...args) => writes.push(args) };
  assert.equal((await ensureTravelDayImage(input, options)).persisted, true);
  await ensureTravelDayImage(input, { ...options, force: true, read: async () => image });
  assert.equal(writes.length, 2); assert.equal(writes[0][0], writes[1][0]);
});
test('incomplete map regeneration preserves the saved image and storage failure is reported', async () => {
  const options = { force: true, read: async () => image, search: async () => ({ candidates: [{ lat: 37, lon: 127 }] }), render: async () => ({ ...image, missingTiles: true }), save: () => assert.fail('must preserve old image') };
  assert.equal((await ensureTravelDayImage(input, options)).dataUrl, image.dataUrl);
  assert.equal((await ensureTravelDayImage(input, { ...options, search: async () => ({ candidates: [] }) })).dataUrl, image.dataUrl);
  const value = await ensureTravelDayImage(input, { ...options, render: async () => ({ ...image, missingTiles: false }), save: async () => { throw new Error('저장 공간 부족'); } });
  assert.equal(value.persisted, false); assert.match(value.storageError, /저장 공간/);
});

test('missing coordinates do not hide a newly generated itinerary image', async () => {
  let stored;
  const value = await ensureTravelDayImage(input, { read: async () => null, search: async () => ({ candidates: [] }), render: async () => ({ ...image, missingTiles: false }), save: async (_, image) => { stored = image; return { dataUrl: 'stored-file-url' }; } });
  assert.ok(stored.dataUrl); assert.equal(stored.itinerary.day.day, 1);
  assert.equal(value.dataUrl, 'stored-file-url'); assert.equal(value.persisted, true); assert.match(value.storageError, /일정만 이미지/);
});
