import { safeParse, safeRemoveItem, safeSetItem } from '../../../utils/lifeHubStorage.js';
import {
  createDefaultNoteDirectories,
  DEFAULT_NOTE_DIRECTORY_ID_SET,
  normalizeNoteDirectoryId
} from '../notesDirectoryRules.js';

const NOTE_BLOCKS_KEY = 'codex-ai-note-blocks';
const NOTE_BOARDS_KEY = 'codex-ai-note-boards';
const LIFEHUB_EVENT = 'lifehub:data-updated';
const DRAFT_KEY = 'ai-assistant-daily-memo-draft';

export const DAILY_MEMO_ALL_TAG = 'all';
export const DAILY_MEMO_ALL_FOLDER = 'all';
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

export function dailyMemoFolderId(note) {
  const folderId = normalizeNoteDirectoryId(note?.folderId || note?.boardId || note?.sector || 'personal', note?.planType);
  return folderId === DAILY_MEMO_ALL_FOLDER ? 'personal' : folderId;
}

function dailyMemoFolderName(folder) {
  return String(folder?.name || folder?.title || '').trim() || '폴더';
}

function normalizeDailyMemoFolder(folder, index = 0, timestamp = new Date().toISOString()) {
  const rawName = dailyMemoFolderName(folder);
  const id = normalizeNoteDirectoryId(folder?.id || `folder-${Date.now()}-${index}`);
  const fallback = createDefaultNoteDirectories(timestamp).find((item) => item.id === id);
  const rawParentId = String(folder?.parentId || '').trim();
  return {
    ...folder,
    id,
    parentId: DEFAULT_NOTE_DIRECTORY_ID_SET.has(id)
      ? null
      : rawParentId && rawParentId !== id
        ? normalizeNoteDirectoryId(rawParentId)
        : null,
    name: fallback?.name || rawName,
    title: fallback?.title || rawName,
    sortOrder: fallback?.sortOrder ?? (Number.isFinite(Number(folder?.sortOrder)) ? Number(folder.sortOrder) : index),
    createdAt: String(folder?.createdAt || timestamp),
    updatedAt: String(folder?.updatedAt || folder?.createdAt || timestamp)
  };
}

function normalizeDailyMemoFolders(folders, notes = []) {
  const timestamp = new Date().toISOString();
  const source = Array.isArray(folders) ? folders : [];
  const seenIds = new Set();
  const normalized = source
    .map((folder, index) => normalizeDailyMemoFolder(folder, index, timestamp))
    .filter((folder) => {
      if (folder.id === DAILY_MEMO_ALL_FOLDER || seenIds.has(folder.id)) return false;
      seenIds.add(folder.id);
      return true;
    });
  const byId = new Map(normalized.map((folder) => [folder.id, folder]));
  const defaults = createDefaultNoteDirectories(timestamp).map((folder) => ({
    ...folder,
    createdAt: byId.get(folder.id)?.createdAt || folder.createdAt,
    updatedAt: byId.get(folder.id)?.updatedAt || folder.updatedAt
  }));
  const custom = normalized.filter((folder) => !DEFAULT_NOTE_DIRECTORY_ID_SET.has(folder.id));
  const knownIds = new Set([...defaults, ...custom].map((folder) => folder.id));
  const missing = [...new Set((Array.isArray(notes) ? notes : []).map(dailyMemoFolderId))]
    .filter((id) => id && id !== DAILY_MEMO_ALL_FOLDER && !knownIds.has(id))
    .map((id, index) => normalizeDailyMemoFolder({
      id,
      name: id,
      title: id,
      parentId: null,
      sortOrder: defaults.length + custom.length + index
    }, index, timestamp));
  const combined = [...defaults, ...custom, ...missing];
  const existingIds = new Set(combined.map((folder) => folder.id));
  const folderById = new Map(combined.map((folder) => [folder.id, folder]));
  return combined
    .map((folder) => ({
      ...folder,
      parentId: (() => {
        const candidate = folder.parentId && existingIds.has(folder.parentId) && folder.parentId !== folder.id
          ? folder.parentId
          : null;
        if (!candidate) return null;
        const visited = new Set([folder.id]);
        let currentId = candidate;
        while (currentId) {
          if (visited.has(currentId)) return null;
          visited.add(currentId);
          currentId = folderById.get(currentId)?.parentId || null;
        }
        return candidate;
      })()
    }))
    .sort((left, right) => {
      const order = (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0);
      return order || dailyMemoFolderName(left).localeCompare(dailyMemoFolderName(right), 'ko');
    });
}

export function readDailyMemoFolders(session, notes = []) {
  const key = scopedKey(NOTE_BOARDS_KEY, session);
  const scoped = safeParse(localStorage.getItem(key), null);
  const legacy = legacyStorageAllowed(session) ? safeParse(localStorage.getItem(NOTE_BOARDS_KEY), null) : null;
  const source = Array.isArray(scoped) ? scoped : Array.isArray(legacy) ? legacy : [];
  const folders = normalizeDailyMemoFolders(source, notes);
  if (!Array.isArray(scoped) || JSON.stringify(source) !== JSON.stringify(folders)) {
    safeSetItem(key, JSON.stringify(folders));
  }
  return folders;
}

export function saveDailyMemoFolders(session, folders, notes = []) {
  const key = scopedKey(NOTE_BOARDS_KEY, session);
  const normalized = normalizeDailyMemoFolders(folders, notes);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  if (saved) {
    if (legacyStorageAllowed(session)) safeRemoveItem(NOTE_BOARDS_KEY);
    emitNotesChanged(key);
  }
  return { items: normalized, saved };
}

function isStructuralMarkdownLine(value) {
  const text = String(value || '').trim();
  return /^(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|>\s?|`{3,}|~{3,}|\|)/.test(text)
    || /(?:!?\[[^\]]*\]\([^)]+\)|`[^`]+`|https?:\/\/)/i.test(text);
}

export function dailyMemoPlainText(value) {
  return String(value || '')
    .replace(/^\s*`{3,}[^`]*$/, '')
    .replace(/^\s*#{1,6}\s+/, '')
    .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)(?:\[[ xX]\]\s+)?/, '')
    .replace(/^\s*>\s?/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?:;])/g, '$1$2')
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?:;])/g, '$1$2')
    .trim();
}

export function dailyMemoTitle(note) {
  if (String(note?.title || '').trim()) return dailyMemoPlainText(note.title) || '새 메모';
  const firstLine = plainContent(note).split('\n').find((line) => line.trim()) || '';
  return dailyMemoPlainText(firstLine) || '새 메모';
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
  const hashtagSource = plainContent(note)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ');
  const derived = [...hashtagSource.matchAll(/(?:^|[\s([{])#([가-힣A-Za-z0-9_-]+)/g)]
    .map((match) => match[1]);
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
  const folderId = dailyMemoFolderId(note);
  return {
    ...note,
    id: String(note?.id || `note-${Date.now()}-${index}`),
    type: note?.type || 'text',
    title,
    content: String(note?.content || `# ${title}${body ? `\n\n${body}` : '\n'}`),
    boardId: folderId,
    folderId,
    sector: folderId,
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
  const needsStableIdentity = source.some((note, index) => (
    !String(note?.id || '').trim()
    || !String(note?.createdAt || '').trim()
    || !String(note?.updatedAt || '').trim()
    || String(note?.id || '') !== notes[index]?.id
  ));

  if ((!Array.isArray(scoped) || needsStableIdentity) && notes.length) safeSetItem(key, JSON.stringify(notes));

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
  if (saved) {
    if (legacyStorageAllowed(session)) safeRemoveItem(NOTE_BLOCKS_KEY);
    emitNotesChanged(key);
  }
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
  return readDailyMemoFolders(session);
}

export function createDailyMemoDraft(note = null) {
  if (!note) return { title: '', body: '', tags: [], folderId: 'personal' };

  const title = dailyMemoTitle(note);
  const body = dailyMemoBody(note);
  if (note.titleDerived) {
    const firstBodyLine = body.split('\n').find((line) => line.trim()) || '';
    const titleAlreadyInBody = note.titleDerivedInBody === true
      || (isStructuralMarkdownLine(firstBodyLine) && dailyMemoPlainText(firstBodyLine) === title);
    return {
      title: '',
      body: titleAlreadyInBody ? body : [title, body].filter(Boolean).join('\n'),
      tags: dailyMemoTags(note),
      folderId: dailyMemoFolderId(note)
    };
  }

  return {
    title,
    body,
    tags: dailyMemoTags(note),
    folderId: dailyMemoFolderId(note)
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
  const derivedTitle = dailyMemoPlainText(firstLine);
  const title = explicitTitle || derivedTitle.slice(0, 80) || '빠른 메모';
  const structuralFirstLine = isStructuralMarkdownLine(firstLine);
  const preserveFirstLine = structuralFirstLine || derivedTitle.length > 80;
  const serializedBody = explicitTitle
    ? body
    : bodyLines.slice(preserveFirstLine ? firstContentIndex : firstContentIndex + 1).join('\n').trim();
  const tags = [...new Set((Array.isArray(draft?.tags) ? draft.tags : [])
    .map((tag) => String(tag || '').replace(/^#/, '').trim())
    .filter(Boolean))].slice(0, 6);
  const folderId = normalizeNoteDirectoryId(draft?.folderId || previous?.folderId || previous?.boardId || 'personal');
  const fields = { ...(previous || {}) };

  return normalizeDailyMemo({
    ...fields,
    id: previous?.id || `note-${Date.now()}`,
    title,
    content: `# ${title}${serializedBody ? `\n\n${serializedBody}` : '\n'}`,
    boardId: folderId,
    folderId,
    sector: folderId,
    tags,
    schemaVersion: 1,
    contentFormat: 'plain-v1',
    titleDerived: !explicitTitle,
    titleDerivedInBody: !explicitTitle && preserveFirstLine,
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
    return true;
  } catch {
    // Draft recovery is a convenience; a blocked session store must not stop memo writing.
    return false;
  }
}

export function clearDailyMemoDraft(session, memoId = '') {
  try {
    sessionStorage.removeItem(dailyMemoDraftKey(session, memoId));
    return true;
  } catch {
    // See saveDailyMemoDraft.
    return false;
  }
}
