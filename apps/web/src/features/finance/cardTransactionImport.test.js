import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cardBudgetEntry,
  cardImportSummary,
  importCardTransactionBatch,
  readCardImportSources,
  saveCardImportSources
} from './cardTransactionImport.js';

const occurredAt = Date.parse('2026-08-19T01:23:45.000Z');

function candidate(eventId, overrides = {}) {
  return {
    eventId,
    source: 'samsung-wallet',
    amount: 4500,
    merchant: '오비트카페',
    occurredAt,
    ...overrides
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }
  };
}

test('owner별 source opt-in은 허용된 순서와 값만 보관한다', () => {
  const storage = memoryStorage();
  assert.deepEqual(readCardImportSources('Owner-1', storage), []);
  assert.equal(saveCardImportSources('Owner-1', ['bad', 'samsung-wallet'], storage).saved, true);
  assert.deepEqual(readCardImportSources('Owner-1', storage), ['samsung-wallet']);
  assert.deepEqual(readCardImportSources('Owner-2', storage), []);
});

test('native category는 받지 않고 sanitized merchant로 보수적 기본 카테고리를 계산한다', () => {
  assert.equal(cardBudgetEntry(candidate('wallet:v1:cafe')).category, '카페');
  assert.equal(cardBudgetEntry(candidate('wallet:v1:bus', { merchant: '서울버스' })).category, '교통');
  assert.equal(cardBudgetEntry(candidate('wallet:v1:mall', { merchant: '온라인쇼핑' })).category, '쇼핑');
  assert.equal(cardBudgetEntry(candidate('wallet:v1:food', { merchant: '오비트편의점' })).category, '식비');
  assert.equal(cardBudgetEntry(candidate('wallet:v1:other', { merchant: '오비트상사' })).category, '기타');
  assert.equal(cardBudgetEntry({ ...candidate('wallet:v1:raw'), rawText: '알림 원문' }), null);
});

test('batch는 여러 승인 결제를 한 번 저장한 뒤 saved로 ack한다', async () => {
  let rows = [];
  const decisions = [];
  let saves = 0;
  const result = await importCardTransactionBatch([
    candidate('wallet:v1:1'),
    candidate('wallet:v1:2', { amount: 12000, merchant: '오비트식당' })
  ], {
    selectedSources: ['samsung-wallet'],
    readBudget: () => rows,
    normalizeBudget: (entry) => entry,
    saveBudget: (items) => { saves += 1; rows = items; return { saved: true }; },
    acknowledgeDecisions: async (items) => { decisions.push(...items); return { ok: true }; }
  });
  assert.equal(result.status, 'imported');
  assert.equal(result.imported, 2);
  assert.equal(saves, 1);
  assert.equal(rows.length, 2);
  assert.deepEqual(decisions, [
    { eventId: 'wallet:v1:1', status: 'saved' },
    { eventId: 'wallet:v1:2', status: 'saved' }
  ]);
  assert.equal(rows[0].memo, '오비트카페');
  assert.deepEqual(Object.keys(rows[0].origin).sort(), ['eventId', 'kind', 'source']);
});

test('같은 eventId는 save 없이 duplicate ack하고 같은 금액·가맹점의 다른 eventId는 보존한다', async () => {
  let rows = [cardBudgetEntry(candidate('wallet:v1:old'))];
  let saves = 0;
  const decisions = [];
  const result = await importCardTransactionBatch([
    candidate('wallet:v1:old'),
    candidate('wallet:v1:new')
  ], {
    selectedSources: ['samsung-wallet'],
    readBudget: () => rows,
    normalizeBudget: (entry) => entry,
    saveBudget: (items) => { saves += 1; rows = items; return { saved: true }; },
    acknowledgeDecisions: async (items) => { decisions.push(...items); return { ok: true }; }
  });
  assert.equal(result.imported, 1);
  assert.equal(result.duplicates, 1);
  assert.equal(saves, 1);
  assert.equal(rows.length, 2);
  assert.deepEqual(decisions, [
    { eventId: 'wallet:v1:old', status: 'duplicate' },
    { eventId: 'wallet:v1:new', status: 'saved' }
  ]);

  saves = 0;
  decisions.length = 0;
  const duplicateOnly = await importCardTransactionBatch([candidate('wallet:v1:new')], {
    selectedSources: ['samsung-wallet'],
    readBudget: () => rows,
    normalizeBudget: (entry) => entry,
    saveBudget: () => { saves += 1; return { saved: true }; },
    acknowledgeDecisions: async (items) => { decisions.push(...items); return { ok: true }; }
  });
  assert.equal(duplicateOnly.status, 'duplicates');
  assert.equal(saves, 0);
  assert.deepEqual(decisions, [{ eventId: 'wallet:v1:new', status: 'duplicate' }]);
});

test('가계부 저장 실패 시 새 event는 ack하지 않아 다음 가져오기에 남긴다', async () => {
  const decisions = [];
  const result = await importCardTransactionBatch([candidate('wallet:v1:retry')], {
    selectedSources: ['samsung-wallet'],
    readBudget: () => [],
    normalizeBudget: (entry) => entry,
    saveBudget: () => ({ saved: false }),
    acknowledgeDecisions: async (items) => { decisions.push(...items); return { ok: true }; }
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.imported, 0);
  assert.deepEqual(decisions, []);
});

test('저장은 성공하고 ack만 실패하면 다음 실행에서 duplicate로 save 없이 복구 ack한다', async () => {
  let rows = [];
  let saves = 0;
  const first = await importCardTransactionBatch([candidate('wallet:v1:recover')], {
    selectedSources: ['samsung-wallet'],
    readBudget: () => rows,
    normalizeBudget: (entry) => entry,
    saveBudget: (items) => { saves += 1; rows = items; return { saved: true }; },
    acknowledgeDecisions: async () => { throw new Error('native unavailable'); }
  });
  assert.equal(first.status, 'ack_failed');
  assert.equal(first.imported, 1);
  assert.equal(saves, 1);

  const decisions = [];
  const second = await importCardTransactionBatch([candidate('wallet:v1:recover')], {
    selectedSources: ['samsung-wallet'],
    readBudget: () => rows,
    normalizeBudget: (entry) => entry,
    saveBudget: () => { saves += 1; return { saved: true }; },
    acknowledgeDecisions: async (items) => { decisions.push(...items); return { ok: true }; }
  });
  assert.equal(second.status, 'duplicates');
  assert.equal(saves, 1);
  assert.deepEqual(decisions, [{ eventId: 'wallet:v1:recover', status: 'duplicate' }]);
});

test('비활성화 상태는 저장하거나 ack하지 않고 최근 자동 가져오기만 집계한다', async () => {
  let acked = false;
  const result = await importCardTransactionBatch([
    candidate('wallet:v1:disabled')
  ], {
    selectedSources: [],
    readBudget: () => [],
    normalizeBudget: (entry) => entry,
    saveBudget: () => ({ saved: true }),
    acknowledgeDecisions: async () => { acked = true; return { ok: true }; }
  });
  assert.equal(result.status, 'disabled');
  assert.equal(acked, false);

  const imported = cardBudgetEntry(candidate('wallet:v1:summary'));
  assert.deepEqual(cardImportSummary([imported, { id: 'manual', amount: 1000 }], imported.date), {
    total: 1,
    today: 1,
    recent: [{
      id: imported.id,
      merchant: '오비트카페',
      amount: 4500,
      date: imported.date,
      source: 'samsung-wallet'
    }]
  });
});
