import { safeParse, safeRemoveItem, safeSetItem } from '../../../utils/lifeHubStorage.js';

const NOTE_BLOCKS_KEY = 'codex-ai-note-blocks';
const NOTE_BOARDS_KEY = 'codex-ai-note-boards';
const LIFEHUB_EVENT = 'lifehub:data-updated';
const DRAFT_KEY = 'ai-assistant-daily-memo-draft';

export const DAILY_MEMO_ALL_TAG = 'all';
export const DAILY_MEMO_QUICK_TAGS = ['할 일', '기억', '아이디어', '감사'];

function storageUsername(session) {
  const username = typeof session === 'string' ? session : session?.username;
  return String(username || 'guestuser').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'guestuser';
}

function scopedKey(baseKey, session) {
  return `${baseKey}:${storageUsername(session)}`;
}

function legacyStorageAllowed(session) {
  return !session || session.isGuest || session.username === 'guestuser';
}

function emitNotesChanged(storageKey) {
  window.dispatchEvent(new CustomEvent('codex:notes-updated', { detail: { storageKey } }));
  window.dispatchEvent(new CustomEvent(LIFEHUB_EVENT, { detail: { key: storageKey } }));
}

function plainContent(note) {
  return String(note?.content || note?.body || '').trim();
}

export function dailyMemoTitle(note) {
  if (String(note?.title || '').trim()) return String(note.title).trim();
  const firstLine = plainContent(note).split('\n').find((line) => line.trim()) || '';
  return firstLine.replace(/^#+\s*/, '').trim() || '새 메모';
}

export function dailyMemoBody(note) {
  const content = plainContent(note);
  if (!content) return '';
  const lines = content.split('\n');
  const firstContentIndex = lines.findIndex((line) => line.trim());
  if (firstContentIndex < 0) return '';

  const hasHeadingTitle = /^#\s+\S/.test(lines[firstContentIndex].trim());
  return (hasHeadingTitle ? lines.slice(firstContentIndex + 1) : lines).join('\n').trim();
}

export function dailyMemoTags(note) {
  const storedTags = Array.isArray(note?.tags) ? note.tags : [];
  const fallbackLabels = Array.isArray(note?.labels) ? note.labels : [];
  const planLabels = new Set(['personal', 'travel', '개인', '여행']);
  const explicit = (storedTags.length ? storedTags : fallbackLabels)
    .map((tag) => String(tag || '').replace(/^#/, '').trim())
    .filter((tag) => tag && (storedTags.length || !planLabels.has(tag.toLocaleLowerCase('ko-KR'))));
  const derived = [...plainContent(note).matchAll(/#([가-힣A-Za-z0-9_-]+)/g)].map((match) => match[1]);
  return [...new Set([...explicit, ...derived])].slice(0, 6);
}

export function isRichDailyMemo(note) {
  if (note?.contentFormat === 'blocknote-v1' || note?.contentFormat === 'legacy-blocks-v1') return true;
  if (Array.isArray(note?.blockNoteDocument) && note.blockNoteDocument.length) return true;
  return Array.isArray(note?.blocks) && note.blocks.length > 0;
}

export function normalizeDailyMemo(note, index = 0) {
  const title = dailyMemoTitle(note);
  const createdAt = note?.createdAt || note?.updatedAt || new Date().toISOString();
  const body = dailyMemoBody(note);
  return {
    ...note,
    id: String(note?.id || `note-${Date.now()}-${index}`),
    type: note?.type || 'text',
    title,
    content: String(note?.content || `# ${title}${body ? `\n\n${body}` : '\n'}`),
    boardId: note?.boardId || note?.folderId || note?.sector || 'personal',
    folderId: note?.folderId || note?.boardId || note?.sector || 'personal',
    status: note?.status || 'todo',
    pinned: Boolean(note?.pinned),
    tags: dailyMemoTags(note),
    schemaVersion: Math.max(1, Number(note?.schemaVersion) || 1),
    contentFormat: isRichDailyMemo(note)
      ? (Array.isArray(note?.blockNoteDocument) && note.blockNoteDocument.length ? 'blocknote-v1' : 'legacy-blocks-v1')
      : 'plain-v1',
    revision: Math.max(1, Number(note?.revision) || 1),
    createdAt,
    updatedAt: note?.updatedAt || createdAt
  };
}

export function readDailyMemos(session) {
  const key = scopedKey(NOTE_BLOCKS_KEY, session);
  const scoped = safeParse(localStorage.getItem(key), null);
  const legacyAllowed = legacyStorageAllowed(session);
  const legacy = legacyAllowed ? safeParse(localStorage.getItem(NOTE_BLOCKS_KEY), null) : null;
  const source = Array.isArray(scoped) ? scoped : Array.isArray(legacy) ? legacy : [];
  const notes = source.map(normalizeDailyMemo).filter(Boolean);

  if (!Array.isArray(scoped) && notes.length) safeSetItem(key, JSON.stringify(notes));

  return notes
    .sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
      return String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''));
    });
}

export function saveDailyMemos(session, notes) {
  const key = scopedKey(NOTE_BLOCKS_KEY, session);
  const normalized = notes.map(normalizeDailyMemo).filter(Boolean);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  if (saved && legacyStorageAllowed(session)) safeRemoveItem(NOTE_BLOCKS_KEY);
  emitNotesChanged(key);
  return { items: normalized, saved };
}

export function removeDailyMemoById(notes, memoId) {
  const items = Array.isArray(notes) ? notes : [];
  const targetId = String(memoId ?? '');
  if (!targetId.trim()) return { items, removed: false, removedItem: null };

  const targetIndex = items.findIndex((note) => String(note?.id ?? '') === targetId);
  if (targetIndex < 0) return { items, removed: false, removedItem: null };

  return {
    items: [...items.slice(0, targetIndex), ...items.slice(targetIndex + 1)],
    removed: true,
    removedItem: items[targetIndex]
  };
}

export function ensureDailyMemoBoards(session) {
  const key = scopedKey(NOTE_BOARDS_KEY, session);
  const current = safeParse(localStorage.getItem(key), null);
  if (Array.isArray(current) && current.length) return;
  safeSetItem(key, JSON.stringify([
    { id: 'personal', title: '개인', name: '개인' },
    { id: 'travel', title: '여행', name: '여행' }
  ]));
}

export function createDailyMemoDraft(note = null) {
  return {
    title: note ? dailyMemoTitle(note) : '',
    body: note ? dailyMemoBody(note) : '',
    tags: note ? dailyMemoTags(note) : []
  };
}

export function buildDailyMemo(draft, previous = null) {
  if (previous && isRichDailyMemo(previous)) {
    throw new Error('Rich notes must be edited in the full note editor.');
  }
  const body = String(draft?.body || '').trim();
  const explicitTitle = String(draft?.title || '').trim();
  const bodyLines = body.split('\n');
  const firstContentIndex = bodyLines.findIndex((line) => line.trim());
  const firstLine = firstContentIndex >= 0 ? bodyLines[firstContentIndex].trim() : '';
  const title = explicitTitle || firstLine.slice(0, 80) || '빠른 메모';
  const derivedOverflow = explicitTitle ? '' : firstLine.slice(80).trim();
  const serializedBody = explicitTitle
    ? body
    : [...(derivedOverflow ? [derivedOverflow] : []), ...bodyLines.slice(firstContentIndex + 1)].join('\n').trim();
  const tags = [...new Set((Array.isArray(draft?.tags) ? draft.tags : [])
    .map((tag) => String(tag || '').replace(/^#/, '').trim())
    .filter(Boolean))].slice(0, 6);
  const fields = { ...(previous || {}) };

  return normalizeDailyMemo({
    ...fields,
    id: previous?.id || `note-${Date.now()}`,
    title,
    content: `# ${title}${serializedBody ? `\n\n${serializedBody}` : '\n'}`,
    boardId: previous?.boardId || 'personal',
    folderId: previous?.folderId || 'personal',
    tags,
    schemaVersion: 1,
    contentFormat: 'plain-v1',
    titleDerived: !explicitTitle,
    revision: previous ? Math.max(1, Number(previous.revision) || 1) + 1 : 1,
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export function dailyMemoSearch(notes, { query = '', tag = DAILY_MEMO_ALL_TAG, view = 'all' } = {}) {
  const keyword = query.trim().toLocaleLowerCase('ko-KR');
  return notes.filter((note) => {
    if (view === 'pinned' && !note.pinned) return false;
    if (tag !== DAILY_MEMO_ALL_TAG && !dailyMemoTags(note).includes(tag)) return false;
    if (!keyword) return true;
    const haystack = `${dailyMemoTitle(note)} ${dailyMemoBody(note)} ${dailyMemoTags(note).join(' ')}`.toLocaleLowerCase('ko-KR');
    return haystack.includes(keyword);
  });
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addLocalDays(date, offset) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  copy.setDate(copy.getDate() + offset);
  return copy;
}

export function dailyMemoRhythm(notes, now = new Date()) {
  const recordedDays = new Set(notes.map((note) => localDateKey(note.createdAt || note.updatedAt)).filter(Boolean));
  const today = localDateKey(now);
  const weekStart = addLocalDays(now, -((now.getDay() + 6) % 7));
  const weekDays = [...recordedDays].filter((dateKey) => dateKey >= localDateKey(weekStart) && dateKey <= today).length;
  const streakStart = recordedDays.has(today) ? 0 : recordedDays.has(localDateKey(addLocalDays(now, -1))) ? 1 : 0;
  let streak = 0;
  while (recordedDays.has(localDateKey(addLocalDays(now, -(streak + streakStart))))) streak += 1;
  return {
    todayCount: notes.filter((note) => localDateKey(note.createdAt || note.updatedAt) === today).length,
    weekDays,
    streak
  };
}

export function formatDailyMemoTime(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '방금 전';
  const diffMs = now.getTime() - date.getTime();
  if (diffMs >= 0 && diffMs < 60_000) return '방금 전';
  if (diffMs >= 0 && diffMs < 3_600_000) return `${Math.max(1, Math.floor(diffMs / 60_000))}분 전`;
  if (localDateKey(date) === localDateKey(now)) {
    return `오늘 ${new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(date)}`;
  }
  if (localDateKey(date) === localDateKey(addLocalDays(now, -1))) return '어제';
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(date);
}

function dailyMemoDraftKey(session, memoId = '') {
  const baseKey = scopedKey(DRAFT_KEY, session);
  return memoId ? `${baseKey}:edit:${memoId}` : baseKey;
}

export function readDailyMemoDraft(session, memoId = '') {
  try {
    return safeParse(sessionStorage.getItem(dailyMemoDraftKey(session, memoId)), null);
  } catch {
    return null;
  }
}

export function saveDailyMemoDraft(session, draft, memoId = '') {
  try {
    sessionStorage.setItem(dailyMemoDraftKey(session, memoId), JSON.stringify(draft));
  } catch {
    // Draft recovery is a convenience; a blocked session store must not stop memo writing.
  }
}

export function clearDailyMemoDraft(session, memoId = '') {
  try {
    sessionStorage.removeItem(dailyMemoDraftKey(session, memoId));
  } catch {
    // See saveDailyMemoDraft.
  }
}
