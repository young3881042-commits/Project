const AUTH_KEY = 'codex-workspace-auth';
const READING_LIBRARY_KEY = 'ai-assistant-reading-library';

export const READING_STATUS_OPTIONS = [
  { id: 'interested', label: '관심있는 책', shortLabel: '관심', emptyText: '관심있는 책을 추가해보세요.' },
  { id: 'reading', label: '읽고있는 책', shortLabel: '읽는 중', emptyText: '지금 읽는 책을 기록해보세요.' },
  { id: 'finished', label: '읽은 책', shortLabel: '완독', emptyText: '다 읽은 책이 여기에 쌓입니다.' }
];

const STATUS_ALIASES = {
  interested: 'interested',
  wishlist: 'interested',
  want: 'interested',
  관심: 'interested',
  관심있는책: 'interested',
  '관심있는 책': 'interested',
  reading: 'reading',
  progress: 'reading',
  active: 'reading',
  읽는중: 'reading',
  읽고있는책: 'reading',
  '읽고있는 책': 'reading',
  finished: 'finished',
  done: 'finished',
  complete: 'finished',
  read: 'finished',
  완독: 'finished',
  읽은책: 'finished',
  '읽은 책': 'finished'
};

export function readReadingSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storageUsername(input = readReadingSession()) {
  const username = typeof input === 'string' ? input : input?.username;
  return String(username || 'guestuser').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'guestuser';
}

export function readingStorageKey(input = readReadingSession()) {
  return `${READING_LIBRARY_KEY}:${storageUsername(input)}`;
}

export function normalizeReadingStatus(value) {
  const raw = String(value || '').trim();
  const compact = raw.replace(/\s+/g, '').toLowerCase();
  return STATUS_ALIASES[raw] || STATUS_ALIASES[raw.toLowerCase()] || STATUS_ALIASES[compact] || 'interested';
}

function normalizeDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(`${value || ''}`) ? value : '';
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeReadingBook(book, index = 0) {
  const title = String(book?.title || book?.name || '').trim();
  if (!title) return null;
  const status = normalizeReadingStatus(book?.status);
  const createdAt = typeof book?.createdAt === 'string' && book.createdAt ? book.createdAt : new Date().toISOString();
  return {
    id: String(book?.id || `book-${Date.now()}-${index}`),
    title,
    author: String(book?.author || '').trim(),
    status,
    memo: String(book?.memo || book?.note || '').trim(),
    startedAt: status === 'interested' ? '' : normalizeDate(book?.startedAt) || (status === 'reading' ? todayKey() : ''),
    finishedAt: status === 'finished' ? normalizeDate(book?.finishedAt) || todayKey() : normalizeDate(book?.finishedAt),
    createdAt,
    updatedAt: typeof book?.updatedAt === 'string' && book.updatedAt ? book.updatedAt : createdAt
  };
}

export function compareReadingBooks(left, right) {
  return `${right?.updatedAt || right?.createdAt || ''}`.localeCompare(`${left?.updatedAt || left?.createdAt || ''}`);
}

export function readReadingBooks(session = readReadingSession()) {
  const scopedKey = readingStorageKey(session);
  try {
    const scopedRaw = localStorage.getItem(scopedKey);
    const legacyRaw = localStorage.getItem(READING_LIBRARY_KEY);
    const raw = scopedRaw ?? legacyRaw ?? '[]';
    const parsed = JSON.parse(raw);
    const books = Array.isArray(parsed)
      ? parsed.map(normalizeReadingBook).filter(Boolean).sort(compareReadingBooks).slice(0, 200)
      : [];
    if (scopedRaw === null && legacyRaw !== null) {
      localStorage.setItem(scopedKey, JSON.stringify(books));
      localStorage.removeItem(READING_LIBRARY_KEY);
    }
    return books;
  } catch {
    return [];
  }
}

export function saveReadingBooks(storageKey, books) {
  const normalized = books
    .map(normalizeReadingBook)
    .filter(Boolean)
    .sort(compareReadingBooks)
    .slice(0, 200);
  localStorage.setItem(storageKey, JSON.stringify(normalized));
  return normalized;
}

export function moveReadingBookStatus(book, nextStatus) {
  const status = normalizeReadingStatus(nextStatus);
  const now = new Date().toISOString();
  const date = todayKey();
  return normalizeReadingBook({
    ...book,
    status,
    startedAt: status === 'interested' ? '' : book?.startedAt || (status === 'reading' ? date : ''),
    finishedAt: status === 'finished' ? book?.finishedAt || date : '',
    updatedAt: now
  });
}

export function summarizeReadingBooks(books) {
  return READING_STATUS_OPTIONS.reduce((summary, option) => ({
    ...summary,
    [option.id]: books.filter((book) => book.status === option.id).length
  }), {});
}
