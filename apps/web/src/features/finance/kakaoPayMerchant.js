import { financeCategoryForMerchant } from './financeCategories.js';

const KAKAO_PAY_SOURCE = 'kakao-pay';
const CARD_NOTIFICATION_SOURCE = 'card-notification';
const MERCHANT_LABEL_PREFIX = /^(?:(?:상호명|상호|가맹점명|가맹점|결제처|사용처명|사용처|매장명|매장|merchant)(?:은|는|을|를)?\s*(?:[:：=~|/\\-]\s*)?)+/i;
const KAKAO_PAY_PREFIX = /^(?:\[?\s*(?:카카오\s*페이(?:머니)?|kakao\s*pay)\s*\]?)\s*(?:결제(?:\s*(?:완료|승인))?)?\s*(?:[:：=~|/\\-]\s*)*/i;
const LEGACY_LABEL_FRAGMENT_PREFIX = /^(?:(?:처명|금액|명|을|를|은|는)\s+(?=\S))+/;
const PAYMENT_SUFFIX = /\s*(?:[~|/,:：-]\s*)?(?:카카오\s*페이\s*)?(?:결제|승인)(?:\s*(?:완료|되었습니다|처리되었습니다|했어요|됐어요))?\s*$/i;
const AMOUNT_TEXT = /(?:[₩￦]\s*[0-9][0-9,]{0,14}|(?<![0-9,])[0-9][0-9,]{0,14}\s*(?:원|krw))/gi;
const SENSITIVE_TEXT = /(?:잔액|출금가능|계좌(?:번호)?|카드(?:번호)?|주민번호|비밀번호|승인번호|거래번호|(?:available\s*)?balance|account(?:\s*(?:number|no\.?))?|card\s*(?:number|no\.?)|password|passcode|pin\b)/i;
const SENSITIVE_NUMBER = /[0-9０-９]{4,}|(?:[*#xX•·]\s*){2,}[0-9０-９]{2,}/;
const PLACEHOLDER_MERCHANTS = new Set([
  '카카오페이',
  '카카오페이머니',
  'kakaopay',
  '상호',
  '상호명',
  '가맹점',
  '가맹점명',
  '결제처',
  '사용처',
  '사용처명',
  '결제',
  '결제완료',
  '결제승인',
  '미확인',
  '알수없음'
]);

function placeholderKey(value) {
  return String(value || '').toLocaleLowerCase('ko-KR').replace(/[\s\[\](){}._~:：-]+/g, '');
}

export function isKakaoPayImportedEntry(entry) {
  return entry?.source === CARD_NOTIFICATION_SOURCE
    && entry?.origin?.kind === CARD_NOTIFICATION_SOURCE
    && entry?.origin?.source === KAKAO_PAY_SOURCE;
}

export function normalizeKakaoPayMerchant(value) {
  if (typeof value !== 'string') return null;
  let merchant = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!merchant) return null;

  for (let pass = 0; pass < 3; pass += 1) {
    const previous = merchant;
    merchant = merchant
      .replace(KAKAO_PAY_PREFIX, '')
      .replace(MERCHANT_LABEL_PREFIX, '')
      .replace(LEGACY_LABEL_FRAGMENT_PREFIX, '')
      .replace(AMOUNT_TEXT, ' ')
      .replace(PAYMENT_SUFFIX, '')
      .replace(/^[\s~|/\\,:：=\-]+|[\s~|/\\,:：=\-]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (merchant === previous) break;
  }

  if (!merchant || merchant.length < 2 || merchant.length > 80) return null;
  if (PLACEHOLDER_MERCHANTS.has(placeholderKey(merchant))) return null;
  if (SENSITIVE_TEXT.test(merchant) || SENSITIVE_NUMBER.test(merchant)) return null;
  return merchant;
}

export function kakaoPayEntriesNeedingMerchant(entries) {
  return (Array.isArray(entries) ? entries : []).filter((entry) => (
    isKakaoPayImportedEntry(entry) && !normalizeKakaoPayMerchant(entry.memo)
  ));
}

export function repairExistingKakaoPayEntries(entries, categorySettings) {
  let changed = 0;
  let reviewRequired = 0;
  const items = (Array.isArray(entries) ? entries : []).map((entry) => {
    if (!isKakaoPayImportedEntry(entry)) return entry;
    const merchant = normalizeKakaoPayMerchant(entry.memo);
    if (!merchant) {
      reviewRequired += 1;
      return entry;
    }
    const category = entry.memo === merchant && entry.category && entry.category !== '기타'
      ? entry.category : financeCategoryForMerchant(merchant, categorySettings);
    if (entry.memo === merchant && entry.category === category) return entry;
    changed += 1;
    return { ...entry, memo: merchant, category };
  });
  return { items, changed, reviewRequired };
}

export function replaceKakaoPayEntryMerchant(entries, entryId, value, categorySettings) {
  const merchant = normalizeKakaoPayMerchant(value);
  if (!merchant) {
    return {
      changed: false,
      error: '실제 상호명을 2자 이상 입력해주세요. 결제·계좌 정보는 넣지 마세요.',
      items: Array.isArray(entries) ? entries : []
    };
  }

  let changed = false;
  const id = String(entryId || '');
  const category = financeCategoryForMerchant(merchant, categorySettings);
  const items = (Array.isArray(entries) ? entries : []).map((entry) => {
    if (changed || String(entry?.id || '') !== id || !isKakaoPayImportedEntry(entry)) {
      return entry;
    }
    changed = true;
    return { ...entry, memo: merchant, category };
  });
  return {
    changed,
    error: changed ? '' : '수정할 카카오페이 거래를 찾지 못했어요.',
    merchant,
    category,
    items
  };
}
