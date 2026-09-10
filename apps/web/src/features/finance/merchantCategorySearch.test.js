import test from 'node:test';
import assert from 'node:assert/strict';
import { categoryFromExistingData, publicMerchantName } from './merchantCategoryModel.js';
import { enrichImportedCategories, searchMerchantCategories } from './merchantCategorySearch.js';
import { cardBudgetEntry, recategorizeImportedCardEntries } from './cardTransactionImport.js';
import { repairExistingKakaoPayEntries } from './kakaoPayMerchant.js';
const settings = { categories: ['의료'], rules: [] };
const row = (id, memo, category = '기타') => ({ id, memo, category, type: 'withdraw', amount: 123456, date: '2026-09-09', source: 'card-notification', origin: { kind: 'card-notification', source: 'kakao-pay', eventId: id } });
function fixture(initial) {
  let items = initial; const values = new Map();
  return { get items() { return items; }, set items(value) { items = value; }, options: {
    owner: 'test', selectedSources: ['kakao-pay'], readBudget: () => items,
    saveBudget: next => { items = next; return { saved: true }; }, getSettings: () => settings,
    storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
  } };
}
test('history supplies exact normalized merchant category and existing repairs preserve it', () => {
  const history = [row('1', '별빛 카페', '커피')];
  assert.equal(categoryFromExistingData('별빛카페', history, settings), '커피');
  assert.equal(categoryFromExistingData('별빛카페 다른점', history, settings), '기타');
  const candidate = { eventId: 'new', source: 'kakao-pay', amount: 1000, merchant: '별빛카페', occurredAt: Date.now() };
  assert.equal(cardBudgetEntry(candidate, settings, history).category, '커피');
  assert.equal(repairExistingKakaoPayEntries(history, settings).changed, 0);
  assert.equal(recategorizeImportedCardEntries(history, settings).changed, 0);
});
test('known history avoids web requests and unknown merchant sends no amounts or event IDs', async () => {
  const f = fixture([row('old', '기록상점', '쇼핑'), row('new', '기록상점'), row('unknown', '새상점')]);
  const result = await enrichImportedCategories({ ...f.options, lookup: async (names, categories) => {
    assert.deepEqual(names, ['새상점']); assert.ok(categories.includes('의료'));
    assert.equal(f.items.find(item => item.id === 'new').category, '쇼핑');
    return [{ merchant: '새상점', category: '식비', source: 'https://example.com/restaurant' }];
  } });
  assert.equal(result.changed, 2); assert.equal(f.items[2].category, '식비');
  f.items.push(row('later', '새상점'));
  await enrichImportedCategories({ ...f.options, lookup: () => assert.fail('must reuse known classification') });
  assert.equal(f.items.at(-1).category, '식비');
});
test('late search preserves edited/deleted transactions and concurrent new records', async () => {
  const f = fixture([row('edit', '새상점'), row('delete', '새상점'), row('same', '새상점')]);
  await enrichImportedCategories({ ...f.options, lookup: async () => {
    f.items = [row('edit', '새상점', '교통'), row('same', '새상점'), row('manual', '다른 기록', '쇼핑')];
    return [{ merchant: '새상점', category: '식비', source: 'https://example.com' }];
  } });
  assert.equal(f.items.length, 3); assert.equal(f.items[0].category, '교통');
  assert.equal(f.items[1].category, '교통'); assert.equal(f.items[2].id, 'manual');
});
test('connection failure retains records and owner change prevents late mutation', async () => {
  const f = fixture([row('same', '새상점')]);
  const failed = await enrichImportedCategories({ ...f.options, lookup: async () => { throw Error('offline'); } });
  assert.equal(failed.deferred, true); assert.equal(f.items[0].category, '기타');
  let current = true;
  const g = fixture([row('same', '새상점')]);
  await enrichImportedCategories({ ...g.options, isCurrent: () => current, lookup: async () => { current = false; return [{ merchant: '새상점', category: '식비', source: 'https://example.com' }]; } });
  assert.equal(g.items[0].category, '기타');
});
test('lookup uses fixed asynchronous actions and rejects sensitive merchant fields', async () => {
  for (const value of ['계좌 123456789', '010-1234-5678', 'x@example.com', '카카오페이']) assert.equal(publicMerchantName(value), '');
  const actions = [];
  const results = await searchMerchantCategories(['새상점'], ['기타', '쇼핑'], { api: async (action, payload) => {
    actions.push(action);
    if (action === 'merchant-create') assert.deepEqual(Object.keys(payload).sort(), ['categories', 'id', 'merchants']);
    return { state: 'completed', results: [] };
  } });
  assert.deepEqual(results, []); assert.deepEqual(actions, ['merchant-create', 'merchant-poll']);
});
