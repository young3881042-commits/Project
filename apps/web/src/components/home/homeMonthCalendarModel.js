import {
  scheduleRecurrenceMatches,
  scheduleRepeatFor
} from '../schedule/scheduleRecurrenceModel.js';
import { scheduleStatusLabel } from '../schedule/scheduleStatusModel.js';

const NUMBER_FORMATTER = new Intl.NumberFormat('ko-KR');

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function memoDateKey(note) {
  const explicit = String(note?.recordDate || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const timestamp = note?.createdAt || note?.updatedAt;
  const parsed = timestamp ? new Date(timestamp) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return '';
  return dateKey(parsed);
}

function parseMonth(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return { year, monthIndex };
}

function recurrenceMatches(item, targetDate) {
  return scheduleRecurrenceMatches(item, targetDate);
}

function scheduleOccurrence(item, targetDate) {
  const recurring = scheduleRepeatFor(item) !== 'none';
  if (!recurring) {
    return {
      ...item,
      scheduleId: item.scheduleId || item.id,
      sourceId: item.sourceId || item.id,
      recurring: false,
      status: item.done ? 'done' : 'scheduled'
    };
  }
  const done = Boolean(item.doneOverrides?.[targetDate]);
  return {
    ...item,
    id: `${item.id}:${targetDate}`,
    scheduleId: item.id,
    sourceId: item.id,
    date: targetDate,
    recurring: true,
    done,
    status: done ? 'done' : 'scheduled'
  };
}

function emptySummary(date) {
  return {
    date,
    income: 0,
    expense: 0,
    incomeCount: 0,
    expenseCount: 0,
    schedulePlanned: 0,
    scheduleIncomplete: 0,
    scheduleDone: 0,
    memoCount: 0,
    memoItems: [],
    activities: [],
    budgetItems: []
  };
}

export function shiftCalendarMonth(month, offset) {
  const parsed = parseMonth(month);
  if (!parsed) return month;
  const shifted = new Date(parsed.year, parsed.monthIndex + Number(offset || 0), 1);
  return dateKey(shifted).slice(0, 7);
}

export function clampDateToMonth(month, preferredDate) {
  const parsed = parseMonth(month);
  if (!parsed) return preferredDate;
  const preferredDay = Math.max(1, Number(String(preferredDate || '').slice(8, 10)) || 1);
  const lastDay = new Date(parsed.year, parsed.monthIndex + 1, 0).getDate();
  return `${month}-${String(Math.min(preferredDay, lastDay)).padStart(2, '0')}`;
}

export function buildMonthCalendar(month) {
  const parsed = parseMonth(month);
  if (!parsed) return buildMonthCalendar(dateKey(new Date()).slice(0, 7));
  const first = new Date(parsed.year, parsed.monthIndex, 1);
  const lastDay = new Date(parsed.year, parsed.monthIndex + 1, 0).getDate();
  const leadingDays = first.getDay();
  const cellCount = Math.max(35, Math.ceil((leadingDays + lastDay) / 7) * 7);
  const start = new Date(parsed.year, parsed.monthIndex, 1 - leadingDays);
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const current = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const currentDate = dateKey(current);
    return {
      date: currentDate,
      day: current.getDate(),
      weekday: current.getDay(),
      inMonth: currentDate.startsWith(month)
    };
  });
  return {
    month,
    label: `${parsed.year}년 ${parsed.monthIndex + 1}월`,
    cells,
    dateKeys: cells.map((cell) => cell.date),
    startDate: cells[0].date,
    endDate: cells[cells.length - 1].date
  };
}

export function expandSchedulesForCalendar(items, targetDates) {
  const dates = [...new Set(targetDates || [])].sort();
  return (items || []).flatMap((item) => (
    dates
      .filter((targetDate) => recurrenceMatches(item, targetDate))
      .map((targetDate) => scheduleOccurrence(item, targetDate))
  ));
}

export function summarizeHomeCalendar({ dateKeys, schedules, budgetEntries, notes, now = new Date() }) {
  const summaries = Object.fromEntries((dateKeys || []).map((date) => [date, emptySummary(date)]));
  const seenSchedules = new Set();
  (schedules || []).forEach((schedule) => {
    const key = `${schedule?.id || ''}:${schedule?.date || ''}`;
    if (!schedule?.id || seenSchedules.has(key) || !summaries[schedule.date]) return;
    seenSchedules.add(key);
    const summary = summaries[schedule.date];
    const status = scheduleStatusLabel(schedule, now);
    if (status === '완료') summary.scheduleDone += 1;
    else if (status === '미완료') summary.scheduleIncomplete += 1;
    else summary.schedulePlanned += 1;
    summary.activities.push({
      id: schedule.id,
      scheduleId: schedule.scheduleId || schedule.sourceId || schedule.id,
      kind: 'schedule',
      title: schedule.title || '일정',
      time: schedule.time || '',
      status,
      category: schedule.category || '',
      type: schedule.type || ''
    });
  });

  const seenBudget = new Set();
  (budgetEntries || []).forEach((entry) => {
    const id = String(entry?.id || '');
    if (!id || seenBudget.has(id) || !summaries[entry.date]) return;
    seenBudget.add(id);
    const summary = summaries[entry.date];
    if (entry.type === 'deposit') {
      summary.income += Number(entry.amount) || 0;
      summary.incomeCount += 1;
    } else {
      summary.expense += Number(entry.amount) || 0;
      summary.expenseCount += 1;
    }
    summary.budgetItems.push(entry);
  });

  const seenNotes = new Set();
  (notes || []).forEach((note) => {
    const id = String(note?.id || '');
    const date = memoDateKey(note);
    if (!id || seenNotes.has(id) || !summaries[date]) return;
    seenNotes.add(id);
    summaries[date].memoCount += 1;
    summaries[date].memoItems.push({
      id,
      title: String(note?.title || '메모'),
      updatedAt: String(note?.updatedAt || note?.createdAt || '')
    });
  });

  Object.values(summaries).forEach((summary) => {
    summary.memoItems.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    summary.activities.sort((left, right) => `${left.time || '99:99'}${left.title}`.localeCompare(`${right.time || '99:99'}${right.title}`));
  });
  return summaries;
}

export function summarizeMonthFinances(month, budgetEntries) {
  if (!parseMonth(month)) return { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
  const result = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
  const seen = new Set();
  (budgetEntries || []).forEach((entry) => {
    const id = String(entry?.id || '');
    if (!id || seen.has(id) || !String(entry?.date || '').startsWith(`${month}-`)) return;
    seen.add(id);
    if (entry.type === 'deposit') {
      result.income += Number(entry.amount) || 0;
      result.incomeCount += 1;
    } else {
      result.expense += Number(entry.amount) || 0;
      result.expenseCount += 1;
    }
  });
  return result;
}

export function formatCalendarAmount(value) {
  const amount = Math.abs(Math.round(Number(value) || 0));
  const compact = (number, unit) => `${Number((number).toFixed(1))}${unit}`;
  if (amount >= 100000000) return compact(amount / 100000000, '억');
  if (amount >= 10000) return compact(amount / 10000, '만');
  return NUMBER_FORMATTER.format(amount);
}
