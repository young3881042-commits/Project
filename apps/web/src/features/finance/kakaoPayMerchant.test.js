import assert from 'node:assert/strict';
import test from 'node:test';
import {
  kakaoPayEntriesNeedingMerchant,
  normalizeKakaoPayMerchant,
  repairExistingKakaoPayEntries,
  replaceKakaoPayEntryMerchant
} from './kakaoPayMerchant.js';

function imported(memo, overrides = {}) {
  return {
    id: overrides.id || `kakao-${memo}`,
    type: 'withdraw',
    amount: 5800,
    date: '2026-08-30',
    category: '기타',
    memo,
    source: 'card-notification',
    origin: {
      kind: 'card-notification',
      eventId: overrides.eventId || `event-${memo}`,
      source: 'kakao-pay'
    },
    ...overrides
  };
}

test('카카오페이 상호명 라벨·앱 이름·결제 문구와 구분 기호를 정리한다', () => {
  assert.equal(normalizeKakaoPayMerchant('상호명을~ 메가커피 강남점 결제 완료'), '메가커피 강남점');
  assert.equal(normalizeKakaoPayMerchant('[카카오페이] 가맹점명: 올리브영 / 결제승인'), '올리브영');
  assert.equal(normalizeKakaoPayMerchant('카카오페이 결제 스타벅스 6,500원'), '스타벅스');
  assert.equal(normalizeKakaoPayMerchant('처명 스타벅스'), '스타벅스');
  assert.equal(normalizeKakaoPayMerchant('을 다이소 성수점'), '다이소 성수점');
  assert.equal(normalizeKakaoPayMerchant('GS25'), 'GS25');
});

test('앱 이름뿐인 이전 값과 민감 숫자는 상호명으로 추측하지 않는다', () => {
  assert.equal(normalizeKakaoPayMerchant('카카오페이'), null);
  assert.equal(normalizeKakaoPayMerchant('상호명'), null);
  assert.equal(normalizeKakaoPayMerchant('상호명: 카드 12345678'), null);
});

test('기존 카카오페이 자동 기록만 상호명과 분류를 보정하고 원본 없는 값은 확인 대상으로 남긴다', () => {
  const manual = { id: 'manual', source: 'manual', memo: '상호명을~ 수동 기록', category: '식비' };
  const samsung = {
    ...imported('상호명: 삼성 상점'),
    id: 'samsung',
    origin: { kind: 'card-notification', eventId: 'samsung-event', source: 'samsung-wallet' }
  };
  const result = repairExistingKakaoPayEntries([
    imported('상호명을~ 메가커피 강남점 결제 완료', { id: 'repair' }),
    imported('카카오페이', { id: 'review' }),
    manual,
    samsung
  ]);

  assert.equal(result.changed, 1);
  assert.equal(result.reviewRequired, 1);
  assert.equal(result.items[0].memo, '메가커피 강남점');
  assert.equal(result.items[0].category, '커피');
  assert.equal(result.items[1].memo, '카카오페이');
  assert.equal(result.items[2], manual);
  assert.equal(result.items[3], samsung);
  assert.deepEqual(kakaoPayEntriesNeedingMerchant(result.items).map((entry) => entry.id), ['review']);
});

test('앱 이름만 남은 기존 거래는 사용자가 입력한 상호명과 새 분류로 안전하게 교체한다', () => {
  const settings = {
    categories: ['식비', '교통', '커피', '쇼핑', '기타', '생활'],
    rules: [{ category: '생활', keyword: '다이소' }]
  };
  const result = replaceKakaoPayEntryMerchant(
    [imported('카카오페이', { id: 'legacy' })],
    'legacy',
    '상호명: 다이소 성수점',
    settings
  );
  assert.equal(result.changed, true);
  assert.equal(result.items[0].memo, '다이소 성수점');
  assert.equal(result.items[0].category, '생활');
});
