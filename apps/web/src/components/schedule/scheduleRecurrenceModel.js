export const CUSTOM_REPEAT_WEEKDAYS = [
  { value: 0, label: '일' },
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' }
];

const WEEKDAY_ALIASES = new Map([
  ['sun', 0], ['sunday', 0], ['일', 0], ['일요일', 0],
  ['mon', 1], ['monday', 1], ['월', 1], ['월요일', 1],
  ['tue', 2], ['tuesday', 2], ['화', 2], ['화요일', 2],
  ['wed', 3], ['wednesday', 3], ['수', 3], ['수요일', 3],
  ['thu', 4], ['thursday', 4], ['목', 4], ['목요일', 4],
  ['fri', 5], ['friday', 5], ['금', 5], ['금요일', 5],
  ['sat', 6], ['saturday', 6], ['토', 6], ['토요일', 6]
]);

function dateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, timestamp, weekday: date.getUTCDay() };
}

function normalizeWeekday(value) {
  if (Number.isInteger(value) && value >= 0 && value <= 6) return value;
  const raw = String(value ?? '').trim().toLowerCase();
  if (/^[0-6]$/.test(raw)) return Number(raw);
  return WEEKDAY_ALIASES.get(raw) ?? null;
}

export function weekdayForDate(date) {
  return dateParts(date)?.weekday ?? null;
}

export function normalizeRepeatDays(value, fallbackDate = '') {
  const days = [...new Set((Array.isArray(value) ? value : [])
    .map(normalizeWeekday)
    .filter((day) => day !== null))]
    .sort((left, right) => left - right);
  if (days.length) return days;
  const fallbackDay = weekdayForDate(fallbackDate);
  return fallbackDay === null ? [] : [fallbackDay];
}

export function toggleRepeatDay(value, weekday) {
  const target = normalizeWeekday(weekday);
  const days = normalizeRepeatDays(value);
  if (target === null) return days;
  return days.includes(target)
    ? days.filter((day) => day !== target)
    : [...days, target].sort((left, right) => left - right);
}

export function normalizeScheduleRepeat(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['daily', '매일'].includes(raw)) return 'daily';
  if (['weekdays', 'weekday', '주중', '평일'].includes(raw)) return 'weekdays';
  if (['weekends', 'weekend', '주말'].includes(raw)) return 'weekends';
  if (['monthly', '매월'].includes(raw)) return 'monthly';
  if (['custom', '사용자지정', '사용자 지정', '커스텀'].includes(raw)) return 'custom';
  if (['weekly', '매주'].includes(raw)) return 'weekly';
  return 'none';
}

export function scheduleRepeatFor(item) {
  const repeat = normalizeScheduleRepeat(item?.repeat);
  const recurrence = normalizeScheduleRepeat(item?.recurrence);
  if (repeat === 'weekly' && recurrence === 'monthly') return 'monthly';
  return Object.prototype.hasOwnProperty.call(item || {}, 'repeat') ? repeat : recurrence;
}

export function recurrenceForRepeat(repeat) {
  return normalizeScheduleRepeat(repeat);
}

export function repeatDaysForSchedule(item) {
  if (scheduleRepeatFor(item) !== 'custom') return [];
  const storedDays = item?.repeatDays ?? item?.customDays ?? item?.daysOfWeek;
  return normalizeRepeatDays(storedDays, item?.date);
}

export function scheduleRecurrenceMatches(item, targetDate) {
  const repeat = scheduleRepeatFor(item);
  if (repeat === 'none') return item?.date === targetDate;
  if (targetDate < item?.date) return false;
  if (item?.recurrenceEnd && targetDate > item.recurrenceEnd) return false;
  const start = dateParts(item?.date);
  const target = dateParts(targetDate);
  if (!start || !target) return false;
  const diffDays = Math.round((target.timestamp - start.timestamp) / 86400000);
  if (repeat === 'daily') return diffDays >= 0;
  if (repeat === 'weekdays') return diffDays >= 0 && target.weekday >= 1 && target.weekday <= 5;
  if (repeat === 'weekends') return diffDays >= 0 && (target.weekday === 0 || target.weekday === 6);
  if (repeat === 'custom') return diffDays >= 0 && repeatDaysForSchedule(item).includes(target.weekday);
  if (repeat === 'monthly') return start.day === target.day;
  if (repeat === 'weekly') return diffDays >= 0 && diffDays % 7 === 0;
  return false;
}
