import { orbitStorage } from '../../utils/orbitIndexedDbStorage.js';
export const RECURRING_PAYMENTS_STORAGE_KEY = 'lifehub-recurring-payments:v1';
export const RECURRING_PAYMENT_SOURCE = 'recurring-payment';

export const RECURRING_PAYMENT_CATEGORIES = Object.freeze([
  '구독',
  '주거',
  '통신',
  '보험',
  '교통',
  '고정비',
  '기타'
]);

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

function localMonthKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeOwner(owner) {
  const value = typeof owner === 'string' ? owner : owner?.username;
  return String(value || 'guestuser')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_') || 'guestuser';
}

function normalizeMonth(value, fallback = '') {
  const month = String(value || '').trim();
  return MONTH_PATTERN.test(month) ? month : fallback;
}

function normalizedAmount(value) {
  const amount = Math.round(Math.abs(Number(value) || 0));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
}

function timestamp(value, fallback) {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function newRuleId(index = 0) {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(16).slice(2);
  return `recurring-${Date.now()}-${index}-${random}`;
}

export function recurringPaymentsStorageKey(owner) {
  return `${RECURRING_PAYMENTS_STORAGE_KEY}:${normalizeOwner(owner)}`;
}

export function normalizeRecurringPayment(value, index = 0, now = new Date()) {
  const name = String(value?.name || value?.title || '').trim().slice(0, 80);
  const amount = normalizedAmount(value?.amount);
  if (!name || !amount) return null;

  const currentMonth = localMonthKey(now);
  const startMonth = normalizeMonth(value?.startMonth, currentMonth);
  const requestedEndMonth = normalizeMonth(value?.endMonth);
  const endMonth = requestedEndMonth && requestedEndMonth >= startMonth ? requestedEndMonth : '';
  const rawBillingDay = String(value?.billingDay || value?.day || '1').trim().toLowerCase();
  const billingDay = rawBillingDay === 'last'
    ? 'last'
    : String(Math.min(31, Math.max(1, Math.round(Number(rawBillingDay) || 1))));
  const nowIso = now instanceof Date && !Number.isNaN(now.getTime())
    ? now.toISOString()
    : new Date().toISOString();
  const createdAt = timestamp(value?.createdAt, nowIso);
  const processedMonths = [...new Set((Array.isArray(value?.processedMonths) ? value.processedMonths : [])
    .map((month) => normalizeMonth(month))
    .filter(Boolean))].sort();

  return {
    ...value,
    id: String(value?.id || newRuleId(index)),
    name,
    amount,
    billingDay,
    category: String(value?.category || '고정비').trim().slice(0, 30) || '고정비',
    startMonth,
    endMonth,
    autoPost: Boolean(value?.autoPost),
    active: value?.active !== false,
    processedMonths,
    createdAt,
    updatedAt: timestamp(value?.updatedAt, createdAt)
  };
}

export function readRecurringPayments(owner, storage = orbitStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(recurringPaymentsStorageKey(owner)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRecurringPayment).filter(Boolean);
  } catch {
    return [];
  }
}

export function saveRecurringPayments(owner, values, storage = orbitStorage) {
  const items = (Array.isArray(values) ? values : [])
    .map(normalizeRecurringPayment)
    .filter(Boolean);
  try {
    storage?.setItem(recurringPaymentsStorageKey(owner), JSON.stringify(items));
    return { saved: true, items };
  } catch {
    return { saved: false, items };
  }
}

export function recurringPaymentAppliesToMonth(value, month) {
  const rule = normalizeRecurringPayment(value);
  const targetMonth = normalizeMonth(month);
  if (!rule || !targetMonth || !rule.active) return false;
  return rule.startMonth <= targetMonth && (!rule.endMonth || rule.endMonth >= targetMonth);
}

function finalDayOfMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

export function recurringPaymentDueDate(value, month) {
  const rule = normalizeRecurringPayment(value);
  const targetMonth = normalizeMonth(month);
  if (!rule || !targetMonth || !recurringPaymentAppliesToMonth(rule, targetMonth)) return '';
  const monthEnd = finalDayOfMonth(targetMonth);
  const requestedDay = rule.billingDay === 'last' ? monthEnd : Number(rule.billingDay);
  return `${targetMonth}-${String(Math.min(monthEnd, requestedDay)).padStart(2, '0')}`;
}

export function recurringPaymentOccurrenceKey(ruleId, month) {
  return `${String(ruleId || '')}:${normalizeMonth(month)}`;
}

export function recurringPaymentEntryId(ruleId, month) {
  return `budget-recurring-${encodeURIComponent(recurringPaymentOccurrenceKey(ruleId, month))}`;
}

export function recurringPaymentEntryForMonth(value, month, now = new Date()) {
  const rule = normalizeRecurringPayment(value);
  const dueDate = recurringPaymentDueDate(rule, month);
  if (!rule || !dueDate) return null;
  const occurrenceMonth = dueDate.slice(0, 7);
  return {
    id: recurringPaymentEntryId(rule.id, occurrenceMonth),
    type: 'withdraw',
    amount: rule.amount,
    date: dueDate,
    category: rule.category,
    memo: rule.name,
    createdAt: now instanceof Date && !Number.isNaN(now.getTime())
      ? now.toISOString()
      : new Date().toISOString(),
    source: RECURRING_PAYMENT_SOURCE,
    origin: {
      kind: RECURRING_PAYMENT_SOURCE,
      ruleId: rule.id,
      occurrenceMonth
    }
  };
}

export function recurringPaymentEntryMatches(entry, ruleId, month) {
  const targetMonth = normalizeMonth(month);
  if (!entry || !ruleId || !targetMonth) return false;
  if (String(entry.id || '') === recurringPaymentEntryId(ruleId, targetMonth)) return true;
  return entry.source === RECURRING_PAYMENT_SOURCE
    && entry.origin?.kind === RECURRING_PAYMENT_SOURCE
    && String(entry.origin?.ruleId || '') === String(ruleId)
    && String(entry.origin?.occurrenceMonth || '') === targetMonth;
}

export function recurringPaymentOccurrences(values, budgetEntries, {
  month,
  today = ''
} = {}) {
  const normalizedToday = DATE_PATTERN.test(String(today || '')) ? String(today) : '';
  const targetMonth = normalizeMonth(month, normalizedToday.slice(0, 7) || localMonthKey());
  const entries = Array.isArray(budgetEntries) ? budgetEntries : [];
  return (Array.isArray(values) ? values : [])
    .map(normalizeRecurringPayment)
    .filter((rule) => recurringPaymentAppliesToMonth(rule, targetMonth))
    .map((rule) => {
      const dueDate = recurringPaymentDueDate(rule, targetMonth);
      const postedEntry = entries.find((entry) => recurringPaymentEntryMatches(entry, rule.id, targetMonth)) || null;
      const status = postedEntry
        ? 'posted'
        : normalizedToday && dueDate <= normalizedToday
          ? 'due'
          : 'upcoming';
      return {
        key: recurringPaymentOccurrenceKey(rule.id, targetMonth),
        rule,
        dueDate,
        postedEntry,
        status
      };
    })
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate) || left.rule.name.localeCompare(right.rule.name, 'ko'));
}

export function postRecurringPayment(value, budgetEntries, {
  month,
  now = new Date()
} = {}) {
  const rule = normalizeRecurringPayment(value);
  const targetMonth = normalizeMonth(month, localMonthKey(now));
  const entries = Array.isArray(budgetEntries) ? budgetEntries : [];
  if (!rule || !recurringPaymentAppliesToMonth(rule, targetMonth)) {
    return { entries, created: [] };
  }
  if (entries.some((entry) => recurringPaymentEntryMatches(entry, rule.id, targetMonth))) {
    return { entries, created: [] };
  }
  const createdEntry = recurringPaymentEntryForMonth(rule, targetMonth, now);
  return createdEntry
    ? { entries: [createdEntry, ...entries], created: [createdEntry] }
    : { entries, created: [] };
}

export function applyDueRecurringPayments(values, budgetEntries, {
  today,
  now = new Date()
} = {}) {
  const normalizedToday = DATE_PATTERN.test(String(today || '')) ? String(today) : '';
  const entries = Array.isArray(budgetEntries) ? budgetEntries : [];
  if (!normalizedToday) return { entries, created: [] };

  const month = normalizedToday.slice(0, 7);
  const occurrences = recurringPaymentOccurrences(values, entries, { month, today: normalizedToday });
  const created = occurrences
    .filter(({ rule, status }) => (
      rule.autoPost
      && status === 'due'
      && !rule.processedMonths.includes(month)
    ))
    .map(({ rule }) => recurringPaymentEntryForMonth(rule, month, now))
    .filter(Boolean);
  return created.length
    ? { entries: [...created, ...entries], created }
    : { entries, created: [] };
}

export function markRecurringPaymentsProcessed(values, ruleIds, month, now = new Date()) {
  const targetMonth = normalizeMonth(month);
  const ids = new Set((Array.isArray(ruleIds) ? ruleIds : [ruleIds]).map(String).filter(Boolean));
  if (!targetMonth || !ids.size) return (Array.isArray(values) ? values : []).map(normalizeRecurringPayment).filter(Boolean);
  const updatedAt = now instanceof Date && !Number.isNaN(now.getTime())
    ? now.toISOString()
    : new Date().toISOString();
  return (Array.isArray(values) ? values : []).map((value, index) => {
    const rule = normalizeRecurringPayment(value, index, now);
    if (!rule || !ids.has(rule.id)) return rule;
    return {
      ...rule,
      processedMonths: [...new Set([...rule.processedMonths, targetMonth])].sort(),
      updatedAt
    };
  }).filter(Boolean);
}
