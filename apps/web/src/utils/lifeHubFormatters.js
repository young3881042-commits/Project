const MONEY_FORMATTER = new Intl.NumberFormat('ko-KR');
const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'long'
});

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function isTimeKey(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

export function addDays(dateKey, offset) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day + offset);
  return todayKey(date);
}

export function monthKey(dateKey = todayKey()) {
  return dateKey.slice(0, 7);
}

export function compareDateTime(left, right) {
  return `${left?.date || ''} ${left?.time || '99:99'} ${left?.title || ''}`.localeCompare(`${right?.date || ''} ${right?.time || '99:99'} ${right?.title || ''}`);
}

export function compactDateLabel(dateKey) {
  if (!dateKey) return '날짜 없음';
  const today = todayKey();
  if (dateKey === today) return '오늘';
  if (dateKey === addDays(today, 1)) return '내일';
  if (dateKey === addDays(today, -1)) return '어제';
  return dateKey.slice(5).replace('-', '.');
}

export function fullDateLabel(dateKey = todayKey()) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return DATE_FORMATTER.format(new Date(year, month - 1, day));
}

export function formatNumber(value) {
  return MONEY_FORMATTER.format(Math.round(Number(value) || 0));
}

export function money(value) {
  const amount = Number(value) || 0;
  const sign = amount < 0 ? '-' : '';
  return `${sign}${MONEY_FORMATTER.format(Math.abs(Math.round(amount)))}원`;
}

export function dDayLabel(dateKey) {
  if (!dateKey) return '';
  const today = new Date(`${todayKey()}T00:00:00`);
  const target = new Date(`${dateKey}T00:00:00`);
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return 'D-day';
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
}

export function progressPercent(value) {
  return Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
}
