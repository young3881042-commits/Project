import test from 'node:test';
import assert from 'node:assert/strict';

import {
  financeEntriesForCategoryMonth,
  financeMonthLabel
} from './financeCategoryLedger.js';

test('가계부 월 표시는 연도와 월을 한국어로 명확히 보여준다', () => {
  assert.equal(financeMonthLabel('2026-09'), '2026년 9월');
  assert.equal(financeMonthLabel('invalid'), '월 정보 없음');
});

test('선택한 카테고리의 해당 월 지출만 날짜 순서를 유지해 돌려준다', () => {
  const entries = [
    { id: 'coffee-sep-2', type: 'withdraw', category: '커피', date: '2026-09-17' },
    { id: 'food-sep', type: 'withdraw', category: '식비', date: '2026-09-12' },
    { id: 'coffee-aug', type: 'withdraw', category: '커피', date: '2026-08-30' },
    { id: 'coffee-income', type: 'deposit', category: '커피', date: '2026-09-10' },
    { id: 'coffee-sep-1', type: 'withdraw', category: '커피', date: '2026-09-03' }
  ];

  assert.deepEqual(
    financeEntriesForCategoryMonth(entries, '커피', '2026-09').map((entry) => entry.id),
    ['coffee-sep-2', 'coffee-sep-1']
  );
  assert.deepEqual(financeEntriesForCategoryMonth(entries, '', '2026-09'), []);
});
