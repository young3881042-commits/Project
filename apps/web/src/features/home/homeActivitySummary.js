import { expandSchedulesForCalendar } from '../../components/home/homeMonthCalendarModel.js';
import {
  addDays,
  isDateKey,
  money
} from '../../utils/lifeHubFormatters.js';

export const HOME_ACTIVITY_PERIODS = [
  { value: 'week', label: '주', title: '이번 주' },
  { value: 'month', label: '월', title: '이번 달' },
  { value: 'year', label: '연', title: '올해' },
  { value: 'all', label: '전체', title: '전체' }
];

export function homeActivityRange(period, today, records = {}) {
  if (period === 'week') {
    const date = new Date(`${today}T12:00:00`);
    const dayOffset = (date.getDay() + 6) % 7;
    return { start: addDays(today, -dayOffset), end: today };
  }
  if (period === 'month') return { start: `${today.slice(0, 7)}-01`, end: today };
  if (period === 'year') return { start: `${today.slice(0, 4)}-01-01`, end: today };

  const recordedDates = [
    ...(records.schedules || []).map((item) => item.date),
    ...(records.budgetEntries || []).map((item) => item.date)
  ].filter(isDateKey).sort();
  return { start: recordedDates[0] || today, end: today };
}

export function dateKeysInRange(start, end) {
  const dates = [];
  let current = start;
  while (current <= end && dates.length < 3700) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

function schedulesForPeriod(period, range, schedules) {
  if (period === 'all') return schedules;
  return expandSchedulesForCalendar(schedules, dateKeysInRange(range.start, range.end));
}

function completedScheduleCount(period, schedules) {
  if (period !== 'all') return schedules.filter((item) => item.done).length;
  return schedules.reduce((count, item) => (
    count
    + (item.done ? 1 : 0)
    + Object.values(item.doneOverrides || {}).filter(Boolean).length
  ), 0);
}

function isWithinRange(item, range) {
  return item.date >= range.start && item.date <= range.end;
}

export function buildHomeActivitySummary({
  period = 'week',
  today,
  schedules = [],
  budgetEntries = []
}) {
  const records = { schedules, budgetEntries };
  const periodMeta = HOME_ACTIVITY_PERIODS.find((item) => item.value === period) || HOME_ACTIVITY_PERIODS[0];
  const range = homeActivityRange(period, today, records);
  const periodSchedules = schedulesForPeriod(period, range, schedules);
  const completedSchedules = completedScheduleCount(period, periodSchedules);
  const periodExpense = budgetEntries
    .filter((item) => item.type !== 'deposit' && isWithinRange(item, range))
    .reduce((sum, item) => sum + item.amount, 0);

  return {
    periodMeta,
    range,
    stats: [
      {
        label: '완료 일정',
        value: period === 'all' ? `${completedSchedules}개` : `${completedSchedules}/${periodSchedules.length}`,
        icon: 'calendar',
        route: '/schedule'
      },
      { label: '지출 합계', value: money(periodExpense), icon: 'chart', route: '/finance' }
    ]
  };
}
