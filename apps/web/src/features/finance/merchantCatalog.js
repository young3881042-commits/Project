import catalog from './merchantCatalog.json' with { type: 'json' };
export const MERCHANT_CATALOG_DATE = catalog.checkedAt;
export const MERCHANT_CATALOG = catalog.brands;
const compact = value => value.normalize('NFKC').toLowerCase().replace(/[\s'’.-]/g, '');
function merchantName(value) {
  if (typeof value !== 'string' || value.length > 120 || /[\r\n<>@]|https?:|\d[\d\s*-]{5,}\d|계좌|카드번호|승인번호|잔액|인증번호/.test(value)) return '';
  return compact(value.trim().replace(/^(?:카카오페이|네이버페이|토스페이|페이코|kcp|kg이니시스)[\s:*\/_-]+/i, '').replace(/^(?:\(주\)|주식회사)\s*/, ''));
}
export function matchMerchantCatalog(value) {
  const name = merchantName(value);
  if (!name) return null;
  const matches = catalog.brands.filter(brand => brand.aliases.some(alias => {
    const key = compact(alias);
    if (name === key) return true;
    if (!name.startsWith(key)) return false;
    const suffix = name.slice(key.length).replace(/^[:_(/-]+/, '').replace(/\)$/, '');
    // Branch suffixes only: CU must not match CUCUMBER, SRT must not match SRTTECH.
    return /^[가-힣][가-힣a-z0-9()]{0,30}점$/.test(suffix);
  }));
  return matches.length === 1 ? { ...matches[0], checkedAt: catalog.checkedAt } : null;
}
