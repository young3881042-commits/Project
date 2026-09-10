import assert from 'node:assert/strict';
import test from 'node:test';
import { filterFinanceLedger } from './financeLedgerSearch.js';

const entries = Object.freeze([
  Object.freeze({ id: 'coffee', type: 'withdraw', amount: 4500, category: '커피', memo: 'Orbit Coffee', date: '2026-09-05', origin: { eventId: 'private-event' } }),
  Object.freeze({ id: 'food', type: 'withdraw', amount: 12000, category: '식비', memo: '점심 식사', date: '2026-09-04' }),
  Object.freeze({ id: 'salary', type: 'deposit', amount: 3000000, category: '수입', memo: '9월 급여', date: '2026-09-01' })
]);
const ids = (options, items = entries) => filterFinanceLedger(items, options).map((entry) => entry.id);

test('거래 검색은 빈 검색에서 기존 순서와 원본을 보존한다', () => {
  assert.deepEqual(ids({ query: '  ' }), ['coffee', 'food', 'salary']);
  assert.equal(filterFinanceLedger(entries)[0], entries[0]);
});

test('사용처·분류·날짜를 검색하고 여러 단어는 모두 일치해야 한다', () => {
  assert.deepEqual(ids({ query: '커피 2026-09' }), ['coffee']);
  assert.deepEqual(ids({ query: '점심 식비' }), ['food']);
  assert.deepEqual(ids({ query: '커피 급여' }), []);
});

test('영문 대소문자와 전각 입력을 정규화한다', () => {
  assert.deepEqual(ids({ query: 'ＯＲＢＩＴ coffee' }), ['coffee']);
});

test('금액은 쉼표와 원 단위를 허용하며 부분 금액으로 오인하지 않는다', () => {
  assert.deepEqual(ids({ query: '12,000원' }), ['food']);
  assert.deepEqual(ids({ query: '4,500 커피' }), ['coffee']);
  assert.deepEqual(ids({ query: '450원' }), []);
});

test('수입·지출과 검색 조건을 함께 적용한다', () => {
  assert.deepEqual(ids({ type: 'deposit' }), ['salary']);
  assert.deepEqual(ids({ type: 'withdraw', query: '2026-09' }), ['coffee', 'food']);
  assert.deepEqual(ids({ type: 'deposit', query: '커피' }), []);
});

test('선택한 날짜·카테고리 범위 밖 거래와 내부 알림 식별자는 검색하지 않는다', () => {
  assert.deepEqual(ids({ query: '급여' }, [entries[0]]), []);
  assert.deepEqual(ids({ query: 'private-event' }), []);
});

test('빈 목록과 특수문자 검색을 안전하게 처리한다', () => {
  assert.deepEqual(filterFinanceLedger(null, { query: '커피' }), []);
  assert.deepEqual(ids({ query: '[.*' }), []);
});
