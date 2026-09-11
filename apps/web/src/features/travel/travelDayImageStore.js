import { hasTravelImageFiles, travelImageFile } from './travelImageFile.js';
const DATABASE = 'orbit-travel-images';
const STORE = 'days';
export async function travelImageKey({ owner = 'local', title, destination, day }) {
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 1, owner, title, destination, day }));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function database() {
  if (!globalThis.indexedDB) throw new Error('이 환경에서 일정 이미지를 저장할 수 없어요.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('일정 이미지 저장소를 열지 못했어요.'));
    request.onblocked = () => reject(new Error('이미지 저장소가 사용 중이에요. 앱을 다시 열어주세요.'));
  });
}
export async function readTravelDayImage(key) {
  if (hasTravelImageFiles()) { const file = await travelImageFile('read', key); if (file) return file; }
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly'), request = tx.objectStore(STORE).get(key);
    tx.oncomplete = () => { const value = request.result; resolve(value && /^data:image\/png;base64,/.test(value.dataUrl) ? value : null); };
    tx.onabort = tx.onerror = () => reject(new Error('저장된 일정 이미지를 읽지 못했어요.'));
  }); } finally { db.close(); }
}
export async function saveTravelDayImage(key, image) {
  if (hasTravelImageFiles()) return travelImageFile('save', key, image.dataUrl, window, image.itinerary || {});
  if (!/^data:image\/png;base64,/.test(image.dataUrl) || image.dataUrl.length > 5600000) throw new Error('일정 이미지가 너무 커서 저장하지 못했어요.');
  const db = await database();
  try { await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ key, ...image, savedAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onabort = tx.onerror = () => reject(new Error('저장 공간이 부족하거나 이미지 저장에 실패했어요. 이미지 저장 버튼으로 파일을 보관해주세요.'));
  }); } finally { db.close(); }
}
// Cache lookup happens before any location or tile requests. Failed regeneration preserves the old image.
export async function ensureTravelDayImage(input, { force = false, signal, read = readTravelDayImage, save = saveTravelDayImage, search, render } = {}) {
  const key = await travelImageKey(input);
  let storageError = '', existing = null;
  try { existing = await read(key); if (existing && !force) {
    if (hasTravelImageFiles() && existing.dataUrl.startsWith('data:')) { try { return { ...existing, ...await save(key, existing), persisted: true }; } catch { /* Keep the original available for viewing. */ } }
    return { ...existing, persisted: true };
  } }
  catch (error) { storageError = error.message; }
  signal?.throwIfAborted();
  const points = [], failed = [];
  for (const item of input.day.items) {
    signal?.throwIfAborted();
    try {
      const value = await search(`${input.destination} ${item.place}`.trim().slice(0, 240));
      const point = value.candidates?.find(p => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 85 && Math.abs(p.lon) <= 180);
      points.push(point || null); if (!point) failed.push(item.place);
    } catch { points.push(null); failed.push(item.place); }
  }
  signal?.throwIfAborted();
  const result = await render({ ...input, points, signal });
  signal?.throwIfAborted();
  const warning = !points.some(Boolean) ? '장소 위치를 확인하지 못해 일정만 이미지로 표시했어요. 지도는 다시 만들기로 재시도할 수 있어요.' : result.missingTiles ? '지도 배경 일부를 불러오지 못했어요. 일정 이미지는 표시하며 지도를 다시 만들 수 있어요.' : '';
  if (warning && existing) return { ...existing, persisted: true, storageError: '새 지도 조회에 실패해 기존 이미지를 유지했어요.' };
  const value = { dataUrl: result.dataUrl, missingPlaces: failed, itinerary: input };
  try { const stored = await save(key, value); return { ...value, ...(stored || {}), persisted: true, storageError: warning }; }
  catch (error) { return { ...value, persisted: false, storageError: error.message || storageError }; }
}
