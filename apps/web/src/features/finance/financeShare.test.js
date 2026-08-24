import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FINANCE_SHARE_FORMAT_VERSION,
  FINANCE_SHARE_PRODUCT,
  applyFinanceShareImport,
  createFinanceShare,
  financeShareCsv,
  financeSharePeriodForMonth,
  parseFinanceShare,
  planFinanceShareImport,
  serializeFinanceShare
} from './financeShare.js';

const entries = [
  {
    id: 'budget-card-private-event-id',
    type: 'withdraw',
    amount: 12_500,
    date: '2026-08-02',
    category: '식비',
    memo: '동네, 식당',
    createdAt: '2026-08-02T03:04:05.000Z',
    source: 'card-notification',
    origin: { eventId: 'private-event-id', cardNumber: 'never-share' }
  },
  {
    id: 'budget-income-1',
    type: 'deposit',
    amount: 2_000_000,
    date: '2026-07-25',
    category: '수입',
    memo: '급여',
    createdAt: '2026-07-25T00:00:00.000Z'
  }
];

test('이번 달 가계부 공유는 공개 필드만 담고 메모를 기본 제외한다', () => {
  const period = financeSharePeriodForMonth('2026-08');
  assert.deepEqual(period, { startDate: '2026-08-01', endDate: '2026-08-31' });
  const snapshot = createFinanceShare({
    entries,
    ...period,
    exportedAt: '2026-08-23T12:00:00.000Z'
  });

  assert.equal(snapshot.product, FINANCE_SHARE_PRODUCT);
  assert.equal(snapshot.formatVersion, FINANCE_SHARE_FORMAT_VERSION);
  assert.equal(snapshot.count, 1);
  assert.equal(snapshot.memoIncluded, false);
  assert.equal(snapshot.entries[0].memo, '');
  assert.equal(snapshot.entries[0].source, 'card-notification');
  assert.match(snapshot.entries[0].id, /^share-[a-f0-9]{32}$/);
  const json = serializeFinanceShare(snapshot);
  assert.doesNotMatch(json, /private-event-id|cardNumber|never-share|createdAt|owner|origin/);
});

test('메모 포함 JSON과 CSV는 쉼표·따옴표·줄바꿈을 안전하게 왕복한다', () => {
  const snapshot = createFinanceShare({
    entries: [{ ...entries[0], memo: '"둘이",\n저녁' }],
    includeMemo: true,
    exportedAt: '2026-08-23T12:00:00.000Z'
  });
  const parsed = parseFinanceShare(serializeFinanceShare(snapshot));
  assert.equal(parsed.entries[0].memo, '"둘이",\n저녁');
  const csv = financeShareCsv(parsed);
  assert.ok(csv.startsWith('\ufeff날짜,유형,금액,카테고리,메모'));
  assert.match(csv, /"""둘이"",\n저녁"/);
});

test('가져오기는 공유 ID로 여러 번 받은 파일의 새 거래만 추가한다', () => {
  const snapshot = createFinanceShare({
    entries,
    includeMemo: true,
    exportedAt: '2026-08-23T12:00:00.000Z'
  });
  const first = applyFinanceShareImport([], snapshot);
  assert.equal(first.added.length, 2);
  assert.equal(first.entries.length, 2);
  assert.equal(first.entries[0].source, 'finance-share');
  assert.equal(first.entries[0].origin.kind, 'finance-share');

  const second = planFinanceShareImport(first.entries, snapshot);
  assert.equal(second.added.length, 0);
  assert.equal(second.duplicates, 2);

  const reshared = createFinanceShare({
    entries: first.entries,
    includeMemo: true,
    exportedAt: '2026-08-24T12:00:00.000Z'
  });
  assert.deepEqual(
    reshared.entries.map((entry) => entry.id).sort(),
    snapshot.entries.map((entry) => entry.id).sort()
  );
  const returnedToSender = planFinanceShareImport(entries, reshared);
  assert.equal(returnedToSender.added.length, 0);
  assert.equal(returnedToSender.duplicates, 2);
});

test('가계부 공유 파일은 다른 제품·중복 ID·추가 필드·개수 불일치를 거부한다', () => {
  const snapshot = createFinanceShare({ entries, exportedAt: '2026-08-23T12:00:00.000Z' });
  assert.throws(() => parseFinanceShare({ ...snapshot, product: 'Orbit' }), /공유 파일이 아닙니다/);
  assert.throws(() => parseFinanceShare({ ...snapshot, count: 99 }), /거래 개수/);
  assert.throws(() => parseFinanceShare({ ...snapshot, secret: true }), /필드 구성/);
  assert.throws(() => parseFinanceShare({
    ...snapshot,
    count: snapshot.count + 1,
    entries: [...snapshot.entries, snapshot.entries[0]]
  }), /중복된 거래 ID/);
});

test('가계부 공유 파일은 기간·메모 표시·문자열 경계를 서로 일치시킨다', () => {
  const snapshot = createFinanceShare({
    entries,
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    exportedAt: '2026-08-23T12:00:00.000Z'
  });
  assert.throws(() => parseFinanceShare({
    ...snapshot,
    entries: [{ ...snapshot.entries[0], date: '2026-07-31' }]
  }), /공유 기간 밖/);
  assert.throws(() => parseFinanceShare({
    ...snapshot,
    entries: [{ ...snapshot.entries[0], memo: '숨은 메모' }]
  }), /메모 제외 파일/);
  assert.throws(() => parseFinanceShare({
    ...snapshot,
    entries: [{ ...snapshot.entries[0], category: '잘못된\ud800문자' }]
  }), /category 값이 올바르지/);
});
