import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_FINANCE_CATEGORIES,
  addFinanceCategory,
  customFinanceCategories,
  financeCategoriesForSelection,
  financeCategoryForMerchant,
  managedFinanceCategories,
  readFinanceCategorySettings,
  removeFinanceCategory,
  removeFinanceCategoryKeyword,
  saveFinanceCategorySettings
} from './financeCategories.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }
  };
}

test('기본 자동 분류는 코레일·티머니·커피만 정하고 나머지는 기타로 둔다', () => {
  assert.equal(financeCategoryForMerchant('코레일톡 승차권'), '교통');
  assert.equal(financeCategoryForMerchant('티머니 충전소'), '교통');
  assert.equal(financeCategoryForMerchant('메가커피 강남점'), '커피');
  assert.equal(financeCategoryForMerchant('다이소 홍대점'), '기타');
  assert.equal(financeCategoryForMerchant('온라인 쇼핑몰'), '기타');
  assert.equal(financeCategoryForMerchant('동네 식당'), '기타');
});

test('사용자 분류와 키워드는 기본 분류보다 먼저 적용되고 저장 뒤 다시 읽힌다', () => {
  const storage = memoryStorage();
  const added = addFinanceCategory(null, {
    category: '구독',
    keywords: '넷플릭스, 유튜브 프리미엄'
  });
  assert.equal(added.changed, true);
  assert.equal(added.addedCategory, true);
  assert.equal(added.addedRules, 2);
  assert.equal(financeCategoryForMerchant('넷플릭스 코리아', added.settings), '구독');

  assert.equal(saveFinanceCategorySettings('Owner-1', added.settings, storage).saved, true);
  const restored = readFinanceCategorySettings('Owner-1', storage);
  assert.deepEqual(customFinanceCategories(restored), ['구독']);
  assert.equal(financeCategoryForMerchant('유튜브 프리미엄', restored), '구독');
});

test('같은 분류에는 키워드를 더하고, 기본 분류는 삭제하지 않는다', () => {
  const first = addFinanceCategory(null, { category: '취미', keywords: '서점' });
  const second = addFinanceCategory(first.settings, { category: '취미', keywords: '영화관, 서점' });
  assert.equal(second.addedCategory, false);
  assert.equal(second.addedRules, 1);
  assert.equal(financeCategoryForMerchant('동네 영화관', second.settings), '취미');

  const withoutKeyword = removeFinanceCategoryKeyword(second.settings, '취미', '서점');
  assert.equal(financeCategoryForMerchant('동네 서점', withoutKeyword.settings), '기타');
  assert.equal(removeFinanceCategory(withoutKeyword.settings, '교통').protected, true);
  assert.deepEqual(DEFAULT_FINANCE_CATEGORIES, ['식비', '교통', '커피', '쇼핑', '기타']);
});

test('기본 분류에 더한 사용자 키워드도 관리 목록에 남는다', () => {
  const settings = addFinanceCategory(null, { category: '교통', keywords: 'KTX' }).settings;
  assert.deepEqual(managedFinanceCategories(settings), ['교통']);
  assert.equal(financeCategoryForMerchant('KTX 서울역', settings), '교통');
});

test('선택지에는 현재 사용 중인 예전 분류도 보존한다', () => {
  const settings = addFinanceCategory(null, { category: '의료' }).settings;
  assert.deepEqual(financeCategoriesForSelection(settings, '카페', ['구독']), [
    '식비', '교통', '커피', '쇼핑', '기타', '의료', '구독', '카페'
  ]);
});
