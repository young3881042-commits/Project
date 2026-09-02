const MONTH_KEY_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function financeMonthLabel(value) {
  const match = String(value || '').match(MONTH_KEY_PATTERN);
  if (!match) return '월 정보 없음';
  return `${match[1]}년 ${Number(match[2])}월`;
}

export function financeEntriesForCategoryMonth(entries, category, month) {
  const normalizedCategory = String(category || '').trim();
  if (!normalizedCategory || !MONTH_KEY_PATTERN.test(String(month || ''))) return [];
  return (Array.isArray(entries) ? entries : []).filter((entry) => (
    entry?.type !== 'deposit'
    && entry?.category === normalizedCategory
    && String(entry?.date || '').startsWith(`${month}-`)
  ));
}
