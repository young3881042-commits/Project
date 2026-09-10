import { financeCategoryForMerchant } from './financeCategories.js';

export const merchantKey = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '').trim();
export function historicalMerchantCategory(merchant, entries) {
  const key = merchantKey(merchant);
  if (!key) return '';
  const matches = (Array.isArray(entries) ? entries : []).filter(entry => entry?.type === 'withdraw'
    && merchantKey(entry.memo) === key && typeof entry.category === 'string' && entry.category.trim() && entry.category !== '기타');
  matches.sort((a, b) => String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')));
  return matches[0]?.category || '';
}
export function categoryFromExistingData(merchant, entries, settings) {
  return historicalMerchantCategory(merchant, entries) || financeCategoryForMerchant(merchant, settings);
}
export function publicMerchantName(value) {
  if (typeof value !== 'string') return '';
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80 || /[\r\n<>@]|https?:|\d[\d\s*-]{5,}\d|계좌|카드번호|승인번호|잔액|인증번호/.test(name)) return '';
  if (/^(카카오페이|삼성월렛|토스|결제|승인|미확인|기타)$/i.test(name)) return '';
  return name;
}
