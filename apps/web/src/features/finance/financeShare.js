export const FINANCE_SHARE_PRODUCT = 'OrbitFinance';
export const FINANCE_SHARE_FORMAT_VERSION = 1;
export const FINANCE_SHARE_MAX_ENTRIES = 50_000;

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const SHARE_ID_PATTERN = /^share-[a-f0-9]{32}$/;
const ENTRY_TYPES = new Set(['deposit', 'withdraw']);
const ENTRY_SOURCES = new Set(['manual', 'card-notification', 'recurring-payment', 'finance-share']);
const ROOT_KEYS = ['product', 'formatVersion', 'exportedAt', 'period', 'memoIncluded', 'count', 'entries'];
const PERIOD_KEYS = ['startDate', 'endDate'];
const ENTRY_KEYS = ['id', 'type', 'amount', 'date', 'category', 'memo', 'source'];

export class FinanceShareError extends Error {
  constructor(code, message, path = '$', cause = undefined) {
    super(message);
    this.name = 'FinanceShareError';
    this.code = code;
    this.path = path;
    if (cause !== undefined) this.cause = cause;
  }
}

function fail(code, message, path = '$', cause = undefined) {
  throw new FinanceShareError(code, message, path, cause);
}

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireRecord(value, path) {
  if (!isPlainRecord(value)) fail('INVALID_SHAPE', `${path}는 객체여야 합니다.`, path);
}

function requireExactKeys(value, keys, path) {
  requireRecord(value, path);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail('INVALID_SHAPE', `${path}의 필드 구성이 올바르지 않습니다.`, path);
  }
}

function normalizeDate(value, path, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  const date = String(value || '');
  if (!DATE_PATTERN.test(date)) fail('INVALID_DATE', `${path} 날짜가 올바르지 않습니다.`, path);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    fail('INVALID_DATE', `${path} 날짜가 존재하지 않습니다.`, path);
  }
  return date;
}

function normalizeTimestamp(value, path) {
  if (typeof value !== 'string' || !value.trim()) {
    fail('INVALID_TIMESTAMP', `${path}는 날짜 문자열이어야 합니다.`, path);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail('INVALID_TIMESTAMP', `${path} 날짜를 해석할 수 없습니다.`, path);
  return new Date(parsed).toISOString();
}

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function normalizeText(value, path, maximum, { required = false, allowLineBreaks = false } = {}) {
  if (typeof value !== 'string') fail('INVALID_ENTRY', `${path}는 문자열이어야 합니다.`, path);
  const normalized = value.trim();
  const unsafeControl = allowLineBreaks
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/
    : /[\u0000-\u001f\u007f]/;
  if ((required && !normalized)
      || normalized.length > maximum
      || unsafeControl.test(normalized)
      || hasUnpairedSurrogate(normalized)) {
    fail('INVALID_ENTRY', `${path} 값이 올바르지 않습니다.`, path);
  }
  return normalized;
}

function hash32(value, seed) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
    hash ^= hash >>> 13;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stableShareId(value) {
  const input = String(value || '');
  return `share-${[
    0x811c9dc5,
    0x9e3779b9,
    0x85ebca6b,
    0xc2b2ae35
  ].map((seed) => hash32(input, seed)).join('')}`;
}

function shareIdForEntry(entry) {
  const inherited = entry?.source === 'finance-share' && entry?.origin?.kind === 'finance-share'
    ? String(entry.origin.shareId || '')
    : '';
  if (SHARE_ID_PATTERN.test(inherited)) return inherited;
  const identity = String(entry?.id || '') || JSON.stringify([
    entry?.type,
    entry?.amount,
    entry?.date,
    entry?.category,
    entry?.memo,
    entry?.createdAt
  ]);
  return stableShareId(identity);
}

function publicSource(entry) {
  const source = String(entry?.source || 'manual');
  return ENTRY_SOURCES.has(source) ? source : 'manual';
}

function publicEntry(entry, memoIncluded) {
  const amount = Math.round(Math.abs(Number(entry?.amount) || 0));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 999_999_999) return null;
  const type = ENTRY_TYPES.has(entry?.type) ? entry.type : 'withdraw';
  let date;
  try {
    date = normalizeDate(entry?.date, '$.entries[].date');
  } catch {
    return null;
  }
  const category = String(entry?.category || (type === 'deposit' ? '수입' : '기타')).trim().slice(0, 30);
  if (!category) return null;
  return {
    id: shareIdForEntry(entry),
    type,
    amount,
    date,
    category,
    memo: memoIncluded ? String(entry?.memo || '').trim().slice(0, 160) : '',
    source: publicSource(entry)
  };
}

function normalizePeriod(value, path = '$.period') {
  requireExactKeys(value, PERIOD_KEYS, path);
  const startDate = normalizeDate(value.startDate, `${path}.startDate`, { nullable: true });
  const endDate = normalizeDate(value.endDate, `${path}.endDate`, { nullable: true });
  if ((startDate === null) !== (endDate === null)) {
    fail('INVALID_PERIOD', '기간 시작일과 종료일을 함께 입력해야 합니다.', path);
  }
  if (startDate && startDate > endDate) {
    fail('INVALID_PERIOD', '시작일은 종료일보다 늦을 수 없습니다.', path);
  }
  return { startDate, endDate };
}

function normalizeSharedEntry(value, index) {
  const path = `$.entries[${index}]`;
  requireExactKeys(value, ENTRY_KEYS, path);
  const id = String(value.id || '');
  if (!SHARE_ID_PATTERN.test(id)) fail('INVALID_ENTRY', `${path}.id가 올바르지 않습니다.`, `${path}.id`);
  const type = String(value.type || '');
  if (!ENTRY_TYPES.has(type)) fail('INVALID_ENTRY', `${path}.type이 올바르지 않습니다.`, `${path}.type`);
  if (!Number.isSafeInteger(value.amount) || value.amount < 1 || value.amount > 999_999_999) {
    fail('INVALID_ENTRY', `${path}.amount가 올바르지 않습니다.`, `${path}.amount`);
  }
  const source = String(value.source || '');
  if (!ENTRY_SOURCES.has(source)) fail('INVALID_ENTRY', `${path}.source가 올바르지 않습니다.`, `${path}.source`);
  return {
    id,
    type,
    amount: value.amount,
    date: normalizeDate(value.date, `${path}.date`),
    category: normalizeText(value.category, `${path}.category`, 30, { required: true }),
    memo: normalizeText(value.memo, `${path}.memo`, 160, { allowLineBreaks: true }),
    source
  };
}

export function financeSharePeriodForMonth(month) {
  const normalized = String(month || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized)) {
    fail('INVALID_PERIOD', '공유할 월이 올바르지 않습니다.', '$.period');
  }
  const [year, monthNumber] = normalized.split('-').map(Number);
  const finalDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    startDate: `${normalized}-01`,
    endDate: `${normalized}-${String(finalDay).padStart(2, '0')}`
  };
}

export function createFinanceShare({
  entries,
  startDate = null,
  endDate = null,
  includeMemo = false,
  exportedAt = new Date().toISOString()
} = {}) {
  const period = normalizePeriod({ startDate, endDate });
  const source = Array.isArray(entries) ? entries : [];
  const normalizedEntries = source
    .filter((entry) => !period.startDate || (entry?.date >= period.startDate && entry?.date <= period.endDate))
    .map((entry) => publicEntry(entry, Boolean(includeMemo)))
    .filter(Boolean)
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
  if (normalizedEntries.length > FINANCE_SHARE_MAX_ENTRIES) {
    fail('TOO_MANY_ENTRIES', `한 파일에는 최대 ${FINANCE_SHARE_MAX_ENTRIES.toLocaleString('ko-KR')}건까지 담을 수 있습니다.`, '$.entries');
  }
  return {
    product: FINANCE_SHARE_PRODUCT,
    formatVersion: FINANCE_SHARE_FORMAT_VERSION,
    exportedAt: normalizeTimestamp(exportedAt, '$.exportedAt'),
    period,
    memoIncluded: Boolean(includeMemo),
    count: normalizedEntries.length,
    entries: normalizedEntries
  };
}

export function parseFinanceShare(input) {
  let root = input;
  if (typeof input === 'string') {
    try {
      root = JSON.parse(input);
    } catch (cause) {
      fail('INVALID_JSON', '가계부 파일의 JSON을 읽을 수 없습니다.', '$', cause);
    }
  }
  requireExactKeys(root, ROOT_KEYS, '$');
  if (root.product !== FINANCE_SHARE_PRODUCT) {
    fail('INVALID_PRODUCT', 'Orbit 가계부 공유 파일이 아닙니다.', '$.product');
  }
  if (root.formatVersion !== FINANCE_SHARE_FORMAT_VERSION) {
    fail(
      root.formatVersion > FINANCE_SHARE_FORMAT_VERSION ? 'UNSUPPORTED_FUTURE_VERSION' : 'UNSUPPORTED_VERSION',
      '지원하지 않는 가계부 공유 파일 버전입니다.',
      '$.formatVersion'
    );
  }
  if (typeof root.memoIncluded !== 'boolean') {
    fail('INVALID_SHAPE', '$.memoIncluded는 참/거짓이어야 합니다.', '$.memoIncluded');
  }
  const period = normalizePeriod(root.period);
  if (!Array.isArray(root.entries) || root.entries.length > FINANCE_SHARE_MAX_ENTRIES) {
    fail('INVALID_SHAPE', '$.entries 개수가 올바르지 않습니다.', '$.entries');
  }
  const entries = root.entries.map(normalizeSharedEntry);
  if (period.startDate && entries.some((entry) => (
    entry.date < period.startDate || entry.date > period.endDate
  ))) {
    fail('INVALID_PERIOD', '공유 기간 밖의 거래가 포함되어 있습니다.', '$.entries');
  }
  if (!root.memoIncluded && entries.some((entry) => entry.memo !== '')) {
    fail('MEMO_FLAG_MISMATCH', '메모 제외 파일에 메모가 포함되어 있습니다.', '$.memoIncluded');
  }
  const ids = new Set(entries.map((entry) => entry.id));
  if (ids.size !== entries.length) fail('DUPLICATE_ID', '공유 파일 안에 중복된 거래 ID가 있습니다.', '$.entries');
  if (!Number.isSafeInteger(root.count) || root.count !== entries.length) {
    fail('COUNT_MISMATCH', '거래 개수와 실제 데이터가 일치하지 않습니다.', '$.count');
  }
  return {
    product: FINANCE_SHARE_PRODUCT,
    formatVersion: FINANCE_SHARE_FORMAT_VERSION,
    exportedAt: normalizeTimestamp(root.exportedAt, '$.exportedAt'),
    period,
    memoIncluded: root.memoIncluded,
    count: entries.length,
    entries
  };
}

export function serializeFinanceShare(snapshot, space = 0) {
  const normalized = parseFinanceShare(snapshot);
  const indentation = Number.isInteger(space) ? Math.max(0, Math.min(2, space)) : 0;
  return JSON.stringify(normalized, null, indentation);
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function financeShareCsv(snapshot) {
  const normalized = parseFinanceShare(snapshot);
  const rows = [
    ['날짜', '유형', '금액', '카테고리', '메모'],
    ...normalized.entries.map((entry) => [
      entry.date,
      entry.type === 'deposit' ? '수입' : '지출',
      entry.amount,
      entry.category,
      entry.memo
    ])
  ];
  return `\ufeff${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

function currentShareIds(entries) {
  const ids = new Set();
  for (const entry of Array.isArray(entries) ? entries : []) {
    ids.add(shareIdForEntry(entry));
    const originId = entry?.source === 'finance-share' && entry?.origin?.kind === 'finance-share'
      ? String(entry.origin.shareId || '')
      : '';
    if (SHARE_ID_PATTERN.test(originId)) ids.add(originId);
    const localId = String(entry?.id || '');
    if (localId.startsWith('budget-shared-')) {
      const embedded = localId.slice('budget-shared-'.length);
      if (SHARE_ID_PATTERN.test(embedded)) ids.add(embedded);
    }
  }
  return ids;
}

function importedEntry(entry, snapshot) {
  return {
    id: `budget-shared-${entry.id}`,
    type: entry.type,
    amount: entry.amount,
    date: entry.date,
    category: entry.category,
    memo: entry.memo,
    createdAt: snapshot.exportedAt,
    source: 'finance-share',
    origin: {
      kind: 'finance-share',
      shareId: entry.id,
      originalSource: entry.source
    }
  };
}

export function planFinanceShareImport(currentEntries, input) {
  const snapshot = parseFinanceShare(input);
  const existingIds = currentShareIds(currentEntries);
  const added = snapshot.entries
    .filter((entry) => !existingIds.has(entry.id))
    .map((entry) => importedEntry(entry, snapshot));
  const duplicates = snapshot.entries.length - added.length;
  const totals = snapshot.entries.reduce((summary, entry) => {
    const key = entry.type === 'deposit' ? 'income' : 'expense';
    summary[key] += entry.amount;
    return summary;
  }, { income: 0, expense: 0 });
  return {
    snapshot,
    added,
    duplicates,
    totals,
    resultCount: (Array.isArray(currentEntries) ? currentEntries.length : 0) + added.length
  };
}

export function applyFinanceShareImport(currentEntries, input) {
  const current = Array.isArray(currentEntries) ? currentEntries : [];
  const plan = input?.snapshot && Array.isArray(input?.added)
    ? input
    : planFinanceShareImport(current, input);
  return {
    ...plan,
    entries: [...plan.added, ...current]
  };
}
