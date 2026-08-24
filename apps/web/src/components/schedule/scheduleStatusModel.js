const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_KEY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function localDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validDateKey(value) {
  const match = DATE_KEY_PATTERN.exec(String(value || ''));
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return localDateKey(date) === value ? value : '';
}

function timeMinutes(value) {
  const match = TIME_KEY_PATTERN.exec(String(value || ''));
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function isIncompleteSchedule(item, now = new Date()) {
  if (item?.done || item?.status === 'done') return false;
  const date = validDateKey(item?.date);
  const today = localDateKey(now);
  if (!date || !today) return false;
  if (date < today) return true;
  if (date > today) return false;

  const dueMinutes = timeMinutes(item?.time);
  if (dueMinutes === null) return false;
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime())) return false;
  const currentMinutes = current.getHours() * 60 + current.getMinutes();
  return dueMinutes < currentMinutes;
}

export function scheduleDisplayStatus(item, now = new Date()) {
  if (item?.done || item?.status === 'done') return 'done';
  return isIncompleteSchedule(item, now) ? 'incomplete' : 'upcoming';
}

export function scheduleStatusLabel(item, now = new Date()) {
  const status = scheduleDisplayStatus(item, now);
  if (status === 'done') return '완료';
  if (status === 'incomplete') return '미완료';
  return '예정';
}
