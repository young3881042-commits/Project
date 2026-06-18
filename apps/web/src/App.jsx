import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import LocalTripApp from './LocalTripApp.jsx';
import ConnectionsApp from './ConnectionsApp.jsx';
import MemoNavIcon from './components/MemoNavIcon.jsx';
import MobilePageShell from './components/MobilePageShell.jsx';
import MobileWorkspaceTabs from './components/MobileWorkspaceTabs.jsx';
import AppHome from './components/home/AppHome.jsx';
import MemoList from './components/notes/MemoList.jsx';
import NotesScheduleBar from './components/notes/NotesScheduleBar.jsx';
import SidebarFolderTree from './components/notes/SidebarFolderTree.jsx';
import ReadingPage from './components/reading/ReadingPage.jsx';
import {
  DEFAULT_WORKOUT_PROFILE,
  WORKOUT_CARDIO_ACTIVITIES,
  WORKOUT_TEMPLATES,
  calculateWorkoutBmr,
  cardioActivityForId,
  cardioActivityForName,
  cardioActivityIdForExercise,
  createCardioExercise,
  estimateWorkoutCalories,
  normalizeWorkoutProfile,
  parseWorkoutNumber,
  workoutDurationMinutes,
  workoutExerciseCalories
} from './components/workout/workoutMetrics.js';
import {
  DEFAULT_NOTE_DIRECTORIES,
  DEFAULT_NOTE_DIRECTORY_ID_SET,
  createDefaultNoteDirectories,
  normalizeNoteDirectoryId
} from './components/notes/notesDirectoryRules.js';
import { loginUrlForCurrentLocation, loginUrlForRedirect, redirectToLogin } from './authRoutes.js';

const AUTH_KEY = 'codex-workspace-auth';
const LazyCodeEditor = lazy(() => import('./CodeEditor.jsx'));
const LazyBlockNoteMemoEditor = lazy(() => import('./components/notes/BlockNoteMemoEditor.jsx'));
const SCHEDULER_KEY = 'codex-personal-scheduler-items';
const AI_NOTE_KEY = 'codex-ai-note-blocks';
const AI_NOTE_BOARDS_KEY = 'codex-ai-note-boards';
const CONNECTION_SETTINGS_KEY = 'ai-assistant-connection-settings';
const LEGACY_CONNECTION_SETTINGS_KEY = 'jupiter-ai-connection-settings';
const DATA_INBOX_KEY = 'ai-assistant-data-inbox';
const LEGACY_DATA_INBOX_KEY = 'jupiter-ai-data-inbox';
const BUDGET_ENTRIES_KEY = 'ai-assistant-budget-entries';
const WORKOUT_LOGS_KEY = 'ai-assistant-workout-logs';
const WORKOUT_PROFILE_KEY = 'ai-assistant-workout-profile';
const SCHEDULER_WORKSPACE_PATH = 'app-data/scheduler.json';
const WORKOUT_SCHEDULER_TYPE = 'workout';
const WORKOUT_SCHEDULER_SOURCE = 'workout';
const KRW_FORMATTER = new Intl.NumberFormat('ko-KR');
const KCAL_FORMATTER = new Intl.NumberFormat('ko-KR');
const APP_SHORTCUTS = {
  mainHub: { label: '앱 홈', path: '/app' },
  portfolio: { label: '포트폴리오', path: '/portfolio' },
  aiTrip: { label: '장소 찾기', path: '/destinations' },
  aiSchedule: { label: '일정 만들기', path: '/planner' },
  personalScheduler: { label: '내 일정', path: '/scheduler' },
  aiMemoBoard: { label: '메모', path: '/notes' },
  dataConnections: { label: '연결', path: '/connect' },
  adminWorkspace: { label: '관리', path: '/analysisadmin' }
};
const PRIMARY_SHORTCUTS = [
  { key: 'schedule', shortcut: 'personalScheduler', icon: 'calendar' },
  { key: 'notes', shortcut: 'aiMemoBoard', icon: 'board' },
  { key: 'trip', shortcut: 'aiTrip', icon: 'trip' },
  { key: 'connections', shortcut: 'dataConnections', icon: 'link' }
];
const RECURRENCE_LABELS = {
  none: '반복 없음',
  daily: '매일',
  weekly: '매주',
  monthly: '매월'
};
const SCHEDULER_CATEGORY_OPTIONS = ['개인', '업무'];
const SCHEDULER_FILTER_OPTIONS = ['전체', ...SCHEDULER_CATEGORY_OPTIONS, '메모', '운동', '완료'];
const SCHEDULER_LEGACY_TYPE_MAP = {
  personal: '개인',
  PERSONAL: '개인',
  general: '개인',
  GENERAL: '개인',
  개인: '개인',
  study: '개인',
  STUDY: '개인',
  reading: '개인',
  READING: '개인',
  독서: '개인',
  fitness: '개인',
  FITNESS: '개인',
  travel: '개인',
  TRAVEL: '개인',
  공부: '개인',
  여행: '개인',
  운동: '개인',
  집안일: '개인',
  work: '업무',
  WORK: '업무',
  업무: '업무',
  작업: '업무',
  회의: '업무',
  검토: '업무',
  'AI Note': '메모'
};
const NOTE_SCHEDULE_SOURCES = ['AI Note', '메모', '프로젝트', '여행'];
const DEFAULT_SCHEDULER_ITEMS = [
];
const HOME_PLAN_MODES = ['personal', 'travel'];
const HOME_WORKSPACE_ALIASES = {
  personal: 'personal',
  PERSONAL: 'personal',
  general: 'personal',
  GENERAL: 'personal',
  개인: 'personal',
  study: 'personal',
  STUDY: 'personal',
  reading: 'personal',
  READING: 'personal',
  독서: 'personal',
  fitness: 'personal',
  FITNESS: 'personal',
  work: 'personal',
  WORK: 'personal',
  업무: 'personal',
  travel: 'travel',
  TRAVEL: 'travel',
  여행: 'travel'
};

function normalizeHomePlanMode(value) {
  const raw = `${value || ''}`.trim();
  return HOME_WORKSPACE_ALIASES[raw] || HOME_WORKSPACE_ALIASES[raw.toLowerCase()] || 'personal';
}

function isHomeWorkspaceValue(value) {
  const raw = `${value || ''}`.trim();
  return Boolean(HOME_WORKSPACE_ALIASES[raw] || HOME_WORKSPACE_ALIASES[raw.toLowerCase()]);
}

function normalizeNoteLabel(value) {
  return `${value || ''}`.trim().toLowerCase();
}

function normalizeNoteLabels(labels) {
  if (!Array.isArray(labels)) return [];
  return [...new Set(labels.map(normalizeNoteLabel).filter(Boolean))];
}

function inferNotePlanType({ block, boardId, title, content }) {
  const labels = normalizeNoteLabels([...(Array.isArray(block?.labels) ? block.labels : []), ...(Array.isArray(block?.tags) ? block.tags : [])]);
  const explicitValue = block?.planType || block?.plan_type || labels.find(isHomeWorkspaceValue);
  if (explicitValue) return normalizeHomePlanMode(explicitValue);
  const source = [boardId, title, content, labels.join(' ')].join(' ').toLowerCase();
  if (source.includes('travel') || source.includes('trip') || source.includes('여행') || source.includes('코스') || source.includes('숙소')) return 'travel';
  return 'personal';
}

function labelsForPlanType(planType) {
  const labels = {
    personal: ['PERSONAL', '개인'],
    travel: ['TRAVEL', '여행']
  };
  return labels[normalizeHomePlanMode(planType)] || labels.personal;
}

function memoTimestamp() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

function normalizeAuthSession(session) {
  if (!session) return null;
  return session.username === 'guestuser' && !session.isGuest ? { ...session, isGuest: true } : session;
}

function defaultConnectionSettings() {
  return {
    apiBaseUrl: '',
    storageMode: 'local-first',
    gmail: {
      status: 'not-connected',
      scope: 'metadata'
    },
    naver: {
      status: 'manual',
      email: '',
      imapHost: 'imap.naver.com',
      imapPort: '993',
      security: 'SSL/TLS'
    },
    localMessages: {
      status: 'native-required',
      platform: 'android'
    }
  };
}

function readConnectionSettings() {
  try {
    const raw = localStorage.getItem(CONNECTION_SETTINGS_KEY) || localStorage.getItem(LEGACY_CONNECTION_SETTINGS_KEY);
    const parsed = JSON.parse(raw || 'null');
    const merged = { ...defaultConnectionSettings(), ...(parsed || {}) };
    if (raw && !localStorage.getItem(CONNECTION_SETTINGS_KEY)) {
      localStorage.setItem(CONNECTION_SETTINGS_KEY, JSON.stringify(merged));
    }
    return merged;
  } catch {
    return defaultConnectionSettings();
  }
}

function saveConnectionSettings(settings) {
  localStorage.setItem(CONNECTION_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('ai-assistant:connection-settings-updated', { detail: settings }));
}

function readDataInbox() {
  try {
    const raw = localStorage.getItem(DATA_INBOX_KEY) || localStorage.getItem(LEGACY_DATA_INBOX_KEY) || '[]';
    const parsed = JSON.parse(raw);
    if (raw && !localStorage.getItem(DATA_INBOX_KEY)) {
      localStorage.setItem(DATA_INBOX_KEY, JSON.stringify(Array.isArray(parsed) ? parsed : []));
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDataInbox(items) {
  localStorage.setItem(DATA_INBOX_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('ai-assistant:data-inbox-updated', { detail: items }));
}

function normalizeSchedulerType(type) {
  const raw = String(type || '').trim();
  return SCHEDULER_LEGACY_TYPE_MAP[raw] || raw || '업무';
}

function isWorkoutSchedulerItem(item) {
  return item?.type === WORKOUT_SCHEDULER_TYPE
    || item?.source === WORKOUT_SCHEDULER_SOURCE
    || item?.origin?.kind === 'workout';
}

function schedulerDisplayType(item) {
  return isWorkoutSchedulerItem(item) ? '운동' : normalizeSchedulerType(item?.type);
}

function schedulerTimeValue(item) {
  return isTimeKey(item?.time) ? item.time : '';
}

function schedulerTimeLabel(item) {
  return schedulerTimeValue(item) || '종일';
}

function schedulerSortTime(item) {
  return schedulerTimeValue(item) || '99:99';
}

function schedulerSortKey(item, includeDate = false) {
  return [
    includeDate ? item?.date || '' : '',
    schedulerSortTime(item),
    item?.title || ''
  ].filter((part) => part !== '').join(' ');
}

function schedulerSourceRecordId(item) {
  return item?.recurring ? item.sourceId || item.id : item?.id;
}

function apiUrlFor(path) {
  if (!path || /^https?:\/\//i.test(path)) return path;
  const baseUrl = readConnectionSettings().apiBaseUrl.trim().replace(/\/+$/, '');
  return baseUrl ? `${baseUrl}${path.startsWith('/') ? path : `/${path}`}` : path;
}

export function addSchedulerItem(item) {
  const title = String(item?.title || item?.name || '').trim();
  if (!title) return null;
  const now = new Date();
  const nextItem = {
    id: item?.id || `schedule-${now.getTime()}`,
    title,
    date: item?.date || toDateKey(now),
    time: item?.time || '09:00',
    type: normalizeSchedulerType(item?.type),
    memo: item?.memo || item?.note || '',
    recurrence: Object.keys(RECURRENCE_LABELS).includes(item?.recurrence) ? item.recurrence : 'none',
    recurrenceEnd: item?.recurrenceEnd || '',
    doneOverrides: item?.doneOverrides || {},
    source: item?.source || '',
    done: Boolean(item?.done)
  };
  const storageKey = schedulerStorageKey();
  const current = readSchedulerItems(storageKey);
  const next = [...current, nextItem];
  localStorage.setItem(storageKey, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('codex:scheduler-items-updated', { detail: { item: nextItem, items: next, storageKey } }));
  return nextItem;
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function requestJson(path, options = {}) {
  const response = await fetch(apiUrlFor(path), options);
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      localStorage.removeItem(AUTH_KEY);
      window.location.reload();
      throw new Error('Session expired');
    }
    throw new Error((await response.text()) || `HTTP ${response.status}`);
  }
  const text = await response.text();
  if (!text) {
    return null;
  }
  return JSON.parse(text);
}

async function requestText(path, token) {
  const response = await fetch(apiUrlFor(path), { headers: authHeaders(token) });
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      localStorage.removeItem(AUTH_KEY);
      window.location.reload();
      throw new Error('Session expired');
    }
    throw new Error((await response.text()) || `HTTP ${response.status}`);
  }
  return response.text();
}

function normalizeSchedulerItems(items) {
  return Array.isArray(items)
    ? items.map(normalizeSchedulerItem).filter((item) => item?.id && !item.id?.startsWith?.('schedule-demo-'))
    : [];
}

function mergeSchedulerItems(current, incoming) {
  return dedupeSchedulerItems(mergeStorageArrays(incoming, current).map(normalizeSchedulerItem));
}

async function loadWorkspaceSchedulerItems(token) {
  if (!token) return [];
  try {
    const text = await requestText(`/api/workspace/file?path=${encodeURIComponent(SCHEDULER_WORKSPACE_PATH)}`, token);
    const parsed = JSON.parse(text || '[]');
    return normalizeSchedulerItems(Array.isArray(parsed) ? parsed : parsed.items);
  } catch {
    return [];
  }
}

async function saveWorkspaceSchedulerItems(token, items) {
  if (!token) return;
  await requestJson('/api/workspace/folder?path=app-data', {
    method: 'POST',
    headers: authHeaders(token)
  }).catch(() => null);
  await requestJson('/api/workspace/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({
      path: SCHEDULER_WORKSPACE_PATH,
      content: `${JSON.stringify(normalizeSchedulerItems(items), null, 2)}\n`
    })
  });
}

function saveSchedulerItems(storageKey, items) {
  const nextItems = dedupeSchedulerItems(normalizeSchedulerItems(items));
  localStorage.setItem(storageKey, JSON.stringify(nextItems));
  if (storageKey !== SCHEDULER_KEY && localStorage.getItem(SCHEDULER_KEY)) {
    localStorage.removeItem(SCHEDULER_KEY);
  }
  window.dispatchEvent(new CustomEvent('codex:scheduler-items-updated', { detail: { items: nextItems, storageKey } }));
  return nextItems;
}

function joinPath(base, name) {
  return base ? `${base}/${name}` : name;
}

function labelForPath(path) {
  if (!path) return 'Workspace';
  const tokens = path.split('/').filter(Boolean);
  return tokens[tokens.length - 1] || 'Workspace';
}

function workspacePathFor(path) {
  return path ? `/workspace/${path}` : '/workspace';
}

function extensionForPath(path) {
  const fileName = labelForPath(path);
  const index = fileName.lastIndexOf('.');
  if (index === -1 || index === fileName.length - 1) {
    return 'text';
  }
  return fileName.slice(index + 1).toLowerCase();
}

function formatSize(size) {
  if (!size) return '-';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? normalizeAuthSession(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function storageUsername(input = readStoredAuth()) {
  const username = typeof input === 'string' ? input : input?.username;
  return String(username || 'guestuser').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'guestuser';
}

function userStorageKey(baseKey, input = readStoredAuth()) {
  return `${baseKey}:${storageUsername(input)}`;
}

function readArrayStorage(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function storageRecordIdentity(item, index = 0) {
  if (item?.id) return `id:${item.id}`;
  if (item?.filePath) return `file:${item.filePath}`;
  if (item?.path) return `path:${item.path}`;
  return `value:${JSON.stringify([
    item?.date || '',
    item?.time || '',
    item?.title || item?.name || '',
    item?.content || ''
  ]) || index}`;
}

function mergeStorageArrays(...arrays) {
  const seen = new Set();
  const merged = [];
  arrays.flat().filter(Boolean).forEach((item, index) => {
    const key = storageRecordIdentity(item, index);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });
  return merged;
}

function storageUsernameFromKey(baseKey, storageKey) {
  if (typeof storageKey !== 'string') return '';
  const prefix = `${baseKey}:`;
  return storageKey.startsWith(prefix) ? storageKey.slice(prefix.length) : '';
}

function isStorageKeyInput(baseKey, input) {
  return typeof input === 'string' && (input === baseKey || input.startsWith(`${baseKey}:`));
}

function scopedStorageKey(baseKey, input = readStoredAuth()) {
  return isStorageKeyInput(baseKey, input) ? input : userStorageKey(baseKey, input);
}

function readUserArrayStorage(baseKey, input = readStoredAuth()) {
  const storageKey = scopedStorageKey(baseKey, input);
  const current = readArrayStorage(storageKey);
  const username = storageUsernameFromKey(baseKey, storageKey) || storageUsername(input);
  const fallbackKeys = [];

  if (storageKey !== baseKey && username === 'guestuser') {
    fallbackKeys.push(baseKey);
  }

  if (current && current.length) {
    return { storageKey, items: current };
  }

  const fallbackItems = fallbackKeys
    .filter((key, index, keys) => key !== storageKey && keys.indexOf(key) === index)
    .flatMap((key) => readArrayStorage(key) || []);
  const merged = mergeStorageArrays(current || [], fallbackItems);

  if (merged.length && storageKey !== baseKey) {
    localStorage.setItem(storageKey, JSON.stringify(merged));
  }

  return { storageKey, items: merged.length ? merged : current };
}

function schedulerStorageKey(input = readStoredAuth()) {
  return userStorageKey(SCHEDULER_KEY, input);
}

function noteBlocksStorageKey(input = readStoredAuth()) {
  return userStorageKey(AI_NOTE_KEY, input);
}

function noteBoardsStorageKey(input = readStoredAuth()) {
  return userStorageKey(AI_NOTE_BOARDS_KEY, input);
}

function budgetStorageKey(input = readStoredAuth()) {
  return userStorageKey(BUDGET_ENTRIES_KEY, input);
}

function workoutStorageKey(input = readStoredAuth()) {
  return userStorageKey(WORKOUT_LOGS_KEY, input);
}

function workoutProfileStorageKey(input = readStoredAuth()) {
  return userStorageKey(WORKOUT_PROFILE_KEY, input);
}

function readSchedulerItems(input) {
  try {
    const { items } = readUserArrayStorage(SCHEDULER_KEY, input);
    if (items === null) {
      return DEFAULT_SCHEDULER_ITEMS;
    }
    return Array.isArray(items) ? items.map(normalizeSchedulerItem).filter((item) => !item.id?.startsWith?.('schedule-demo-')) : DEFAULT_SCHEDULER_ITEMS;
  } catch {
    return DEFAULT_SCHEDULER_ITEMS;
  }
}

function dedupeSchedulerItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item?.id || `${item?.date || ''}:${item?.time || ''}:${item?.title || ''}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readCurrentSchedulerItems(session = readStoredAuth()) {
  return dedupeSchedulerItems(readSchedulerItems(schedulerStorageKey(session)));
}

function normalizeSchedulerItem(item) {
  return {
    ...item,
    type: normalizeSchedulerType(item?.type),
    time: isTimeKey(item?.time) ? item.time : '',
    recurrence: Object.keys(RECURRENCE_LABELS).includes(item?.recurrence) ? item.recurrence : 'none',
    recurrenceEnd: item?.recurrenceEnd || '',
    doneOverrides: item?.doneOverrides && typeof item.doneOverrides === 'object' ? item.doneOverrides : {},
    source: item?.source === 'AI Note' ? '메모' : item?.source || ''
  };
}

function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(`${value || ''}`)) return false;
  const [year, month, day] = `${value}`.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isTimeKey(value) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(`${value || ''}`);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function compareDatedRecords(left, right) {
  const leftKey = `${left?.date || ''} ${left?.createdAt || ''}`;
  const rightKey = `${right?.date || ''} ${right?.createdAt || ''}`;
  return rightKey.localeCompare(leftKey);
}

function formatKoreanMoney(value) {
  const amount = Number(value) || 0;
  const sign = amount < 0 ? '-' : '';
  return `${sign}${KRW_FORMATTER.format(Math.abs(amount))}원`;
}

function formatKcal(value) {
  const amount = Math.max(0, Math.round(Number(value) || 0));
  return `${KCAL_FORMATTER.format(amount)}kcal`;
}

function summarizeBudgetEntries(entries) {
  return entries.reduce((summary, entry) => {
    if (entry.type === 'deposit') {
      return { ...summary, income: summary.income + entry.amount };
    }
    return { ...summary, expense: summary.expense + entry.amount };
  }, { income: 0, expense: 0 });
}

function normalizeBudgetEntry(entry, index = 0) {
  const amount = Math.round(Math.abs(Number(entry?.amount) || 0));
  if (!amount) return null;
  const date = isDateKey(entry?.date) ? entry.date : toDateKey(new Date());
  const type = entry?.type === 'deposit' ? 'deposit' : 'withdraw';
  const category = String(entry?.category || '').trim() || (type === 'deposit' ? '입금' : '생활비');
  const memo = String(entry?.memo || '').trim();
  const createdAt = typeof entry?.createdAt === 'string' && entry.createdAt ? entry.createdAt : new Date().toISOString();
  return {
    id: String(entry?.id || `budget-${date}-${type}-${amount}-${index}`),
    type,
    amount,
    date,
    category,
    memo,
    createdAt
  };
}

function readBudgetEntries(input = readStoredAuth()) {
  try {
    const raw = localStorage.getItem(budgetStorageKey(input)) || '[]';
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeBudgetEntry).filter(Boolean).sort(compareDatedRecords).slice(0, 200);
  } catch {
    return [];
  }
}

function saveBudgetEntries(storageKey, entries) {
  const nextEntries = entries.map(normalizeBudgetEntry).filter(Boolean).sort(compareDatedRecords).slice(0, 200);
  localStorage.setItem(storageKey, JSON.stringify(nextEntries));
  return nextEntries;
}

function readWorkoutProfile(input = readStoredAuth()) {
  try {
    const raw = localStorage.getItem(workoutProfileStorageKey(input));
    return normalizeWorkoutProfile(raw ? JSON.parse(raw) : DEFAULT_WORKOUT_PROFILE);
  } catch {
    return normalizeWorkoutProfile(DEFAULT_WORKOUT_PROFILE);
  }
}

function saveWorkoutProfile(storageKey, profile) {
  const nextProfile = normalizeWorkoutProfile(profile);
  localStorage.setItem(storageKey, JSON.stringify(nextProfile));
  return nextProfile;
}

function normalizeWorkoutExercise(exercise, index = 0) {
  const name = String(exercise?.name || '').trim();
  if (!name) return null;
  const cardioActivity = cardioActivityForName(name);
  const isCardio = exercise?.mode === 'cardio' || Boolean(cardioActivity) || Boolean(exercise?.met) || Boolean(exercise?.durationMinutes);
  return {
    id: String(exercise?.id || `exercise-${index}-${name}`),
    mode: isCardio ? 'cardio' : '',
    name,
    sets: String(exercise?.sets || '').trim(),
    reps: String(exercise?.reps || '').trim(),
    weight: isCardio ? '' : String(exercise?.weight || '').trim(),
    durationMinutes: isCardio ? String(exercise?.durationMinutes || cardioActivity?.durationMinutes || '').trim() : '',
    met: isCardio ? String(exercise?.met || cardioActivity?.met || '').trim() : ''
  };
}

function workoutExercisesForTemplate(template) {
  return (template?.exercises || template?.items?.map((name) => ({ name })) || [])
    .map(normalizeWorkoutExercise)
    .filter(Boolean);
}

function normalizeWorkoutLog(log, index = 0) {
  const template = WORKOUT_TEMPLATES.find((item) => item.id === log?.templateId)
    || WORKOUT_TEMPLATES.find((item) => item.title === log?.title)
    || WORKOUT_TEMPLATES[0];
  const date = isDateKey(log?.date) ? log.date : toDateKey(new Date());
  const createdAt = typeof log?.createdAt === 'string' && log.createdAt ? log.createdAt : new Date().toISOString();
  const exercises = Array.isArray(log?.exercises) && log.exercises.length
    ? log.exercises.map(normalizeWorkoutExercise).filter(Boolean)
    : workoutExercisesForTemplate(template);
  const durationMinutes = Math.max(0, Math.round(Number(log?.durationMinutes) || 0))
    || workoutDurationMinutes({ templateId: template.id, durationMinutes: log?.durationMinutes, exercises });
  return {
    id: String(log?.id || `workout-${date}-${template.id}-${index}`),
    templateId: template.id,
    title: template.title,
    date,
    startTime: isTimeKey(log?.startTime) ? log.startTime : '',
    durationMinutes,
    caloriesBurned: Math.max(0, Math.round(Number(log?.caloriesBurned) || 0)),
    bodyWeightKg: Math.max(0, Number(log?.bodyWeightKg) || 0),
    bodyHeightCm: Math.max(0, Number(log?.bodyHeightCm) || 0),
    memo: String(log?.memo || '').trim(),
    exercises,
    createdAt
  };
}

function readWorkoutLogs(input = readStoredAuth()) {
  try {
    const raw = localStorage.getItem(workoutStorageKey(input)) || '[]';
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeWorkoutLog).filter(Boolean).sort(compareDatedRecords).slice(0, 120);
  } catch {
    return [];
  }
}

function saveWorkoutLogs(storageKey, logs) {
  const nextLogs = logs.map(normalizeWorkoutLog).filter(Boolean).sort(compareDatedRecords).slice(0, 120);
  localStorage.setItem(storageKey, JSON.stringify(nextLogs));
  return nextLogs;
}

function workoutExerciseSummary(exercise) {
  const isCardio = exercise?.mode === 'cardio' || exercise?.durationMinutes || exercise?.met;
  if (isCardio) {
    const parts = [
      exercise.durationMinutes ? `${exercise.durationMinutes}분` : '',
      exercise.met ? `${exercise.met}MET` : ''
    ].filter(Boolean);
    return [exercise.name, parts.join(' ')].filter(Boolean).join(' ');
  }
  const parts = [
    exercise.sets ? `${exercise.sets}세트` : '',
    exercise.reps ? `${exercise.reps}회` : '',
    exercise.weight ? `${exercise.weight}kg` : ''
  ].filter(Boolean);
  return [exercise.name, parts.join(' ')].filter(Boolean).join(' ');
}

function workoutLogSummary(log) {
  const exercises = Array.isArray(log?.exercises) ? log.exercises : [];
  return exercises.map(workoutExerciseSummary).filter(Boolean).join(' · ') || '운동 항목 없음';
}

function workoutScheduleTitle(log) {
  return `[운동] ${log?.title || '운동'}`;
}

function workoutScheduleDescription(log) {
  return [
    workoutLogSummary(log),
    log?.caloriesBurned ? `예상 소모: ${formatKcal(log.caloriesBurned)}` : '',
    log?.memo ? `메모: ${log.memo}` : ''
  ].filter(Boolean).join('\n');
}

function buildWorkoutScheduleItem(log, startTime = '') {
  const time = isTimeKey(startTime) ? startTime : '';
  const durationMinutes = Math.max(0, Math.round(Number(log?.durationMinutes) || 0));
  const description = workoutScheduleDescription(log);
  return {
    id: `workout-schedule-${log.id}`,
    title: workoutScheduleTitle(log),
    date: log.date,
    time,
    type: WORKOUT_SCHEDULER_TYPE,
    memo: description,
    description,
    duration: durationMinutes,
    durationMinutes,
    recurrence: 'none',
    recurrenceEnd: '',
    doneOverrides: {},
    source: WORKOUT_SCHEDULER_SOURCE,
    sourceId: log.id,
    origin: {
      kind: 'workout',
      workoutId: log.id,
      path: '/workout'
    },
    done: false
  };
}

function upsertWorkoutScheduleItem(storageKey, scheduleItem) {
  const current = readSchedulerItems(storageKey);
  const nextItems = [
    ...current.filter((item) => !(isWorkoutSchedulerItem(item) && `${item.sourceId || ''}` === `${scheduleItem.sourceId || ''}`)),
    scheduleItem
  ];
  return saveSchedulerItems(storageKey, nextItems);
}

function deleteWorkoutScheduleForLog(storageKey, workoutLogId) {
  const current = readSchedulerItems(storageKey);
  const nextItems = current.filter((item) => !(isWorkoutSchedulerItem(item) && `${item.sourceId || ''}` === `${workoutLogId || ''}`));
  if (nextItems.length === current.length) return false;
  saveSchedulerItems(storageKey, nextItems);
  return true;
}

function buildMonthDays(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return {
      key: toDateKey(day),
      dayNumber: day.getDate(),
      currentMonth: day.getMonth() === month - 1
    };
  });
}

function moveMonthKey(monthKey, offset) {
  const [year, month] = monthKey.split('-').map(Number);
  const next = new Date(year, month - 1 + offset, 1);
  return toDateKey(next).slice(0, 7);
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(date.getDate() + amount);
  return next;
}

function diffDays(fromDateKey, toDateKey) {
  const from = parseDateKey(fromDateKey);
  const to = parseDateKey(toDateKey);
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function isScheduledOnDate(item, dateKey) {
  if (!item?.date || dateKey < item.date) return false;
  if (item.recurrenceEnd && dateKey > item.recurrenceEnd) return false;
  if (item.recurrence === 'daily') return true;
  if (item.recurrence === 'weekly') return diffDays(item.date, dateKey) % 7 === 0;
  if (item.recurrence === 'monthly') {
    return parseDateKey(item.date).getDate() === parseDateKey(dateKey).getDate();
  }
  return item.date === dateKey;
}

function expandSchedulerItemsForDates(items, dateKeys) {
  const uniqueDateKeys = [...new Set(dateKeys)].sort();
  return uniqueDateKeys.flatMap((dateKey) => items
    .filter((item) => isScheduledOnDate(item, dateKey))
    .map((item) => {
      const recurring = item.recurrence && item.recurrence !== 'none';
      return {
        ...item,
        id: recurring ? `${item.id}:${dateKey}` : item.id,
        sourceId: item.id,
        date: dateKey,
        originalDate: item.date,
        recurring,
        recurrenceLabel: RECURRENCE_LABELS[item.recurrence] || RECURRENCE_LABELS.none,
        done: recurring ? Boolean(item.doneOverrides?.[dateKey]) : Boolean(item.done)
      };
    }));
}

function startOfMondayWeek(dateKey) {
  const date = parseDateKey(dateKey);
  const mondayOffset = (date.getDay() + 6) % 7;
  return addDays(date, -mondayOffset);
}

function buildWeekDays(dateKey) {
  const monday = startOfMondayWeek(dateKey);
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(monday, index);
    return {
      key: toDateKey(day),
      dayNumber: day.getDate(),
      weekday: ['월', '화', '수', '목', '금', '토', '일'][index]
    };
  });
}

function formatDateLabel(dateKey) {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}.${date.getDate()}`;
}

function defaultNoteBlocks() {
  return [];
}

const LEGACY_SAMPLE_BOARD_IDS = new Set([
  'project',
  'personal-today',
  'personal-ideas',
  'personal-review',
  'work-202411',
  'work-202606',
  'work-202607',
  'project-web-refresh',
  'project-android',
  'travel',
  'travel-gyeongju',
  'travel-food',
  'travel-schedule',
  'company-ndap',
  'company-docker-board',
  'company-dev-server',
  'company-miniconda',
  'company-incheon'
]);

const DEFAULT_MEMO_BOARD_ID_SET = DEFAULT_NOTE_DIRECTORY_ID_SET;

function isLegacySampleNote(block) {
  const id = `${block?.id || ''}`;
  return id.startsWith('seed-') || /^memo-(todo|progress|review|done)-\d+$/.test(id);
}

function defaultMemoBoards() {
  return createDefaultNoteDirectories(memoTimestamp());
}

function readMemoBoards(input = readStoredAuth()) {
  try {
    const defaults = defaultMemoBoards();
    const { items: parsed } = readUserArrayStorage(AI_NOTE_BOARDS_KEY, input);
    if (parsed === null) return defaults;
    if (!Array.isArray(parsed)) return defaults;
    const boards = parsed
      .filter((board) => !LEGACY_SAMPLE_BOARD_IDS.has(`${board?.id || ''}`))
      .map(normalizeMemoBoard)
      .filter(Boolean);
    const boardById = boards.reduce((map, board) => (map.has(board.id) ? map : map.set(board.id, board)), new Map());
    const refreshedDefaults = defaults.map((board) => ({
      ...board,
      updatedAt: boardById.get(board.id)?.updatedAt || board.updatedAt
    }));
    const customBoards = boards.filter((board) => !DEFAULT_MEMO_BOARD_ID_SET.has(board.id));
    return sortedMemoFolders([...refreshedDefaults, ...customBoards]);
  } catch {
    return defaultMemoBoards();
  }
}

function normalizeMemoFolderId(value, planType = '') {
  return normalizeNoteDirectoryId(value, planType);
}

function normalizeMemoBoard(board) {
  const name = (typeof board?.name === 'string' ? board.name : board?.title || '').trim();
  const id = normalizeMemoFolderId(board?.id || name || `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const fallback = DEFAULT_NOTE_DIRECTORIES.find((item) => item.id === id);
  const rawParentId = typeof board?.parentId === 'string' && board.parentId ? board.parentId : null;
  const parentId = DEFAULT_MEMO_BOARD_ID_SET.has(id) ? null : (rawParentId ? normalizeMemoFolderId(rawParentId) : 'personal');
  const createdAt = typeof board?.createdAt === 'string' && board.createdAt ? board.createdAt : memoTimestamp();
  return {
    id,
    parentId,
    name: fallback?.name || name || id,
    title: fallback?.title || name || id,
    sortOrder: fallback?.sortOrder ?? 0,
    createdAt,
    updatedAt: typeof board?.updatedAt === 'string' && board.updatedAt ? board.updatedAt : createdAt
  };
}

function memoFolderName(folder) {
  return folder?.name || folder?.title || '메모';
}

function sortedMemoFolders(folders) {
  return [...folders].sort((left, right) => {
    const order = (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0);
    if (order) return order;
    return memoFolderName(left).localeCompare(memoFolderName(right), 'ko');
  });
}

function memoFolderChildren(folders, parentId = null) {
  const normalizedParentId = parentId || null;
  return sortedMemoFolders(folders).filter((folder) => (folder.parentId || null) === normalizedParentId);
}

function memoFolderPath(folders, folderId) {
  const path = [];
  const visited = new Set();
  let current = folders.find((folder) => folder.id === folderId);
  while (current && !visited.has(current.id)) {
    path.unshift(current);
    visited.add(current.id);
    current = current.parentId ? folders.find((folder) => folder.id === current.parentId) : null;
  }
  return path;
}

function memoFolderDescendantIds(folders, folderId) {
  const ids = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    folders.forEach((folder) => {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    });
  }
  return ids;
}

function memoFolderIdForNote(note) {
  return normalizeMemoFolderId(note?.folderId || note?.boardId || note?.sector, note?.planType);
}

function legacyScheduleFromContent(content) {
  const plain = plainMarkdownText(content || '');
  const dateMatch = plain.match(/#(\d{4}-\d{2}-\d{2})/);
  const timeMatch = plain.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
  return {
    date: dateMatch?.[1] || '',
    time: timeMatch ? timeMatch[0] : ''
  };
}

function normalizeNoteSchedule(schedule, block) {
  const hasSchedule = schedule && typeof schedule === 'object';
  const hasFlatSchedule = Object.prototype.hasOwnProperty.call(block || {}, 'scheduleEnabled')
    || Object.prototype.hasOwnProperty.call(block || {}, 'scheduleDate')
    || Object.prototype.hasOwnProperty.call(block || {}, 'scheduleTime');
  const legacy = hasSchedule || hasFlatSchedule ? { date: '', time: '' } : legacyScheduleFromContent(block?.content || '');
  const enabled = hasSchedule
    ? Boolean(schedule.enabled)
    : hasFlatSchedule
      ? Boolean(block?.scheduleEnabled)
      : Boolean(block?.type === 'schedule' || legacy.date);
  const date = isDateKey(schedule?.date)
    ? schedule.date
    : isDateKey(block?.scheduleDate)
      ? block.scheduleDate
      : legacy.date || toDateKey(new Date());
  const time = isTimeKey(schedule?.time)
    ? schedule.time
    : isTimeKey(block?.scheduleTime)
      ? block.scheduleTime
      : legacy.time || '09:00';
  return { enabled, date, time };
}

const NOTE_EDITOR_BLOCK_TYPES = ['heading', 'paragraph', 'bullet', 'checklist', 'code', 'divider'];

function newMemoEditorBlock(type = 'paragraph', patch = {}) {
  const normalizedType = NOTE_EDITOR_BLOCK_TYPES.includes(type) ? type : 'paragraph';
  return {
    id: patch.id || `memo-block-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: normalizedType,
    text: typeof patch.text === 'string' ? patch.text : '',
    checked: Boolean(patch.checked),
    level: Math.max(1, Math.min(3, Number(patch.level) || 1))
  };
}

function normalizeMemoEditorBlock(block, index = 0) {
  if (!block || typeof block !== 'object') {
    return newMemoEditorBlock('paragraph', { id: `memo-block-${index}`, text: '' });
  }
  return newMemoEditorBlock(block.type, {
    id: block.id || `memo-block-${index}`,
    text: typeof block.text === 'string' ? block.text : '',
    checked: Boolean(block.checked),
    level: block.level
  });
}

function splitMemoTitleAndBody(markdown, providedTitle = '') {
  const source = `${markdown || ''}`.replace(/\r\n/g, '\n');
  const lines = source.split('\n');
  const firstContentIndex = lines.findIndex((line) => line.trim());
  if (firstContentIndex === -1) {
    return { title: providedTitle.trim() || '새 메모', body: '' };
  }

  const firstLine = lines[firstContentIndex].trim();
  const headingMatch = firstLine.match(/^#{1,3}\s+(.+)$/);
  if (headingMatch) {
    const bodyLines = [...lines.slice(0, firstContentIndex), ...lines.slice(firstContentIndex + 1)];
    return {
      title: providedTitle.trim() || headingMatch[1].trim() || '새 메모',
      body: bodyLines.join('\n').replace(/^\s+/, '')
    };
  }

  if (providedTitle.trim()) {
    return { title: providedTitle.trim(), body: source };
  }

  return {
    title: plainMarkdownText(firstLine) || '새 메모',
    body: lines.slice(firstContentIndex + 1).join('\n').replace(/^\s+/, '')
  };
}

function markdownToMemoEditorBlocks(markdown) {
  const lines = `${markdown || ''}`.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let codeBuffer = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      if (codeBuffer) {
        blocks.push(newMemoEditorBlock('code', { text: codeBuffer.join('\n') }));
        codeBuffer = null;
      } else {
        codeBuffer = [];
      }
      return;
    }

    if (codeBuffer) {
      codeBuffer.push(line);
      return;
    }

    if (!trimmed) return;
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push(newMemoEditorBlock('heading', { level: headingMatch[1].length, text: headingMatch[2].trim() }));
      return;
    }
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push(newMemoEditorBlock('divider'));
      return;
    }
    const checklistMatch = trimmed.match(/^(?:[-*]\s*)?\[([ xX]?)\]\s*(.*)$/);
    if (checklistMatch) {
      blocks.push(newMemoEditorBlock('checklist', {
        checked: checklistMatch[1].toLowerCase() === 'x',
        text: checklistMatch[2].trim()
      }));
      return;
    }
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      blocks.push(newMemoEditorBlock('bullet', { text: bulletMatch[1].trim() }));
      return;
    }
    blocks.push(newMemoEditorBlock('paragraph', { text: line.trim() }));
  });

  if (codeBuffer) {
    blocks.push(newMemoEditorBlock('code', { text: codeBuffer.join('\n') }));
  }

  return blocks.length ? blocks : [newMemoEditorBlock('paragraph')];
}

function memoEditorBlockToMarkdown(block) {
  const normalized = normalizeMemoEditorBlock(block);
  const text = normalized.text || '';
  if (normalized.type === 'heading') return `${'#'.repeat(normalized.level || 1)} ${text}`.trimEnd();
  if (normalized.type === 'bullet') return `- ${text}`.trimEnd();
  if (normalized.type === 'checklist') return `- [${normalized.checked ? 'x' : ' '}] ${text}`.trimEnd();
  if (normalized.type === 'code') return ['```', text, '```'].join('\n');
  if (normalized.type === 'divider') return '---';
  return text;
}

function memoEditorBlocksToMarkdown(blocks) {
  const normalized = Array.isArray(blocks) ? blocks.map(normalizeMemoEditorBlock) : [];
  return normalized.map(memoEditorBlockToMarkdown).join('\n').trimEnd();
}

function memoContentFromTitleAndBlocks(title, blocks) {
  const safeTitle = title?.trim() || '새 메모';
  const body = memoEditorBlocksToMarkdown(blocks);
  return [`# ${safeTitle}`, body].filter((part) => part && part.trim()).join('\n\n');
}

function noteContentParts(block) {
  const split = splitMemoTitleAndBody(block?.content || '', typeof block?.title === 'string' ? block.title : '');
  const bodyBlocks = Array.isArray(block?.blocks) && block.blocks.length
    ? block.blocks.map(normalizeMemoEditorBlock)
    : markdownToMemoEditorBlocks(split.body);
  return {
    title: split.title || '새 메모',
    blocks: bodyBlocks,
    content: memoContentFromTitleAndBlocks(split.title || '새 메모', bodyBlocks)
  };
}

function readNoteBlocks(input = readStoredAuth()) {
  try {
    const { items: parsed } = readUserArrayStorage(AI_NOTE_KEY, input);
    if (parsed === null) {
      return defaultNoteBlocks();
    }
    if (!Array.isArray(parsed)) return defaultNoteBlocks();
    const notes = parsed.map(normalizeNoteBlock).filter((note) => !isLegacySampleNote(note));
    const defaults = defaultNoteBlocks();
    const defaultById = new Map(defaults.map((note) => [note.id, note]));
    const refreshedNotes = notes.map((note) => (defaultById.has(note.id) ? defaultById.get(note.id) : note));
    const existingIds = new Set(refreshedNotes.map((note) => note.id));
    const missingDefaults = defaults.filter((note) => !existingIds.has(note.id));
    return [...refreshedNotes, ...missingDefaults];
  } catch {
    return defaultNoteBlocks();
  }
}

function normalizeNoteBlock(block) {
  const rawBoardId = typeof block?.boardId === 'string' && block.boardId
    ? block.boardId
    : typeof block?.folderId === 'string' && block.folderId
      ? block.folderId
      : typeof block?.sector === 'string' && block.sector
        ? block.sector
        : 'personal';
  const blockType = ['text', 'file', 'checklist'].includes(block?.type) ? block.type : 'text';
  const fallbackX = 24 + (Math.abs(String(block?.id || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 180);
  const fallbackY = 24 + (Math.abs(String(block?.id || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % 220);
  const contentParts = noteContentParts(block);
  const createdAt = typeof block?.createdAt === 'string' && block.createdAt ? block.createdAt : memoTimestamp();
  const updatedAt = typeof block?.updatedAt === 'string' && block.updatedAt ? block.updatedAt : createdAt;
  const schedule = normalizeNoteSchedule(block?.schedule, block);
  const inferredPlanType = inferNotePlanType({ block, boardId: rawBoardId, title: contentParts.title, content: contentParts.content });
  const boardId = normalizeMemoFolderId(rawBoardId, inferredPlanType);
  const sector = boardId;
  const planType = boardId === 'travel' ? 'travel' : 'personal';
  const labels = [...new Set([...normalizeNoteLabels(block?.labels || block?.tags), ...labelsForPlanType(planType)])];
  return {
    id: block?.id || `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: blockType,
    planType,
    labels,
    folderId: boardId,
    title: contentParts.title,
    blocks: contentParts.blocks,
    blockNoteDocument: Array.isArray(block?.blockNoteDocument) ? block.blockNoteDocument : null,
    content: contentParts.content,
    sector,
    boardId,
    status: ['todo', 'progress', 'review', 'done'].includes(block?.status) ? block.status : 'todo',
    parentId: typeof block?.parentId === 'string' ? block.parentId : '',
    filePath: typeof block?.filePath === 'string' ? block.filePath : '',
    width: Math.max(260, Math.min(920, Number(block?.width) || 760)),
    height: Math.max(48, Math.min(180, Number(block?.height) || 58)),
    x: Math.max(0, Math.min(1600, Number(block?.x) || fallbackX)),
    y: Math.max(0, Math.min(1600, Number(block?.y) || fallbackY)),
    schedule,
    scheduleEnabled: schedule.enabled,
    scheduleDate: schedule.date,
    scheduleTime: schedule.time,
    createdAt,
    updatedAt
  };
}

function plainMarkdownText(markdown) {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*]\s*)?\[[ xX]?\]\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function isChecklistMarkdownLine(line) {
  return /^\s*(?:[-*]\s*)?\[[ xX]?\]/.test(`${line || ''}`);
}

function parseChecklistLine(line) {
  const trimmed = `${line || ''}`.trim();
  if (!trimmed) return null;
  const checkboxMatch = trimmed.match(/^(?:[-*]\s*)?\[([ xX]?)\]\s*(.*)$/);
  if (checkboxMatch) {
    return {
      checked: checkboxMatch[1].toLowerCase() === 'x',
      text: checkboxMatch[2].trim()
    };
  }
  return {
    checked: false,
    text: trimmed.replace(/^[-*]\s+/, '').trim()
  };
}

function normalizeMarkdownTasks(markdown) {
  return `${markdown || ''}`.split('\n').map((line) => {
    const match = line.match(/^(\s*)(?:[-*]\s*)?\[([ xX]?)\]\s*(.*)$/);
    if (!match) return line;
    return `${match[1]}- [${match[2].toLowerCase() === 'x' ? 'x' : ' '}] ${match[3]}`.trimEnd();
  }).join('\n');
}

function noteBlockTitle(block) {
  if (typeof block?.title === 'string' && block.title.trim()) return block.title.trim();
  const firstHeading = Array.isArray(block?.blocks)
    ? block.blocks.find((item) => item?.type === 'heading' && item.text?.trim())
    : null;
  if (firstHeading) return firstHeading.text.trim();
  const plain = plainMarkdownText(block?.content || '');
  const firstLine = plain.split('\n').map((line) => line.trim()).find(Boolean);
  return firstLine || '새 메모';
}

function noteBlockBody(block) {
  if (Array.isArray(block?.blocks)) {
    return memoEditorBlocksToMarkdown(block.blocks);
  }
  const lines = `${block?.content || ''}`.split('\n');
  const firstContentIndex = lines.findIndex((line) => line.trim());
  if (firstContentIndex === -1) return '';
  return lines.slice(firstContentIndex + 1).join('\n').replace(/^\s+/, '');
}

function noteBlockContentWithTitle(block, title) {
  const safeTitle = title.trim() || '새 메모';
  return memoContentFromTitleAndBlocks(safeTitle, block?.blocks || markdownToMemoEditorBlocks(noteBlockBody(block)));
}

function checklistItemsFromBlock(block) {
  const rawLines = `${block?.content || ''}`.split('\n');
  const firstContentIndex = rawLines.findIndex((line) => line.trim());
  const contentLines = firstContentIndex === -1 ? [] : rawLines.slice(firstContentIndex);
  const firstLine = contentLines[0]?.trim() || '';
  const hasChecklistAfterFirst = contentLines.slice(1).some(isChecklistMarkdownLine);
  const bodyLines = firstLine.startsWith('#') || (!isChecklistMarkdownLine(firstLine) && hasChecklistAfterFirst)
    ? contentLines.slice(1)
    : contentLines;
  const lines = bodyLines.map((line) => line.trim()).filter(Boolean);
  const items = lines.map(parseChecklistLine).filter(Boolean);
  return items.length ? items : [{ checked: false, text: '' }];
}

function checklistContentWithItems(block, items) {
  const title = noteBlockTitle(block);
  const lines = items.length ? items : [{ checked: false, text: '' }];
  return [
    `# ${title}`,
    '',
    ...lines.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`)
  ].join('\n');
}

function noteScheduleSource(block) {
  return memoFolderIdForNote(block) === 'travel' ? '여행' : '메모';
}

function blockHasScheduleMarker(block) {
  return Boolean(block?.schedule?.enabled);
}

function parseNoteScheduleBlock(block) {
  const source = noteScheduleSource(block);
  const schedule = normalizeNoteSchedule(block.schedule, block);
  if (!schedule.enabled) return null;
  const title = noteBlockTitle(block)
    .replace(/#\d{4}-\d{2}-\d{2}/g, '')
    .replace(/\b([01]\d|2[0-3]):([0-5]\d)\b/, '')
    .replace(/^일정\s*[:：-]?/i, '')
    .trim();
  if (!title) return null;
  const boardId = memoFolderIdForNote(block);
  return {
    id: `${source === '프로젝트' ? 'project-note' : 'ai-note'}-${block.id}`,
    title,
    date: schedule.date,
    time: schedule.time,
    type: source === '여행' ? '여행' : '메모',
    memo: noteBlockBody(block).trim() || block.content.trim(),
    recurrence: 'none',
    recurrenceEnd: '',
    source,
    origin: {
      kind: 'note',
      blockId: block.id,
      boardId,
      path: `/notes?board=${encodeURIComponent(boardId)}&block=${encodeURIComponent(block.id)}`
    },
    done: false
  };
}

function schedulerItemSourcePath(item) {
  if (item?.origin?.path) return item.origin.path;
  if (item?.origin?.kind === 'workout' || isWorkoutSchedulerItem(item)) return '/workout';
  if (item?.origin?.kind === 'note' && item.origin.blockId) {
    const boardId = normalizeMemoFolderId(item.origin.boardId || 'personal');
    return `/notes?board=${encodeURIComponent(boardId)}&block=${encodeURIComponent(item.origin.blockId)}`;
  }
  return '';
}

function schedulerItemSourceLabel(item) {
  return isWorkoutSchedulerItem(item) ? '운동' : '메모';
}

function syncNoteSchedules(blocks) {
  const schedules = blocks
    .filter(blockHasScheduleMarker)
    .map(parseNoteScheduleBlock)
    .filter(Boolean);
  const scheduleIds = new Set(schedules.map((item) => item.id));
  const storageKey = schedulerStorageKey();
  const current = readSchedulerItems(storageKey);
  const withoutStaleNoteItems = current.filter((item) => !NOTE_SCHEDULE_SOURCES.includes(item.source) || scheduleIds.has(item.id));
  const merged = [
    ...withoutStaleNoteItems.filter((item) => !NOTE_SCHEDULE_SOURCES.includes(item.source)),
    ...schedules.map((schedule) => {
      const existing = current.find((item) => item.id === schedule.id);
      return { ...schedule, done: Boolean(existing?.done), doneOverrides: existing?.doneOverrides || {} };
    })
  ];
  localStorage.setItem(storageKey, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent('codex:scheduler-items-updated', { detail: { items: merged, storageKey } }));
  return schedules.length;
}

function markdownPreviewLines(markdown) {
  return markdown.split('\n').map((line, index) => {
    const key = `${index}-${line}`;
    if (line.startsWith('# ')) return <h3 key={key}>{line.slice(2)}</h3>;
    if (line.startsWith('## ')) return <h4 key={key}>{line.slice(3)}</h4>;
    if (/^\s*[-*]\s+\[[ xX]\]\s+/.test(line)) {
      const checked = /^\s*[-*]\s+\[[xX]\]\s+/.test(line);
      return (
        <label key={key} className="markdownTaskLine">
          <input type="checkbox" checked={checked} readOnly />
          <span>{line.replace(/^\s*[-*]\s+\[[ xX]\]\s+/, '')}</span>
        </label>
      );
    }
    if (/^\s*[-*]\s+/.test(line)) return <p key={key}>• {line.replace(/^\s*[-*]\s+/, '')}</p>;
    return line.trim() ? <p key={key}>{line}</p> : <br key={key} />;
  });
}

function markdownPreviewBlocks(markdown) {
  return <MarkdownPreview markdown={markdown} />;
}

function MarkdownPreview({ markdown, compact = false }) {
  const normalizedMarkdown = normalizeMarkdownTasks(markdown);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={compact ? 'markdownRender compact' : 'markdownRender'}
      components={{
        a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
        ul: ({ node, className, ...props }) => {
          const taskListClass = className?.includes('contains-task-list') ? ' markdownTaskList' : '';
          return <ul className={`${className || ''}${taskListClass}`.trim()} {...props} />;
        },
        ol: ({ node, className, ...props }) => <ol className={className || ''} {...props} />,
        li: ({ node, className, ...props }) => {
          const taskItemClass = className?.includes('task-list-item') ? ' markdownTaskItem' : '';
          return <li className={`${className || ''}${taskItemClass}`.trim()} {...props} />;
        },
        input: ({ node, className, checked, ...props }) => (
          <input
            {...props}
            checked={Boolean(checked)}
            className={`${className || ''} markdownCheckbox ${checked ? 'checked' : ''}`.trim()}
            readOnly
            aria-checked={checked ? 'true' : 'false'}
          />
        )
      }}
    >
      {normalizedMarkdown}
    </ReactMarkdown>
  );
}

function ChecklistPreview({ items }) {
  const normalizedItems = Array.isArray(items) && items.length ? items : [{ checked: false, text: '' }];
  return (
    <div className="memoChecklistPreview" aria-label="체크리스트 미리보기">
      {normalizedItems.map((item, index) => (
        <div className="memoChecklistPreviewItem" key={`checklist-preview-${index}`}>
          <input type="checkbox" checked={Boolean(item.checked)} readOnly disabled />
          <span className="memoChecklistPreviewText">{item.text || ' '}</span>
        </div>
      ))}
    </div>
  );
}

function updateMarkdownLine(markdown, lineIndex, value) {
  const lines = `${markdown || ''}`.split('\n');
  const safeIndex = Math.max(0, Math.min(lineIndex, Math.max(0, lines.length - 1)));
  lines[safeIndex] = value;
  return lines.join('\n');
}

function insertMarkdownLine(markdown, lineIndex) {
  const lines = `${markdown || ''}`.split('\n');
  const safeIndex = Math.max(0, Math.min(lineIndex + 1, lines.length));
  lines.splice(safeIndex, 0, '');
  return { content: lines.join('\n'), lineIndex: safeIndex };
}

if (typeof window !== 'undefined') {
  window.codexScheduler = {
    ...(window.codexScheduler || {}),
    addItem: addSchedulerItem
  };
}

function parentPathOf(path) {
  if (!path) return '';
  const tokens = path.split('/').filter(Boolean);
  tokens.pop();
  return tokens.join('/');
}

function monitorUrls() {
  const host = window.location.hostname || 'localhost';
  return {
    grafana: `http://${host}:30300`,
    prometheus: `http://${host}:30090`
  };
}

function formatCpu(milli) {
  if (!milli) return '0m';
  if (milli >= 1000) return `${(milli / 1000).toFixed(1)} cores`;
  return `${milli}m`;
}

function formatMemory(mib) {
  if (!mib) return '0 MiB';
  if (mib >= 1024) return `${(mib / 1024).toFixed(1)} GiB`;
  return `${mib} MiB`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function validateAuthForm(mode, username, password) {
  const trimmedUsername = username.trim();
  if (!trimmedUsername) {
    return '아이디를 입력하세요.';
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmedUsername)) {
    return '아이디는 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.';
  }
  if (trimmedUsername.length > 40) {
    return '아이디는 40자 이하여야 합니다.';
  }
  if (!password.trim()) {
    return '비밀번호를 입력하세요.';
  }
  if (mode === 'signup') {
    return passwordPolicyError(password);
  }
  if (password.length < 4) {
    return '비밀번호를 입력하세요.';
  }
  if (password.length > 100) {
    return '비밀번호는 100자 이하여야 합니다.';
  }
  return '';
}

function passwordPolicyError(password) {
  if (password.length < 8) {
    return '비밀번호는 8자 이상이어야 합니다.';
  }
  if (password.length > 100) {
    return '비밀번호는 100자 이하여야 합니다.';
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return '비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.';
  }
  return '';
}

function ToolbarIcon({ children }) {
  return (
    <span className="toolbarIcon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

function AuthScreen({ mode, setMode, username, setUsername, password, setPassword, onSubmit, loading, error }) {
  const validationError = validateAuthForm(mode, username, password);
  const disabled = loading || Boolean(validationError);

  return (
    <main className="loginShell">
      <section className="loginCard">
        <span className="sidebarEyebrow">Workspace</span>
        <h1>작업공간 로그인</h1>
        <p>관리자가 발급한 계정으로 로그인하세요.</p>
        <label className="loginField">
          <span>ID</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="my-id" />
        </label>
        <label className="loginField">
          <span>비밀번호</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="password" />
        </label>
        <button type="button" className="loginButton" onClick={onSubmit} disabled={disabled}>
          {loading ? '처리 중...' : '로그인'}
        </button>
        {error || validationError ? <div className="loginHint">{error || validationError}</div> : null}
      </section>
    </main>
  );
}

function authRedirectTarget(fallback = '/scheduler') {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect') || fallback;
  if (!redirect.startsWith('/') || redirect.startsWith('//') || redirect.startsWith('/login') || redirect.startsWith('/signup')) {
    return fallback;
  }
  return redirect;
}

function AppAuthPage({ mode, navigate }) {
  const isSignup = mode === 'signup';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const redirectTarget = authRedirectTarget('/scheduler');

  useEffect(() => {
    document.title = isSignup ? '회원가입' : '로그인';
  }, [isSignup]);

  const submitAuth = async (event) => {
    event.preventDefault();
    if (loading) return;
    const validationError = validateAuthForm(mode, username, password);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const session = await requestJson(isSignup ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const normalized = normalizeAuthSession(session);
      localStorage.setItem(AUTH_KEY, JSON.stringify(normalized));
      navigate(redirectTarget);
    } catch (authError) {
      setError(authError.message || '처리 중 문제가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const switchPath = `${isSignup ? '/login' : '/signup'}?redirect=${encodeURIComponent(redirectTarget)}`;

  return (
    <main className="appAuthShell">
      <section className="appAuthCard">
        <button type="button" className="appAuthBack" onClick={() => navigate('/app')}>앱 홈</button>
        <div className="appAuthHeader">
          <span>{isSignup ? 'Member Signup' : 'Member Login'}</span>
          <h1>{isSignup ? '회원가입' : '로그인'}</h1>
          <p>{isSignup ? '새 계정으로 메모와 일정을 이어서 관리하세요.' : '내 계정으로 메모, 일정, 여행 코스를 이어서 확인하세요.'}</p>
        </div>
        <form className="appAuthForm" onSubmit={submitAuth}>
          <label>
            <span>아이디</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="my-id" autoComplete="username" />
          </label>
          <label>
            <span>비밀번호</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="password" autoComplete={isSignup ? 'new-password' : 'current-password'} />
          </label>
          {isSignup ? <p className="appAuthRule">8자 이상, 영문·숫자·특수문자를 모두 포함하세요.</p> : null}
          <button type="submit" className="appAuthSubmit" disabled={loading}>
            {loading ? '처리 중...' : isSignup ? '회원가입' : '로그인'}
          </button>
          {error ? <p className="appAuthError">{error}</p> : null}
        </form>
        <div className="appAuthSwitch">
          <span>{isSignup ? '이미 계정이 있나요?' : '처음 사용하시나요?'}</span>
          <button type="button" onClick={() => navigate(switchPath)}>
            {isSignup ? '로그인' : '회원가입'}
          </button>
        </div>
      </section>
    </main>
  );
}

function DirectoryTree({ path, depth = 0, selectedPath, expandedPaths, treeMap, loadingPaths, onToggle, onSelect }) {
  const node = treeMap.get(path);
  const entries = node?.entries?.filter((entry) => entry.type === 'dir') || [];

  return (
    <div className="treeLevel">
      {entries.map((entry) => {
        const nextPath = entry.path;
        const expanded = expandedPaths.includes(nextPath);
        const selected = selectedPath === nextPath;
        const loading = loadingPaths.includes(nextPath);

        return (
          <div key={nextPath} className="treeNode" style={{ '--depth': depth }}>
            <div className={`treeRow ${selected ? 'selected' : ''}`}>
              <button type="button" className="treeToggle" onClick={() => onToggle(nextPath)}>
                {expanded ? '−' : '+'}
              </button>
              <button type="button" className="treeLabel" onClick={() => onSelect(nextPath)}>
                {entry.name}
              </button>
              {loading ? <span className="treeState">…</span> : null}
            </div>
            {expanded ? (
              <DirectoryTree
                path={nextPath}
                depth={depth + 1}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                treeMap={treeMap}
                loadingPaths={loadingPaths}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Sidebar({ auth, onOpenLauncher, onLogout, selectedPath, expandedPaths, treeMap, loadingPaths, onToggle, onSelect }) {
  const root = treeMap.get('');
  const rootFolders = root?.entries?.filter((entry) => entry.type === 'dir') || [];

  return (
    <aside className="browserSidebar">
      <div className="sidebarHead">
        <span className="sidebarEyebrow">{auth.role}</span>
        <h1>{auth.username}</h1>
        <div className="sidebarActions">
          {auth.launcherUrl ? (
            <button type="button" className="ghostButton" onClick={onOpenLauncher}>
              Launcher
            </button>
          ) : null}
          <button type="button" className="ghostButton" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="sidebarTree">
        <div className="treeRoot">
          <button type="button" className={`treeRootLabel ${selectedPath === '' ? 'selected' : ''}`} onClick={() => onSelect('')}>
            Workspace Root
          </button>
        </div>
        {rootFolders.map((entry) => {
          const expanded = expandedPaths.includes(entry.path);
          const selected = selectedPath === entry.path;
          const loading = loadingPaths.includes(entry.path);
          return (
            <div key={entry.path} className="treeNode" style={{ '--depth': 0 }}>
              <div className={`treeRow ${selected ? 'selected' : ''}`}>
                <button type="button" className="treeToggle" onClick={() => onToggle(entry.path)}>
                  {expanded ? '−' : '+'}
                </button>
                <button type="button" className="treeLabel" onClick={() => onSelect(entry.path)}>
                  {entry.name}
                </button>
                {loading ? <span className="treeState">…</span> : null}
              </div>
              {expanded ? (
                <DirectoryTree
                  path={entry.path}
                  depth={1}
                  selectedPath={selectedPath}
                  expandedPaths={expandedPaths}
                  treeMap={treeMap}
                  loadingPaths={loadingPaths}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function AccountEditDialog({
  auth,
  open,
  loading,
  error,
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentPassword,
  onNewPassword,
  onConfirmPassword,
  onClose,
  onSubmit
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="modalOverlay" onClick={onClose}>
      <section className="accountDialog" onClick={(event) => event.stopPropagation()}>
        <div className="accountDialogHeader">
          <div>
            <span className="panelEyebrow">Account Edit</span>
            <h2>{auth.username}</h2>
            <p className="panelSubcopy">비밀번호를 변경할 수 있습니다.</p>
          </div>
          <button type="button" className="ghostButton compact" onClick={onClose}>닫기</button>
        </div>
        <div className="accountDialogBody">
          <label className="loginField">
            <span>Current Password</span>
            <input type="password" value={currentPassword} onChange={(event) => onCurrentPassword(event.target.value)} placeholder="현재 비밀번호" />
          </label>
          <label className="loginField">
            <span>New Password</span>
            <input type="password" value={newPassword} onChange={(event) => onNewPassword(event.target.value)} placeholder="새 비밀번호" />
          </label>
          <p className="loginRule">8자 이상, 영문·숫자·특수문자를 모두 포함하세요.</p>
          <label className="loginField">
            <span>Confirm Password</span>
            <input type="password" value={confirmPassword} onChange={(event) => onConfirmPassword(event.target.value)} placeholder="새 비밀번호 확인" />
          </label>
          {error ? <div className="loginHint">{error}</div> : null}
        </div>
        <div className="accountDialogFooter">
          <button type="button" className="ghostButton" onClick={onClose}>취소</button>
          <button type="button" className="sendButton" onClick={onSubmit} disabled={loading}>
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </section>
    </div>
  );
}

function WorkspaceHeader({
  auth,
  navigate,
  selectedPath,
  rightPanel,
  userMenuOpen,
  setUserMenuOpen,
  onOpenAccountEdit,
  onLogout
}) {
  const isGuest = Boolean(auth.isGuest);
  const admin = auth.role === 'ADMIN';

  return (
    <header className="workspaceTopbar">
      <section className="workspacePathCard">
        <span className="panelEyebrow">{admin ? 'Admin Resources' : 'Workspace'}</span>
        <code className="workspacePathCode">{admin ? 'docker://runtime-resources' : workspacePathFor(selectedPath)}</code>
      </section>
      <div className="workspaceUserTray">
        <div className="workspaceTopTabs">
          {PRIMARY_SHORTCUTS.map((item) => {
            const shortcut = APP_SHORTCUTS[item.shortcut];
            return (
              <button key={item.key} type="button" className="ghostButton compact" onClick={() => navigate(shortcut.path)}>
                {shortcut.label}
              </button>
            );
          })}
        </div>
        {isGuest ? (
          <div className="workspaceGuestActions">
            <div className="workspaceUserButton guestLabel" aria-label="Guest session">
              <span>Guest</span>
              <strong>{auth.username}</strong>
            </div>
            <button type="button" className="ghostButton compact" onClick={() => { localStorage.removeItem(AUTH_KEY); redirectToLogin('/analysisadmin'); }}>로그인</button>
          </div>
        ) : (
          <div className="userMenuWrap">
            <button
              type="button"
              className={`workspaceUserButton ${userMenuOpen ? 'open' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                setUserMenuOpen((current) => !current);
              }}
            >
              <span>{auth.role}</span>
              <strong>{auth.username}</strong>
            </button>
            {userMenuOpen ? (
              <div className="userMenuDropdown" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={onOpenAccountEdit}>계정 설정</button>
                <button type="button" onClick={onLogout}>로그아웃</button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
}

function FileList({
  currentTree,
  selectedPath,
  selectedFile,
  createDraft,
  setCreateDraft,
  filter,
  onFilter,
  onOpen,
  onOpenDir,
  onRunPython,
  onRename,
  onRefresh,
  onGoParent,
  onNewFile,
  onNewFolder,
  onUploadClick,
  onContextMenu,
  contextMenu
}) {
  const [renameDraft, setRenameDraft] = useState(null);

  const files = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    const sorted = currentTree.entries
      .slice()
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === 'dir' ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });
    if (!keyword) return sorted;
    return sorted.filter((entry) => entry.name.toLowerCase().includes(keyword));
  }, [currentTree.entries, filter]);

  const submitCreateDraft = async () => {
    if (!createDraft?.name?.trim()) {
      return;
    }
    const name = createDraft.name.trim();
    const basePath = createDraft.basePath || '';
    if (createDraft.kind === 'file') {
      await onNewFile(basePath, name);
    } else {
      await onNewFolder(basePath, name);
    }
    setCreateDraft(null);
  };

  const submitRenameDraft = async () => {
    if (!renameDraft?.name?.trim() || renameDraft.name.trim() === labelForPath(renameDraft.path)) {
      setRenameDraft(null);
      return;
    }
    await onRename(renameDraft.path, renameDraft.name.trim());
    setRenameDraft(null);
  };

  return (
    <section className="browserListPanel" onContextMenu={(event) => onContextMenu(event, currentTree.currentPath || '', false, false, false)}>
      <div className="panelTop simple">
        <div className="listActionBar">
          <button type="button" className="iconButton actionIconButton" title="상위 폴더로 이동" aria-label="상위 폴더로 이동" onClick={onGoParent}>
            <ToolbarIcon>
              <path d="M9 7 4 12l5 5" />
              <path d="M20 12H4" />
            </ToolbarIcon>
          </button>
          <button type="button" className="iconButton actionIconButton" title="새로고침" aria-label="새로고침" onClick={onRefresh}>
            <ToolbarIcon>
              <path d="M20 11a8 8 0 1 0 2 5.5" />
              <path d="M20 4v7h-7" />
            </ToolbarIcon>
          </button>
          <button type="button" className="iconButton actionIconButton primary" title="파일 업로드" aria-label="파일 업로드" onClick={onUploadClick}>
            <ToolbarIcon>
              <path d="M12 16V5" />
              <path d="m7 10 5-5 5 5" />
              <path d="M5 19h14" />
            </ToolbarIcon>
          </button>
        </div>
        <div className="listFilterGroup">
          <input value={filter} onChange={(event) => onFilter(event.target.value)} placeholder="파일 또는 폴더 검색" />
        </div>
      </div>
      <div className="entryList">
        {files.map((entry) => (
          <div
            key={entry.path}
            className={`entryRow ${selectedFile === entry.path || selectedPath === entry.path ? 'active' : ''}`}
            onContextMenu={(event) => onContextMenu(event, entry.path, entry.type === 'file', true, true)}
          >
            <div
              role="button"
              tabIndex={0}
              className="entryMain"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('application/x-ai-assistant-workspace', JSON.stringify({
                  path: entry.path,
                  type: entry.type
                }));
                event.dataTransfer.setData('text/plain', entry.path);
              }}
              onClick={() => {
                if (renameDraft?.path === entry.path) {
                  return;
                }
                if (entry.type === 'dir') {
                  onOpenDir(entry.path);
                } else {
                  onOpen(entry.path);
                }
              }}
              onKeyDown={(event) => {
                if (renameDraft?.path === entry.path) {
                  return;
                }
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  if (entry.type === 'dir') {
                    onOpenDir(entry.path);
                  } else {
                    onOpen(entry.path);
                  }
                }
              }}
            >
              <div className="entryMeta">
                <span className={`entryType ${entry.type}`}>{entry.type === 'dir' ? 'DIR' : extensionForPath(entry.path).toUpperCase()}</span>
                <div className="entryText">
                  {renameDraft?.path === entry.path ? (
                    <input
                      className="inlineNameInput"
                      value={renameDraft.name}
                      autoFocus
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => setRenameDraft((current) => ({ ...current, name: event.target.value }))}
                      onBlur={() => { submitRenameDraft().catch(() => {}); }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          submitRenameDraft().catch(() => {});
                        }
                        if (event.key === 'Escape') {
                          setRenameDraft(null);
                        }
                      }}
                    />
                  ) : (
                    <strong>{entry.name}</strong>
                  )}
                </div>
              </div>
              <span className="entrySize">{formatSize(entry.size)}</span>
            </div>
            {extensionForPath(entry.path) === 'py' ? (
              <button type="button" className="runButton" onClick={() => onRunPython(entry.path)} title="Python 실행">
                &gt;
              </button>
            ) : null}
          </div>
        ))}
        {!files.length && !createDraft ? <p className="emptyNotice">표시할 파일이 없습니다.</p> : null}
        {createDraft ? (
          <div className="entryRow createDraftRow">
            <div className="createDraftKinds">
              <button
                type="button"
                className={`ghostButton compact ${createDraft.kind === 'file' ? 'active' : ''}`}
                onClick={() => setCreateDraft((current) => ({ ...current, kind: 'file' }))}
              >
                파일
              </button>
              <button
                type="button"
                className={`ghostButton compact ${createDraft.kind === 'folder' ? 'active' : ''}`}
                onClick={() => setCreateDraft((current) => ({ ...current, kind: 'folder' }))}
              >
                폴더
              </button>
            </div>
            <input
              className="inlineNameInput createDraftInput"
              value={createDraft.name}
              autoFocus
              placeholder={createDraft.kind === 'file' ? '파일 이름' : '폴더 이름'}
              onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitCreateDraft().catch(() => {});
                }
                if (event.key === 'Escape') {
                  setCreateDraft(null);
                }
              }}
            />
            <button type="button" className="ghostButton compact" onClick={() => setCreateDraft(null)}>취소</button>
            <button type="button" className="sendButton compactStrong" onClick={() => submitCreateDraft().catch(() => {})}>만들기</button>
          </div>
        ) : null}
      </div>
      <div className="listFooter">
        <button
          type="button"
          className="iconButton actionIconButton"
          title="새 항목 만들기"
          aria-label="새 항목 만들기"
          onClick={() => setCreateDraft({ kind: 'file', name: '', basePath: currentTree.currentPath || '' })}
        >
          <ToolbarIcon>
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </ToolbarIcon>
        </button>
      </div>
      {contextMenu ? (
        <div className="contextMenu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          {contextMenu.renameTargetPath ? (
            <button
              type="button"
              onClick={() => {
                setRenameDraft({ path: contextMenu.renameTargetPath, name: labelForPath(contextMenu.renameTargetPath) });
                contextMenu.onClose();
              }}
            >
              이름 변경
            </button>
          ) : null}
          {contextMenu.deleteTargetPath ? (
            <button type="button" className="dangerMenuAction" onClick={contextMenu.onDelete}>삭제</button>
          ) : null}
          <button type="button" onClick={contextMenu.onNewFile}>새 파일</button>
          <button type="button" onClick={contextMenu.onNewFolder}>새 폴더</button>
          <button type="button" onClick={contextMenu.onUpload}>업로드</button>
          <button type="button" onClick={contextMenu.onRefresh}>새로고침</button>
        </div>
      ) : null}
    </section>
  );
}

function EditorPanel({ selectedFile, content, setContent, loading, error, outputState, onSave, onDelete, onDownload, autoSave, saveStatus }) {
  const hasOutput = outputState.command || outputState.stdout || outputState.stderr;
  return (
    <section className="browserPreviewPanel">
      <div className="editorHeader">
        <div>
          <span className="panelEyebrow">Editor</span>
          <h2>{selectedFile ? labelForPath(selectedFile) : '편집할 파일을 선택하세요'}</h2>
          {selectedFile ? <p className="panelSubcopy">{selectedFile}</p> : null}
          {autoSave && selectedFile ? <p className="panelSubcopy">{saveStatus || '자동 저장 준비됨'}</p> : null}
        </div>
        {selectedFile ? (
          <div className="chatHeaderActions">
            <button type="button" className="ghostButton compact" onClick={onDownload}>다운로드</button>
            <button type="button" className="ghostButton compact" onClick={onDelete}>삭제</button>
            <button type="button" className="sendButton" onClick={onSave}>{autoSave ? '지금 저장' : '저장'}</button>
          </div>
        ) : null}
      </div>
      {loading ? <p className="previewState">파일을 불러오는 중입니다.</p> : null}
      {error ? <p className="previewError">{error}</p> : null}
      {!loading && !error && !selectedFile ? <div className="previewEmpty"><p>왼쪽에서 폴더를 고르고 가운데에서 파일을 선택하세요.</p></div> : null}
      {!loading && selectedFile ? (
        <>
          <div className="editorCodeWrap">
            <Suspense fallback={<div className="editorLoading">편집기를 불러오는 중입니다.</div>}>
              <LazyCodeEditor
                path={selectedFile}
                value={content}
                onChange={(value) => setContent(value)}
                onSave={onSave}
              />
            </Suspense>
          </div>
          <div className="editorOutputSection">
            <div className="editorOutputHeader">
              <strong>실행 로그</strong>
              {outputState.command ? <span className="statusMeta">{outputState.command}</span> : null}
            </div>
            {outputState.running ? <p className="previewState">실행 중입니다.</p> : null}
            {!outputState.running && !hasOutput ? (
              <div className="previewEmpty"><p>`.py` 파일 오른쪽 실행 버튼을 누르면 이 파일 아래에 실행 로그가 표시됩니다.</p></div>
            ) : null}
            {hasOutput ? (
              <div className="outputShell">
                {outputState.stdout ? (
                  <>
                    <strong className="outputLabel">stdout</strong>
                    <pre className="outputBlock">{outputState.stdout}</pre>
                  </>
                ) : null}
                {outputState.stderr ? (
                  <>
                    <strong className="outputLabel">stderr</strong>
                    <pre className="outputBlock error">{outputState.stderr}</pre>
                  </>
                ) : null}
                {!outputState.timedOut ? (
                  <p className="statusMeta">종료 코드: {outputState.exitCode}</p>
                ) : (
                  <p className="statusMeta">실행 시간이 초과되어 종료했습니다.</p>
                )}
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

function StatTile({ label, value, detail, tone = 'default' }) {
  return (
    <article className={`monitorStatTile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function UsageBar({ value }) {
  const width = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="usageBar" aria-label={`${width.toFixed(1)}%`}>
      <span style={{ width: `${width}%` }} />
    </div>
  );
}

function AdminMonitorPanel({ authToken, activeMonitor, setActiveMonitor }) {
  const monitors = monitorUrls();
  const currentUrl = activeMonitor === 'prometheus' ? monitors.prometheus : monitors.grafana;
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [monitorError, setMonitorError] = useState('');
  const [containerSort, setContainerSort] = useState('cpu');

  const loadDashboard = async (silent = false) => {
    if (!authToken) return;
    if (!silent) setLoading(true);
    setMonitorError('');
    try {
      const data = await requestJson('/api/monitoring/cluster', { headers: authHeaders(authToken) });
      setDashboard(data);
    } catch (loadError) {
      setMonitorError(loadError.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard().catch(() => {});
    const timer = window.setInterval(() => {
      loadDashboard(true).catch(() => {});
    }, 10000);
    return () => window.clearInterval(timer);
  }, [authToken]);

  const summary = dashboard?.summary;
  const nodes = dashboard?.nodes || [];
  const namespaces = dashboard?.namespaces || [];
  const containers = [...(dashboard?.containers || [])].sort((left, right) => {
    if (containerSort === 'memory') {
      return right.memoryUsageMi - left.memoryUsageMi || right.cpuUsageMilli - left.cpuUsageMilli;
    }
    if (containerSort === 'restart') {
      return right.restartCount - left.restartCount || right.cpuUsageMilli - left.cpuUsageMilli;
    }
    return right.cpuUsageMilli - left.cpuUsageMilli || right.memoryUsageMi - left.memoryUsageMi;
  });

  return (
    <section className="browserPreviewPanel monitorDashboardPanel">
      <div className="editorHeader">
        <div>
          <span className="panelEyebrow">Cluster Resources</span>
          <h2>인프라 리소스 모니터링</h2>
          <p className="panelSubcopy">
            {dashboard ? `최근 수집: ${formatDateTime(dashboard.generatedAt)}` : '클러스터 CPU, 메모리, 컨테이너 상태를 한 화면에서 확인합니다.'}
          </p>
        </div>
        <div className="chatHeaderActions">
          <button type="button" className="ghostButton compact" onClick={() => loadDashboard()} disabled={loading}>
            {loading ? '갱신 중' : '새로고침'}
          </button>
          <button type="button" className={`ghostButton compact ${activeMonitor === 'grafana' ? 'active' : ''}`} onClick={() => setActiveMonitor('grafana')}>Grafana</button>
          <button type="button" className={`ghostButton compact ${activeMonitor === 'prometheus' ? 'active' : ''}`} onClick={() => setActiveMonitor('prometheus')}>Prometheus</button>
          <button type="button" className="sendButton" onClick={() => window.open(currentUrl, '_blank', 'noopener,noreferrer')}>새 창으로 열기</button>
        </div>
      </div>
      {monitorError ? <p className="previewError">{monitorError}</p> : null}
      {!dashboard && !monitorError ? <p className="previewState">클러스터 메트릭을 불러오는 중입니다.</p> : null}
      {dashboard ? (
        <div className="monitorDashboard">
          <div className="monitorHero">
            <StatTile
              label="CPU"
              value={formatCpu(summary?.cpuUsageMilli)}
              detail={`${formatPercent(summary?.cpuUsagePercent)} of ${formatCpu(summary?.cpuCapacityMilli)}`}
              tone="cpu"
            />
            <StatTile
              label="메모리"
              value={formatMemory(summary?.memoryUsageMi)}
              detail={`${formatPercent(summary?.memoryUsagePercent)} / ${formatMemory(summary?.memoryCapacityMi)}`}
              tone="memory"
            />
            <StatTile
              label="파드"
              value={`${summary?.runningPodCount || 0}/${summary?.podCount || 0}`}
              detail={`${summary?.containerCount || 0}개 컨테이너`}
            />
            <StatTile
              label="GPU"
              value={`${summary?.gpuAllocatable || 0}/${summary?.gpuCapacity || 0}`}
              detail={summary?.gpuCapacity ? 'GPU 리소스 노출됨' : 'GPU 리소스 없음'}
              tone={summary?.gpuCapacity ? 'gpu' : 'muted'}
            />
          </div>

          {dashboard.warnings?.length ? (
            <div className="monitorWarning">
              {dashboard.warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          ) : null}

          <div className="monitorSectionGrid">
            <section className="monitorCard">
              <div className="monitorCardHeader">
                <span className="panelEyebrow">Nodes</span>
                <strong>{summary?.nodeCount || 0}개 노드</strong>
              </div>
              <div className="nodeUsageList">
                {nodes.map((node) => (
                  <article className="nodeUsageCard" key={node.name}>
                    <div className="nodeUsageTitle">
                      <div>
                        <strong>{node.name}</strong>
                        <span>{node.role} · {node.status} · {node.podCount}개 파드</span>
                      </div>
                      <span className="statusPill ok">{formatPercent(node.cpuUsagePercent)}</span>
                    </div>
                    <div className="nodeUsageMetric">
                      <span>CPU {formatCpu(node.cpuUsageMilli)} / {formatCpu(node.cpuCapacityMilli)}</span>
                      <UsageBar value={node.cpuUsagePercent} />
                    </div>
                    <div className="nodeUsageMetric">
                      <span>RAM {formatMemory(node.memoryUsageMi)} / {formatMemory(node.memoryCapacityMi)}</span>
                      <UsageBar value={node.memoryUsagePercent} />
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="monitorCard">
              <div className="monitorCardHeader">
                <span className="panelEyebrow">Namespaces</span>
                <strong>{summary?.namespaceCount || 0}개 네임스페이스</strong>
              </div>
              <div className="monitorTable compactTable">
                <div className="monitorTableHead namespaceColumns">
                  <span>네임스페이스</span>
                  <span>파드</span>
                  <span>CPU</span>
                  <span>메모리</span>
                </div>
                {namespaces.slice(0, 12).map((namespace) => (
                  <div className="monitorTableRow namespaceColumns" key={namespace.name}>
                    <strong>{namespace.name}</strong>
                    <span>{namespace.runningPodCount}/{namespace.podCount}</span>
                    <span>{formatCpu(namespace.cpuUsageMilli)}</span>
                    <span>{formatMemory(namespace.memoryUsageMi)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="monitorCard containerMonitorCard">
            <div className="monitorCardHeader">
              <div>
                <span className="panelEyebrow">Container Usage</span>
                <strong>전체 {containers.length}개 컨테이너</strong>
              </div>
              <div className="chatHeaderActions">
                <button type="button" className={`ghostButton compact ${containerSort === 'cpu' ? 'active' : ''}`} onClick={() => setContainerSort('cpu')}>CPU</button>
                <button type="button" className={`ghostButton compact ${containerSort === 'memory' ? 'active' : ''}`} onClick={() => setContainerSort('memory')}>메모리</button>
                <button type="button" className={`ghostButton compact ${containerSort === 'restart' ? 'active' : ''}`} onClick={() => setContainerSort('restart')}>재시작</button>
              </div>
            </div>
            <div className="monitorTable containerTable">
              <div className="monitorTableHead containerColumns">
                <span>네임스페이스 / 파드</span>
                <span>컨테이너</span>
                <span>노드</span>
                <span>CPU</span>
                <span>메모리</span>
                <span>재시작</span>
              </div>
              {containers.map((container) => (
                <div className="monitorTableRow containerColumns" key={`${container.namespace}/${container.pod}/${container.container}`}>
                  <div className="containerPodCell">
                    <strong>{container.namespace}</strong>
                    <span>{container.pod}</span>
                  </div>
                  <span>{container.container}</span>
                  <span>{container.node || '-'}</span>
                  <span>{formatCpu(container.cpuUsageMilli)}</span>
                  <span>{formatMemory(container.memoryUsageMi)}</span>
                  <span>{container.restartCount}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function WorkspaceApp({ navigate }) {
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [auth, setAuth] = useState(readStoredAuth());
  const [treeMap, setTreeMap] = useState(new Map());
  const [selectedPath, setSelectedPath] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [content, setContent] = useState('');
  const [filter, setFilter] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [lastLoadedFile, setLastLoadedFile] = useState('');
  const [loadingPaths, setLoadingPaths] = useState([]);
  const [expandedPaths, setExpandedPaths] = useState([]);
  const [error, setError] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [createDraft, setCreateDraft] = useState(null);
  const [activeMonitor, setActiveMonitor] = useState('grafana');
  const [rightPanel, setRightPanel] = useState('monitor');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accountEditOpen, setAccountEditOpen] = useState(false);
  const [accountEditLoading, setAccountEditLoading] = useState(false);
  const [accountEditError, setAccountEditError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pythonOutput, setPythonOutput] = useState({
    file: '',
    command: '',
    stdout: '',
    stderr: '',
    exitCode: 0,
    timedOut: false,
    running: false
  });
  const uploadRef = useRef(null);

  const loadTree = async (path, force = false, token = auth?.token) => {
    if (!token) return null;
    if (!force && treeMap.has(path)) return treeMap.get(path);
    setLoadingPaths((current) => [...new Set([...current, path])]);
    try {
      const data = await requestJson(`/api/workspace/tree?path=${encodeURIComponent(path)}`, { headers: authHeaders(token) });
      setTreeMap((current) => {
        const next = new Map(current);
        next.set(path, data);
        return next;
      });
      return data;
    } finally {
      setLoadingPaths((current) => current.filter((item) => item !== path));
    }
  };

  useEffect(() => {
    document.title = 'Codex Workspace Browser';
  }, []);

  useEffect(() => {
    if (!auth?.token) {
      setRightPanel('monitor');
    }
  }, [auth?.token]);

  useEffect(() => {
    const closeMenu = () => {
      setContextMenu(null);
      setUserMenuOpen(false);
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    if (!auth?.token) {
      localStorage.removeItem(AUTH_KEY);
      return;
    }
    localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    loadTree('', true, auth.token).catch((loadError) => setError(loadError.message));
  }, [auth]);

  useEffect(() => {
    if (!auth?.token) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      requestJson(`/api/workspace/tree?path=${encodeURIComponent(selectedPath)}`, {
        headers: authHeaders(auth.token)
      })
        .then((data) => {
          setTreeMap((current) => {
            const next = new Map(current);
            next.set(selectedPath, data);
            return next;
          });
        })
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [auth?.token, selectedPath]);

  const currentTree = treeMap.get(selectedPath) || { currentPath: selectedPath, entries: [] };

  const handleAuth = async () => {
    const validationError = validateAuthForm(authMode, username, password);
    if (validationError || authLoading) {
      setAuthError(validationError);
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const session = await requestJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (session.role !== 'ADMIN') {
        localStorage.removeItem(AUTH_KEY);
        setAuth(null);
        setAuthError('접근 권한이 없습니다.');
        return;
      }
      setAuth(session);
      setUsername('');
      setPassword('');
    } catch (submitError) {
      setAuthError(submitError.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSelectDir = async (path) => {
    setContextMenu(null);
    setSelectedPath(path);
    setSelectedFile('');
    setContent('');
    setError('');
    await loadTree(path, false).catch((loadError) => setError(loadError.message));
  };

  const handleToggle = async (path) => {
    if (expandedPaths.includes(path)) {
      setExpandedPaths((current) => current.filter((item) => item !== path));
      return;
    }
    setExpandedPaths((current) => [...current, path]);
    await loadTree(path, false).catch((loadError) => setError(loadError.message));
  };

  const handleOpenFile = async (path) => {
    setContextMenu(null);
    setSelectedFile(path);
    setRightPanel('editor');
    setLoadingFile(true);
    setError('');
    try {
      const text = await requestText(`/api/workspace/file?path=${encodeURIComponent(path)}`, auth.token);
      setContent(text);
      setLastLoadedFile(path);
    } catch (loadError) {
      setError(loadError.message);
      setContent('');
    } finally {
      setLoadingFile(false);
    }
  };

  useEffect(() => {
    if (!auth?.token) return;
    const params = new URLSearchParams(window.location.search);
    const filePath = params.get('file');
    setAutoSave(params.get('autosave') === '1');
    if (!filePath) return;
    const parentPath = parentPathOf(filePath);
    setSelectedPath(parentPath);
    loadTree(parentPath, true)
      .then(() => handleOpenFile(filePath))
      .catch((loadError) => setError(loadError.message));
    window.history.replaceState({}, '', '/analysisadmin');
  }, [auth?.token]);

  useEffect(() => {
    if (!autoSave || !auth?.token || !selectedFile || loadingFile || selectedFile !== lastLoadedFile) {
      return undefined;
    }
    setSaveStatus('변경 내용을 자동 저장하는 중...');
    const timer = window.setTimeout(() => {
      requestJson('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ path: selectedFile, content })
      })
        .then(() => {
          setSaveStatus('자동 저장됨');
          return loadTree(selectedPath, true);
        })
        .catch((saveError) => {
          setSaveStatus(saveError.message);
        });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [autoSave, auth?.token, selectedFile, content, loadingFile, lastLoadedFile, selectedPath]);

  const handleRename = async (path, nextName) => {
    setContextMenu(null);
    const currentName = labelForPath(path);
    const newName = nextName?.trim();
    if (!newName || newName === currentName) {
      return;
    }
    try {
      const result = await requestJson('/api/workspace/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ path, newName })
      });
      const renamedPath = result.path;
      const parent = parentPathOf(path);
      await loadTree(parent, true);
      if (selectedPath === path) {
        setSelectedPath(renamedPath);
      }
      if (selectedFile === path) {
        setSelectedFile(renamedPath);
      }
    } catch (renameError) {
      setError(renameError.message);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    try {
      await requestJson('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ path: selectedFile, content })
      });
      setSaveStatus('저장됨');
      await loadTree(selectedPath, true);
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedFile) return;
    try {
      await requestJson(`/api/workspace/item?path=${encodeURIComponent(selectedFile)}`, {
        method: 'DELETE',
        headers: authHeaders(auth.token)
      });
      setSelectedFile('');
      setContent('');
      await loadTree(selectedPath, true);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const handleDeletePath = async (path) => {
    if (!path) return;
    const targetLabel = labelForPath(path);
    const confirmed = window.confirm(`'${targetLabel}' 항목을 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    const parent = parentPathOf(path);
    try {
      await requestJson(`/api/workspace/item?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers: authHeaders(auth.token)
      });

      if (selectedFile === path || selectedFile.startsWith(`${path}/`)) {
        setSelectedFile('');
        setContent('');
      }

      if (selectedPath === path || selectedPath.startsWith(`${path}/`)) {
        setSelectedPath(parent);
        await loadTree(parent, true);
        return;
      }

      await loadTree(parent || selectedPath, true);
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const handleDownload = async () => {
    if (!selectedFile) return;
    const response = await fetch(`/api/workspace/download?path=${encodeURIComponent(selectedFile)}`, {
      headers: authHeaders(auth.token)
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = labelForPath(selectedFile);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('path', selectedPath);
    form.append('file', file);
    try {
      const response = await fetch('/api/workspace/upload', {
        method: 'POST',
        headers: authHeaders(auth.token),
        body: form
      });
      if (!response.ok) {
        throw new Error((await response.text()) || `HTTP ${response.status}`);
      }
      await loadTree(selectedPath, true);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      event.target.value = '';
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setAuth(null);
    setTreeMap(new Map());
    setSelectedPath('');
    setSelectedFile('');
    setContent('');
    setFilter('');
    setError('');
    setAuthError('');
    setExpandedPaths([]);
    setContextMenu(null);
    setUserMenuOpen(false);
    setAccountEditOpen(false);
    setAccountEditError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setCreateDraft(null);
    setRightPanel('monitor');
    setPythonOutput({
      file: '',
      command: '',
      stdout: '',
      stderr: '',
      exitCode: 0,
      timedOut: false,
      running: false
    });
  };

  const openAccountEdit = () => {
    setUserMenuOpen(false);
    setAccountEditError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setAccountEditOpen(true);
  };

  const closeAccountEdit = () => {
    setAccountEditOpen(false);
    setAccountEditError('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const submitAccountEdit = async () => {
    if (accountEditLoading) {
      return;
    }
    if (!currentPassword.trim()) {
      setAccountEditError('현재 비밀번호를 입력하세요.');
      return;
    }
    const passwordError = passwordPolicyError(newPassword);
    if (passwordError) {
      setAccountEditError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setAccountEditError('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setAccountEditLoading(true);
    setAccountEditError('');
    try {
      await requestJson('/api/auth/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      closeAccountEdit();
    } catch (submitError) {
      setAccountEditError(submitError.message);
    } finally {
      setAccountEditLoading(false);
    }
  };

  const handleRefresh = async () => {
    setContextMenu(null);
    await loadTree(selectedPath, true).catch((loadError) => setError(loadError.message));
  };

  const handleGoParent = async () => {
    const nextPath = parentPathOf(selectedPath);
    await handleSelectDir(nextPath);
  };

  const handleRunPython = async (path) => {
    setSelectedFile(path);
    setRightPanel('editor');
    setPythonOutput({
      file: path,
      command: '',
      stdout: '',
      stderr: '',
      exitCode: 0,
      timedOut: false,
      running: true
    });
    try {
      const result = await requestJson(`/api/workspace/run-python?path=${encodeURIComponent(path)}`, {
        method: 'POST',
        headers: authHeaders(auth.token)
      });
      setPythonOutput({
        file: path,
        command: result.command || '',
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: typeof result.exitCode === 'number' ? result.exitCode : 0,
        timedOut: Boolean(result.timedOut),
        running: false
      });
    } catch (runError) {
      setPythonOutput({
        file: path,
        command: `python ${path}`,
        stdout: '',
        stderr: runError.message,
        exitCode: 1,
        timedOut: false,
        running: false
      });
    }
  };

  const handleCreateFile = async (basePath = selectedPath, nextName = '') => {
    setContextMenu(null);
    const previous = selectedPath;
    if (basePath !== previous) {
      setSelectedPath(basePath);
    }
    const name = nextName.trim();
    if (!name) return;
    try {
      await requestJson('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ path: joinPath(basePath, name), content: '' })
      });
      await loadTree(basePath, true);
      if (basePath !== previous) {
        setSelectedPath(basePath);
      }
    } catch (createError) {
      setError(createError.message);
    }
  };

  const handleCreateFolder = async (basePath = selectedPath, nextName = '') => {
    setContextMenu(null);
    const previous = selectedPath;
    if (basePath !== previous) {
      setSelectedPath(basePath);
    }
    const name = nextName.trim();
    if (!name) return;
    try {
      await requestJson(`/api/workspace/folder?path=${encodeURIComponent(joinPath(basePath, name))}`, {
        method: 'POST',
        headers: authHeaders(auth.token)
      });
      await loadTree(basePath, true);
      if (basePath !== previous) {
        setSelectedPath(basePath);
      }
    } catch (createError) {
      setError(createError.message);
    }
  };

  const openContextMenu = (event, targetPath, isFileTarget, allowRename = false, allowDelete = false) => {
    event.preventDefault();
    event.stopPropagation();
    const basePath = isFileTarget ? parentPathOf(targetPath) : targetPath;
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      renameTargetPath: allowRename ? targetPath : '',
      deleteTargetPath: allowDelete ? targetPath : '',
      onClose: () => setContextMenu(null),
      onNewFile: () => {
        setContextMenu(null);
        if (basePath !== selectedPath) {
          setSelectedPath(basePath);
        }
        setCreateDraft({ basePath, kind: 'file', name: '' });
      },
      onNewFolder: () => {
        setContextMenu(null);
        if (basePath !== selectedPath) {
          setSelectedPath(basePath);
        }
        setCreateDraft({ basePath, kind: 'folder', name: '' });
      },
      onUpload: () => {
        setContextMenu(null);
        if (basePath !== selectedPath) {
          setSelectedPath(basePath);
        }
        uploadRef.current?.click();
      },
      onDelete: async () => {
        setContextMenu(null);
        await handleDeletePath(targetPath);
      },
      onRefresh: handleRefresh
    });
  };

  if (!auth?.token) {
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        onSubmit={handleAuth}
        loading={authLoading}
        error={authError}
      />
    );
  }

  if (auth.role !== 'ADMIN') {
    localStorage.removeItem(AUTH_KEY);
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        onSubmit={handleAuth}
        loading={authLoading}
        error="접근 권한이 없습니다."
      />
    );
  }

  return (
    <main className="workspaceBrowserShell monitorOnly">
      <input ref={uploadRef} type="file" hidden onChange={handleUpload} />
      <WorkspaceHeader
        auth={auth}
        navigate={navigate}
        selectedPath={selectedPath}
        rightPanel={rightPanel}
        userMenuOpen={userMenuOpen}
        setUserMenuOpen={setUserMenuOpen}
        onOpenAccountEdit={openAccountEdit}
        onLogout={handleLogout}
      />
      <div className="rightPanelStack">
        <div className="panelVisible">
          <AdminMonitorPanel authToken={auth.token} activeMonitor={activeMonitor} setActiveMonitor={setActiveMonitor} />
        </div>
      </div>
      {auth.isGuest ? null : (
        <AccountEditDialog
          auth={auth}
          open={accountEditOpen}
          loading={accountEditLoading}
          error={accountEditError}
          currentPassword={currentPassword}
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          onCurrentPassword={setCurrentPassword}
          onNewPassword={setNewPassword}
          onConfirmPassword={setConfirmPassword}
          onClose={closeAccountEdit}
          onSubmit={submitAccountEdit}
        />
      )}
    </main>
  );
}

function AnalysisFileEditorPage({ navigate }) {
  const params = new URLSearchParams(window.location.search);
  const initialFile = params.get('file') || 'memo-files/새메모.md';
  const autoSave = params.get('autosave') === '1';
  const [authMode, setAuthMode] = useState('login');
  const [auth, setAuth] = useState(readStoredAuth());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [selectedFile, setSelectedFile] = useState(initialFile);
  const [content, setContent] = useState('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [loadedFile, setLoadedFile] = useState('');
  const [editorView, setEditorView] = useState('edit');
  const isMarkdownFile = ['md', 'markdown'].includes(extensionForPath(selectedFile));

  useEffect(() => {
    document.title = '파일 편집';
  }, []);

  useEffect(() => {
    if (auth?.token || authLoading) return;
    setAuthLoading(true);
    fetch('/api/auth/guest', {
      method: 'POST',
      headers: { Accept: 'application/json' }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error((await response.text()) || '게스트 세션을 만들 수 없습니다.');
        }
        return response.json();
      })
      .then((guestSession) => {
        const normalized = normalizeAuthSession({ ...guestSession, isGuest: true });
        localStorage.setItem(AUTH_KEY, JSON.stringify(normalized));
        setAuth(normalized);
        setAuthError('');
      })
      .catch((guestError) => {
        setAuthError(guestError.message);
      })
      .finally(() => setAuthLoading(false));
  }, [auth?.token, authLoading]);

  const submitAuth = async () => {
    const validationError = validateAuthForm(authMode, username, password);
    if (validationError || authLoading) {
      setAuthError(validationError);
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const session = await requestJson(authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });
      const normalized = normalizeAuthSession(session);
      localStorage.setItem(AUTH_KEY, JSON.stringify(normalized));
      setAuth(normalized);
      setUsername('');
      setPassword('');
    } catch (loginError) {
      setAuthError(loginError.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadFile = async (path = selectedFile) => {
    if (!auth?.token || !path.trim()) return;
    const filePath = path.trim();
    setLoadingFile(true);
    setError('');
    setSaveStatus('');
    try {
      const text = await requestText(`/api/workspace/file?path=${encodeURIComponent(filePath)}`, auth.token);
      setContent(text);
      setSelectedFile(filePath);
      setLoadedFile(filePath);
    } catch {
      const starter = `# ${labelForPath(filePath)}\n\n`;
      await requestJson('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ path: filePath, content: starter })
      });
      setContent(starter);
      setSelectedFile(filePath);
      setLoadedFile(filePath);
      setSaveStatus('새 파일을 만들었습니다.');
    } finally {
      setLoadingFile(false);
    }
  };

  useEffect(() => {
    if (!auth?.token) return;
    loadFile(initialFile).catch((loadError) => setError(loadError.message));
  }, [auth?.token]);

  const saveFile = async () => {
    if (!auth?.token || !selectedFile.trim()) return;
    try {
      await requestJson('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth.token) },
        body: JSON.stringify({ path: selectedFile.trim(), content })
      });
      setSaveStatus(autoSave ? '자동 저장됨' : '저장됨');
      setLoadedFile(selectedFile.trim());
    } catch (saveError) {
      setError(saveError.message);
    }
  };

  useEffect(() => {
    if (!autoSave || !auth?.token || !selectedFile || selectedFile !== loadedFile || loadingFile) {
      return undefined;
    }
    setSaveStatus('자동 저장 중...');
    const timer = window.setTimeout(() => {
      saveFile().catch((saveError) => setError(saveError.message));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [autoSave, auth?.token, selectedFile, loadedFile, content, loadingFile]);

  useEffect(() => {
    if (!isMarkdownFile || loadingFile) {
      setEditorView('edit');
      return undefined;
    }
    const timer = window.setTimeout(() => setEditorView('preview'), 900);
    return () => window.clearTimeout(timer);
  }, [content, isMarkdownFile, loadingFile]);

  if (!auth?.token) {
    if (authLoading && !authError) {
      return (
        <main className="analysisEditorShell">
          <section className="analysisEditorPanel compact">
            <span>GUEST EDITOR</span>
            <h1>게스트 편집기를 여는 중입니다</h1>
            <p>잠시 후 파일 편집 화면으로 이동합니다.</p>
          </section>
        </main>
      );
    }
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        onSubmit={submitAuth}
        loading={authLoading}
        error={authError}
      />
    );
  }

  return (
    <main className="analysisEditorShell">
      <section className="analysisEditorPanel memoEditorPanel">
        <header className="analysisEditorHeader">
          <div>
            <span>AI MEMO FILE</span>
            <h1>{labelForPath(selectedFile)}</h1>
            <p>{autoSave ? '자동 저장으로 편집됩니다.' : '파일 내용을 편집합니다.'}</p>
          </div>
          <div>
            <button type="button" onClick={() => navigate(APP_SHORTCUTS.aiMemoBoard.path)}><MemoNavIcon type="board" />{APP_SHORTCUTS.aiMemoBoard.label}</button>
            {auth.role === 'ADMIN' ? <button type="button" onClick={() => navigate(APP_SHORTCUTS.adminWorkspace.path)}>{APP_SHORTCUTS.adminWorkspace.label}</button> : null}
            {!autoSave ? <button type="button" className="analysisPrimaryAction" onClick={saveFile}><MemoNavIcon type="file" />저장</button> : null}
          </div>
        </header>
        <div className="memoEditorStatusBar">
          <strong>{labelForPath(selectedFile)}</strong>
          <span>{autoSave ? saveStatus || '자동 저장 대기 중' : saveStatus || '편집 중'}</span>
        </div>
        {loadingFile ? <p className="previewState">파일을 불러오는 중입니다.</p> : null}
        {error ? <p className="previewError">{error}</p> : null}
        <div className={`analysisEditorGrid ${isMarkdownFile ? 'markdown autoPreview' : ''} ${editorView === 'preview' ? 'showPreview' : 'showEditor'}`}>
          <section className="analysisEditSurface">
            <div className="analysisPaneHeader">
              <strong>작성</strong>
              <span>{isMarkdownFile ? '작성하면 바로 미리보기' : 'Text'}</span>
            </div>
            <div className="analysisCodeWrap">
              <Suspense fallback={<div className="editorLoading">편집기를 불러오는 중입니다.</div>}>
                <LazyCodeEditor
                  path={selectedFile}
                  value={content}
                  onChange={(value) => {
                    setEditorView('edit');
                    setContent(value);
                  }}
                  onSave={saveFile}
                />
              </Suspense>
            </div>
          </section>
          {isMarkdownFile ? (
            <section className="analysisMarkdownPreview">
              <div className="analysisPaneHeader">
                <strong>미리보기</strong>
                <button type="button" onClick={() => setEditorView('edit')}>수정</button>
              </div>
              <article className="analysisMarkdownBody">
                {content.trim() ? markdownPreviewBlocks(content) : <p>내용을 작성하면 미리보기가 표시됩니다.</p>}
              </article>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function currentPath() {
  const pathname = window.location.pathname || '/';
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return `${path}${window.location.search || ''}`;
}

const PROJECT_BOARD_TABS = ['회사 작업', '내 작업', '현재 스프린트', '타임라인'];
const MEMO_BOARD_SECTORS = [
  { id: 'project', label: '프로젝트 보드' },
  { id: 'memo', label: '메모 보드' }
];

const PROJECT_BOARD_SIDEBAR = [
  {
    title: '워크스페이스',
    items: ['프로젝트', '팀 문서', '로드맵', '회의록']
  },
  {
    title: '즐겨찾기',
    items: ['제품 출시', '디자인 리뷰', '주간 목표']
  }
];

const PROJECT_BOARD_COLUMNS = [
  {
    id: 'todo',
    title: '작업 예정',
    icon: '○',
    color: '#f59e0b',
    tasks: ['메인 화면 guest/member 제거 확인', 'AI 보드에 스케줄러 메뉴 통합', '예약 실행 문서/스크립트 제거']
  },
  {
    id: 'progress',
    title: '진행 중',
    icon: '◐',
    color: '#3b82f6',
    tasks: ['운영 Docker 웹 재배포', 'AI Trip 장소 보기 데이터 500개 표시 점검']
  },
  {
    id: 'review',
    title: '검토 중',
    icon: '◇',
    color: '#a855f7',
    tasks: ['모바일 보드/스케줄러 화면 맞춤', 'Nginx 운영 포트 확인']
  },
  {
    id: 'done',
    title: '완료',
    icon: '✓',
    color: '#22c55e',
    tasks: ['메인 화면 바로가기 2개로 단순화', '장소 보기 기본 조회 500개로 확장', '메모 제목 표시와 빠른 미리보기 적용']
  }
];

const ADMIN1_BOARD_TASKS = PROJECT_BOARD_COLUMNS.flatMap((column) => (
  column.tasks.map((task, index) => ({
    id: `admin1-goal-${column.id}-${index}`,
    title: task,
    status: column.id
  }))
));

const ADMIN1_MEMO_LOGS = [
  {
    id: 'admin1-memo-20260606-public-portfolio-cleanup',
    content: `# 2026-06-06 공개 포트폴리오 정리

- [x] 앱 표기를 ai-assistant로 정리
- [x] Android/APK 산출물과 관련 스크립트를 Git 대상에서 제거
- [x] 내부 IP와 사설 저장소 기본값을 .env.example placeholder 또는 localhost 기준으로 교체
- [x] README를 프로젝트 목적, 기능, 아키텍처, 실행/배포, 트러블슈팅 중심으로 재작성`
  },
  {
    id: 'admin1-memo-20260606-notes-home-account-blocknote-ko',
    content: `# 2026-06-06 메모 에디터와 계정 표시 정리

- [x] /notes 상세의 Markdown 원문 편집 탭을 제거하고 BlockNote 편집만 보이게 정리
- [x] BlockNote / 메뉴 설명을 한국어 사전 기준으로 표시
- [x] /notes 모바일 오른쪽 상단 검색/알림/메뉴 아이콘을 제거하고 일정 화면처럼 Guest/로그인 또는 계정/내 정보 카드 표시
- [x] /app 홈 로그인 버튼도 같은 계정 카드와 로그인 이동 방식으로 통일`
  },
  {
    id: 'admin1-memo-20260606-blocknote-login-image-assets',
    content: `# 2026-06-06 BlockNote 메모와 로그인 URL 통일

- [x] /notes 상세 편집기를 BlockNote 기반으로 교체하고 기존 메모 블록과 Markdown 원문 저장 흐름을 유지
- [x] 모든 화면의 로그인 요청을 /login 기준으로 통일
- [x] 생성형 이미지는 목업이 아니라 실제 앱 자산으로 생성·적용·검증하도록 Codex 운영 규칙에 추가`
  },
  {
    id: 'admin1-memo-20260606-travel-runtime-data-cleanup',
    content: `# 2026-06-06 여행 화면 데이터 정리

- [x] 여행 홈의 고정 프리셋 카드를 제거하고 저장된 코스와 빠른 메뉴 중심으로 정리
- [x] 장소 카드의 임의 평점, 후기 수, 실시간 방문자 표시를 제거
- [x] PC에서도 전체 웹이 모바일 폭 기준으로 보이도록 최상위 앱 프레임을 고정`
  },
  {
    id: 'admin1-memo-20260604-travel-planner-data-source',
    content: `# 2026-06-04 여행 플래너 데이터 흐름 정리

- [x] /travel 첫 화면은 저장 코스와 사용자 액션을 기준으로 구성
- [x] /planner 입력값은 사용자가 고른 지역, 일정, 취향을 우선 사용
- [x] 장소 후보는 API 응답을 정규화해 중복을 줄이고 소스 우선순위를 반영
- [x] API 오류 메시지는 HTML 응답을 그대로 노출하지 않도록 정리`
  },
  {
    id: 'admin1-memo-20260603-notes-mobile-gear-menu',
    content: `# 2026-06-03 메모 모바일 톱니바퀴 작업 메뉴

- [x] /notes 모바일 폴더와 파일 행은 누르면 이동/열기만 하도록 단순화
- [x] 오른쪽 톱니바퀴 버튼에서 이름 변경과 삭제 메뉴가 열리게 변경
- [x] 현재 폴더 상단 작업은 새 폴더와 새 메모만 남겨 화면을 간결하게 정리`
  },
  {
    id: 'admin1-memo-20260603-notes-mobile-folder-navigation',
    content: `# 2026-06-03 메모 모바일 폴더 이동형 탐색

- [x] /notes 모바일 하위 폴더를 펼침/접힘 대신 현재 폴더로 이동하는 파일탐색기 방식으로 변경
- [x] 상단에 현재 경로와 상위 이동 버튼만 표시
- [x] 현재 폴더에서 새 폴더, 새 메모, 이름 변경, 삭제 액션을 바로 실행하게 정리
- [x] 하위 폴더와 메모 파일을 같은 목록에 보여주되 파일은 열림 배지로 표시`
  },
  {
    id: 'admin1-memo-20260603-notes-folder-file-actions',
    content: `# 2026-06-03 메모 폴더/파일 액션 보강

- [x] /notes 모바일 폴더 선택 상태를 선택됨 배지와 왼쪽 강조선으로 보강
- [x] 선택 폴더 아래에 하위 폴더, 새 메모, 이름 변경, 삭제 액션을 텍스트 버튼으로 노출
- [x] 하위 폴더 파일 행에 열림 배지와 이름/삭제 버튼을 추가
- [x] 기본 내 메모 루트 폴더는 삭제 버튼이 보이지 않게 보호`
  },
  {
    id: 'admin1-memo-20260603-notes-white-no-dummy-volume-web',
    content: `# 2026-06-03 메모 화이트 UX와 web 소스 마운트 정리

- [x] /notes 모바일 첫 화면을 흰색 작업 화면 톤으로 되돌림
- [x] /notes와 /app에서 최신/최근 메모 노출을 제거
- [x] 기본 샘플 메모와 기존 seed 더미 데이터를 저장소 읽기 단계에서 제거
- [x] Docker web을 nginx 게이트웨이와 bind mount Vite web-source 구조로 정리`
  },
  {
    id: 'admin1-memo-20260603-work-memo-list-jenkins-deploy',
    content: `# 2026-06-03 업무 메모 리스트형 UI와 Jenkins 배포 옵션

- [x] note1/note2 참고 이미지 기준으로 /notes 모바일 홈을 리스트형 메모 화면으로 정리
- [x] 기본 메모 seed를 업무 체크리스트 내용으로 교체
- [x] 메모 상세는 기본 편집 포커스 없이 읽기 중심 체크리스트로 열리게 보정
- [x] 하단 바로가기에서 폴더 탭을 제거하고 홈 / 메모 / 일정 / 더보기 4개로 정리
- [x] Jenkins에 local-codex / git 배포 소스 선택 옵션과 GIT_BRANCH, GIT_REMOTE 파라미터 추가
- [x] Jenkins 컨테이너에 Docker CLI, buildx, compose 플러그인을 설치하고 Docker socket 권한을 맞춤
- [x] Jenkins local-codex 경로로 web/api Docker build와 compose 배포 검증 완료`
  },
  {
    id: 'admin1-memo-20260603-notes-notion-drilldown-markdown',
    content: `# 2026-06-03 Notion형 메모 탐색과 Markdown 편집 보강

- [x] /notes 데스크톱 화면에 접을 수 있는 왼쪽 폴더 탐색 레일 추가
- [x] 폴더 선택 시 하위 폴더와 파일 리스트를 전체 편집 영역에서 클릭해 들어가게 변경
- [x] 하위 폴더와 파일을 계속 만들며 깊게 들어갈 수 있는 탐색 흐름 보강
- [x] 메모 상세에 블록 편집과 Markdown 원문 편집 토글 추가`
  },
  {
    id: 'admin1-memo-20260603-travel-home-minimal-start',
    content: `# 2026-06-03 여행 홈 시작 화면 단순화

- [x] /travel 첫 화면을 여행 만들기 히어로와 빠른 메뉴만 남기도록 정리
- [x] 히어로 문구를 다가오는 여행이 없어요 / 새 여행을 만들어보세요로 변경
- [x] 빠른 메뉴는 장소 찾기, 코스 만들기, 내 일정, 여행 메모 4개로 고정
- [x] AI Trip, 빠른 검색, 추천 카테고리, 취향 추천 섹션 제거`
  },
  {
    id: 'admin1-memo-20260603-notes-mobile-action-home',
    content: `# 2026-06-03 메모 모바일 홈 액션 중심 정리

- [x] /notes 모바일 첫 화면에서 큰 로봇 배너와 중복 요약 카드를 제거
- [x] 상단을 짧은 인사, 검색, 프로필로 단순화
- [x] 새 메모 작성 CTA와 AI로 정리하기 CTA를 첫 화면 최상단에 배치
- [x] 최근 메모, 오늘 일정, 폴더를 숫자 대신 실제 항목 리스트로 표시
- [x] 하단 탭 용어를 노트 대신 메모로 통일하고 폴더 탭을 추가`
  },
  {
    id: 'admin1-memo-20260603-home-empty-schedule-copy',
    content: `# 2026-06-03 홈 빈 일정 카드 문구와 텍스트 줄바꿈 보정

- [x] /app 홈의 오늘/금주 일정 빈 상태에서 캘린더 그림을 제거
- [x] 등록된 일정이 없을 때 쉬어도 된다는 안내 문구로 변경
- [x] Today mode의 메모 작성, 일정 추가 버튼과 빈 일정 카드 CTA 제거
- [x] 홈 카드 안 일정/메모/진행률 글씨가 좁은 화면에서 잘리지 않도록 줄바꿈 보정`
  },
  {
    id: 'admin1-memo-20260602-travel-mobile-dashboard-ux',
    content: `# 2026-06-02 여행 모바일 홈 UX 재정리

- [x] /travel 첫 화면을 큰 검색 히어로 대신 D-Day와 빠른 실행 중심 대시보드로 변경
- [x] 여행 만들기, 장소 찾기, 내 일정, 여행 메모 액션을 모바일 첫 화면에서 바로 누를 수 있게 정리
- [x] /app 홈 일정/메모 카드를 컴포넌트로 분리하고 하단 탭을 첫 화면 하단에 고정
- [x] 홈/여행 생성 이미지 자산을 적용하고 깨진 이미지 없이 렌더링되는지 확인
- [x] Playwright 모바일 스크린샷으로 /app, /more, /travel 첫 화면 레이아웃을 검증`
  },
  {
    id: 'admin1-memo-20260601-unify-mobile-nav-travel-direct',
    content: `# 2026-06-01 메모·여행 상단 네비게이션 통일과 여행 직접 진입

- [x] /more 여행 카드가 선택창 없이 여행 메인 화면으로 바로 이동하게 변경
- [x] 여행 화면 상단 바를 일정 화면과 같은 workspace navigator 톤으로 통일
- [x] 메모 모바일에서도 일정 화면과 같은 공통 상단 네비게이션이 보이게 보정
- [x] Playwright 모바일 스크린샷으로 /more, /travel, /notes, /scheduler 상단바 겹침 여부 확인
- [x] Docker 빌드 캐시 16GB 정리 후 루트 디스크 여유 공간 확보`
  },
  {
    id: 'admin1-memo-20260601-remove-home-travel-tab-more-overlay-dday',
    content: `# 2026-06-01 홈 여행 탭 제거와 더보기 여행 선택창 보정

- [x] /app 홈 상단의 개인/여행 선택 탭을 제거하고 개인 워크스페이스 화면으로 고정
- [x] /more 여행 카드가 바로 이동하지 않고 기존 여행 선택창을 열게 변경
- [x] 모바일 여행 홈 D-Day 카드가 상단 바와 겹치지 않도록 여백과 배지 배치 보정`
  },
  {
    id: 'admin1-memo-20260601-home-travel-overlay-more-features',
    content: `# 2026-06-01 홈 여행 오버레이와 더보기 기능 카드 정리

- [x] /app 홈의 여행 탭이 바로 여행 화면으로 이동하지 않고 전체 오버레이를 열게 변경
- [x] 여행 오버레이에서 여행지 찾기, 여행 만들기, 저장 코스, 여행 메모를 분리해 선택하게 정리
- [x] /more에 가계부, 운동, 독서 카드를 기존 여행 카드와 같은 인터페이스로 추가`
  },
  {
    id: 'admin1-memo-20260601-mobile-home-more-travel-nav',
    content: `# 2026-06-01 모바일 홈·더보기·여행 네비게이션 정리

- [x] /app 기본 화면을 개인 워크스페이스로 고정하고 오늘/금주 일정 체크 목록을 우선 노출
- [x] 일정 체크 상태를 스케줄러 저장소에 반영해 새로고침 후에도 유지
- [x] /more 확장 기능 진입점을 추가하고 현재 기능은 여행만 노출
- [x] /destinations 여행 홈 상단에 D-Day 카드를 배치
- [x] 여행 화면 모바일 하단 네비게이션은 홈/노트/일정/더보기 공용 탭 하나만 보이게 정리`
  },
  {
    id: 'admin1-memo-20260601-remove-home-ai-suggestion',
    content: `# 2026-06-01 홈 AI 정리 제안 제거

- [x] /app 메인 화면에서 AI 정리 제안 카드를 제거
- [x] 관련 홈 컴포넌트와 전용 스타일 정리`
  },
  {
    id: 'admin1-memo-20260601-simple-home-login-schedule-rate',
    content: `# 2026-06-01 홈 로그인 버튼과 내 일정 단순화

- [x] /app 우측 상단을 로그인 또는 내 정보 버튼 하나만 보이게 정리
- [x] 내 일정 카드에서 메모/할 일 개수 대신 오늘 일정 달성률과 금주 일정 달성률만 표시
- [x] 내 일정 카드의 기본 이동을 스케줄러로 맞춤`
  },
  {
    id: 'admin1-memo-20260601-personal-travel-robot-home',
    content: `# 2026-06-01 개인/여행 홈과 로봇 비주얼 복구

- [x] /app 홈 상단 선택을 개인 / 여행 두 개 모드로 변경
- [x] 기존 robot-guide.png 자산을 홈 첫 화면 로봇 히어로로 다시 배치
- [x] 여행 모드 빠른 실행을 여행 메모, 코스 만들기, 장소 찾기, 일정 보기로 분기
- [x] 홈 데이터 집계를 개인 일정/메모와 여행 코스/여행 메모 기준으로 분리`
  },
  {
    id: 'admin1-memo-20260531-personal-work-home-redesign',
    content: `# 2026-05-31 개인/업무 워크스페이스 홈 단순화

- [x] /app 홈 상단을 개인 워크스페이스 / AI 일정 도우미와 알림/메뉴 아이콘 구조로 정리
- [x] 워크스페이스 전환을 개인 / 업무 segmented control 두 개로 축소
- [x] 첫 화면을 오늘의 흐름, 빠른 실행, 최근 메모, AI 정리 제안 순서로 재배치
- [x] 업무 탭은 업무 메모, 일정, 할 일 기준 데이터로 바뀌게 보정
- [x] 하단 탭을 홈, 노트, 일정, 더보기로 단순화`
  },
  {
    id: 'admin1-memo-20260531-inline-home-login',
    content: `# 2026-05-31 홈 인라인 로그인과 빠른 실행 겹침 보정

- [x] /app 홈의 알림/로그인 버튼이 /login으로 이동하지 않고 계정 카드 아래 로그인 폼을 펼치도록 변경
- [x] 인라인 로그인/회원가입 성공 후 현재 홈 화면에 머물며 세션만 갱신
- [x] 모바일 빠른 실행을 2열로 내려 일정 추가와 할 일 추가 카드 겹침 방지
- [x] 기존 /login 라우트는 직접 접근용으로 유지`
  },
  {
    id: 'admin1-memo-20260531-home-v2-workspace-dashboard',
    content: `# 2026-05-31 홈 V2 개인 워크스페이스 대시보드

- [x] /app 홈을 23.png 기준 개인 워크스페이스 / AI 일정 도우미 구조로 재정리
- [x] 개인, 여행, 업무, 공부, 운동 섹터별 홈 카피, 빠른 실행, AI 제안 문구 분기
- [x] 오늘의 핵심 카드에 실제 일정, 할 일, 메모 집계 칩을 표시
- [x] 최근 메모는 선택 섹터별 최대 2개와 날짜/라벨만 노출
- [x] 워크스페이스 현황은 progress bar 대신 숫자 요약 중심으로 변경
- [x] 여행 내부 모바일 네비게이션을 공용 하단 탭 위로 올려 겹침 방지`
  },
  {
    id: 'admin1-memo-20260531-section-data-label-filter',
    content: `# 2026-05-31 섹션별 실제 데이터와 메모 라벨링

- [x] 메모를 general, travel, work, study, fitness planType과 labels로 정규화
- [x] 홈 모드별 최근 메모와 메모 카운트가 해당 planType 데이터만 보이도록 필터링
- [x] 메모 목록 tag에 개인, 여행, 업무, 공부, 운동 라벨을 표시
- [x] 여행 계획 생성 메모에는 travel planType과 labels를 저장`
  },
  {
    id: 'admin1-memo-20260531-workspace-plan-mode-selector',
    content: `# 2026-05-31 개인 워크스페이스 Plan 모드 선택

- [x] /app 기본 정체성을 개인 워크스페이스 / AI 일정 도우미로 변경
- [x] 상단에서 개인, 여행, 업무, 공부, 운동 Plan 모드를 선택하고 실제 카운트를 표시
- [x] 기본 모드 빠른 실행은 메모 작성, 일정 추가, 할 일 추가, AI 정리로 구성
- [x] travel 모드는 여행 메모, 코스 만들기, 장소 찾기, 체크리스트로 분리
- [x] 하단 탭을 홈 / 메모 / 일정 / 계획 구조로 변경`
  },
  {
    id: 'admin1-memo-20260531-app-home-plan-or-today-section',
    content: `# 2026-05-31 앱 홈 기본 섹션 자동 전환

- [x] 저장된 여행 코스 메모가 있으면 /app 기본 섹션에서 여행지 1~3번을 코스 순서대로 표시
- [x] 저장 코스가 없으면 같은 위치에서 오늘 일정 개수, 완료 수, 달성률을 표시
- [x] 여행 코스 메모와 오늘 일정 모두 모바일 한 줄 카드에서 겹치지 않도록 스타일 보정`
  },
  {
    id: 'admin1-memo-20260531-app-home-17png-default-api-key',
    content: `# 2026-05-31 17.png 기준 여행 대시보드와 기본 API 키 적용

- [x] /app 메인을 오늘의 여행 일정, 빠른 실행, 여행 메모, AI 추천, 여행 준비 현황 흐름으로 재구성
- [x] Guest 시작 기본 이동을 /planner로 변경
- [x] 여행 계획 생성이 서버 기본 APP_OPENAI_API_KEY 또는 OPENAI_API_KEY를 먼저 사용하게 변경
- [x] 기본 키 오류 문구와 제품 방향 문서를 여행 계획 앱 기준으로 갱신`
  },
  {
    id: 'admin1-memo-20260531-app-home-16png-travel-identity',
    content: `# 2026-05-31 16.png 기준 여행 코스 홈 정체성 강화

- [x] /app 상단 브랜드를 여행 코스 / AI 여행 플래너로 변경
- [x] 히어로와 인사 카드를 여행 메모, 일정, 코스 준비 흐름으로 수정
- [x] 주요 기능을 메모, 일정, 여행 코스, 장소 찾기 4개 카드로 확장
- [x] 일정, 진행도, AI 추천 배너 문구를 여행 준비 기준으로 보정`
  },
  {
    id: 'admin1-memo-20260531-travel-planner-user-key-tabs',
    content: `# 2026-05-31 여행 계획 생성과 모바일 탭 정리

- [x] 여행 계획 생성이 로그인 사용자 키를 먼저 쓰고 없으면 admin1 OpenAI 키를 쓰도록 정리
- [x] OpenAI 키/API 오류가 fallback 일정으로 숨지 않고 사용자에게 보이게 보정
- [x] 플래너에 인원, 식사, 휴식, 하루 시작/종료, 꼭 반영할 것, 피할 것 세부 옵션 추가
- [x] 모바일 하단 바로가기를 홈, 노트, 일정, 여행 4개로 변경
- [x] 상단 공통 네비게이션의 내 일정/메모/장소 찾기/연결 링크 제거`
  },
  {
    id: 'admin1-memo-20260531-app-home-15png-dashboard',
    content: `# 2026-05-31 15.png 기준 앱 홈 대시보드 개편

- [x] /app 메인 화면을 15.png 참고 이미지의 밝은 모바일 대시보드 구조로 재구성
- [x] 홈 JSX를 components/home/AppHome.jsx와 AppHomeSections.jsx로 분리
- [x] 오늘 일정, 주간 진행도, 메모/일정 카드, 여행 계획 CTA를 한 화면 흐름으로 정리
- [x] 기존 11.png용 컷툰 중심 홈 CSS를 새 대시보드 CSS로 교체`
  },
  {
    id: 'admin1-memo-20260531-mobile-home-nav-dedupe',
    content: `# 2026-05-31 모바일 홈 중복 네비게이션 제거

- [x] /app 본문 하단의 홈/메모/일정 중복 메뉴 제거
- [x] 메모와 오늘 일정만 빠른 실행 카드로 노출
- [x] /notes 모바일 상단은 계정, 메모 제목, 새 메모 버튼 구조로 유지`
  },
  {
    id: 'admin1-memo-20260531-mobile-ui-hotfix',
    content: `# 2026-05-31 모바일 UI/UX 긴급 보정

- [x] 공용 하단 탭을 기존 메모 액션바 CSS와 분리
- [x] /notes 모바일에서 상단 네비게이션이 다시 보이던 충돌을 제거
- [x] 메모봇 이미지 크기와 기능 카드 그리드를 모바일 폭에 맞게 고정
- [x] /notes, /scheduler 하단 탭 겹침 방지 여백 추가`
  },
  {
    id: 'admin1-memo-20260531-notion-workspace-accordion',
    content: `# 2026-05-31 Notion형 메모/일정 워크스페이스 정리

- [x] /notes 폴더 트리를 기본 접힘 accordion 구조로 변경
- [x] 선택 폴더의 메모만 중앙 목록에 표시하고 카드 정보를 제목, 요약, 날짜, 태그로 정리
- [x] 상세 상단에 제목, 일정 연결, 날짜, 시간, 공유, 삭제 액션을 정렬
- [x] 모바일 첫 화면을 메모봇, 주요 기능 카드, 접힘 가능한 노트/일정 섹션으로 정리`
  },
  {
    id: 'admin1-memo-20260530-notes-ui-nav-realign',
    content: `# 2026-05-30 메모 UI와 네비게이션 재정렬

- [x] /notes 어두운 Notion형 색감을 앱 홈/일정과 맞는 밝은 작업 화면 톤으로 보정
- [x] 모바일 메모에서 숨기던 공통 네비게이션을 다시 노출
- [x] 상단 네비게이션 4개 메뉴가 한 줄에 들어가도록 모바일 그리드 수정
- [x] 메모 빠른 메뉴와 하단 액션바를 공통 세그먼트 버튼 톤으로 정리`
  },
  {
    id: 'admin1-memo-20260530-home-shortcuts-unified',
    content: `# 2026-05-30 앱 홈 바로가기 통일

- [x] /app 하단 바로가기를 /notes 메모 홈의 홈/메모/일정 아이콘 버튼 구조와 맞춤
- [x] 연결은 제외하고 홈, 메모, 일정 3개 바로가기로 정리
- [x] 앱 홈과 메모 홈이 같은 WorkspaceQuickMenu 컴포넌트를 쓰도록 분리
- [x] 오늘/금주 일정 카드는 바로가기보다 낮은 보조 요약 카드 톤으로 보정`
  },
  {
    id: 'admin1-memo-20260530-notion-notes-localtrip-text-data',
    content: `# 2026-05-30 Notion형 메모와 장소 데이터 확장

- [x] /notes를 폴더 트리, 메모 목록, 블록 에디터 3단 구조로 개편
- [x] 모바일은 폴더, 메모 목록, 상세 작성 단계형 화면으로 분리
- [x] 모바일 메모 홈에 프로필, 홈/메모/일정 바로가기, 최근 항목 가로 카드, 내 워크스페이스 폴더 트리를 배치
- [x] 폴더/메모의 추가와 더보기 액션을 연결하고 하단 검색, AI 질문, 새 메모 fixed 액션바를 적용
- [x] /notes?board=...&block=... 진입과 폴더 선택, 메모 선택 라우팅을 보정
- [x] 기존 markdown content를 heading/paragraph/bullet/checklist/code/divider 블록으로 변환
- [x] 메모 일정 연결 bar를 유지하고 일정 연동 시 스케줄러에 반영
- [x] /app 하단 빠른 시작을 메모 개수 대신 오늘/금주 일정 진행률로 변경
- [x] 장소 찾기를 이미지 없는 텍스트형 데이터 카드로 변경
- [x] 여행 코스 생성 시 메모 보드와 일정에 함께 저장
- [x] admin1-batch 장소 데이터 109건을 이미지 없이 DB에 적재`
  },
  {
    id: 'admin1-memo-20260529-app-home-11png-reference',
    content: `# 2026-05-29 11.png 기준 앱 홈 메인 정리

- [x] /app 메인 화면을 11.png 참고 이미지처럼 세로형 모바일 홈으로 재배치
- [x] 상단 문구, 로봇 비주얼, Guest/Member 시작 패널, 로봇 안내, 하단 메모/일정 액션 순서로 정리
- [x] 기존 사이드형 기능 카드 대신 메모와 일정 중심의 빠른 시작 버튼을 배치
- [x] 로봇 안내 SVG를 부드러운 카드형 톤으로 교체`
  },
  {
    id: 'admin1-memo-20260529-vertical-robot-cuttoon-replace',
    content: `# 2026-05-29 앱 홈 로봇 컷툰 이미지 교체

- [x] /app 홈 로봇 안내 이미지를 세로형 모바일 컷툰 SVG로 교체
- [x] 한글 문구를 생성 이미지가 아니라 SVG 텍스트로 고정해 글자가 깨지지 않게 보정
- [x] 메모 작성, 일정 켜기, 내 일정 확인, 한눈에 관리 흐름이 한 화면에서 보이도록 정리
- [x] Guest/Member 시작 패널보다 컷툰 안내가 먼저 보이도록 앱 홈 렌더 순서 조정
- [x] 상단 인사 영역을 제거하고 1단계 컷부터 바로 보이게 조정`
  },
  {
    id: 'admin1-memo-20260529-memo-schedule-picker-cuttoon',
    content: `# 2026-05-29 메모 일정 선택과 로봇 컷툰 안내

- [x] 메모 작성창에 일정 항목을 추가하고 날짜/시간 선택으로 스케줄러에 연동
- [x] 스케줄러의 메모 연동 일정에서 원본 메모로 돌아가는 버튼 추가
- [x] 앱 홈 로봇 안내를 설명이 이미지 안에 들어간 컷툰형 자산으로 교체`
  },
  {
    id: 'admin1-memo-20260528-robot-guide-meme',
    content: `# 2026-05-28 앱 홈 로봇 가이드 이미지 추가

- [x] 생성형 이미지로 만든 로봇 안내 캐릭터를 앱 정적 자산으로 추가
- [x] /app 첫 화면에 로봇 말풍선형 사용 안내 카드를 배치
- [x] 메모, 일정, 프로젝트 보드 진입 버튼을 로봇 안내 카드에 연결
- [x] 프로젝트 카드에 날짜/시간 태그를 적으면 스케줄러 업무 일정으로 동기화`
  },
  {
    id: 'admin1-memo-20260528-scheduler-categories',
    content: `# 2026-05-28 스케줄러 카테고리 정리

- [x] 스케줄러 분류를 업무, 개인, 공부, 여행, 집안일 기준으로 정리
- [x] 기존 작업/회의/검토 분류는 업무로 보이도록 보정
- [x] 스케줄러 필터와 일정 추가 선택지를 같은 카테고리 기준으로 통일`
  },
  {
    id: 'admin1-memo-20260528-app-home-member-account-window',
    content: `# 2026-05-28 앱 홈 로그인 상태 시작 창 숨김

- [x] /app에서 회원 로그인 세션이면 Guest/Member 시작 창을 숨김
- [x] 회원 로그인 상태의 앱 홈 인사 문구를 현재 계정 이름 기준으로 표시
- [x] 게스트나 세션 없음 상태에서는 기존 Guest/Member 시작 흐름 유지`
  },
  {
    id: 'admin1-memo-20260527-auth-scheduler-user-scope',
    content: `# 2026-05-27 로그인과 사용자별 일정/메모 정리

- [x] /login과 /signup 기본 완료 이동을 /scheduler로 변경
- [x] 앱 홈 Guest 시작도 스케줄러로 이동하게 변경
- [x] 메모와 스케줄러 localStorage 키를 사용자별로 분리
- [x] 기존 전역 메모/일정 키는 현재 세션 사용자 키로 1회 이관
- [x] 회원가입과 비밀번호 변경은 8자 이상, 영문, 숫자, 특수문자 포함 규칙 적용`
  },
  {
    id: 'admin1-memo-20260527-notes-modal-edit-direct',
    content: `# 2026-05-27 메모 카드 편집 모달 단순화

- [x] 카드 클릭 시 읽기 전용 상세 모달 대신 작성/수정 모달로 바로 진입
- [x] 작성/미리보기 탭을 에디터 상단 전체 폭 세그먼트 탭으로 분리
- [x] 작성 탭에서만 서식 도구 바를 에디터 위에 표시
- [x] 제목 입력, 완료 버튼, 닫기 버튼 높이와 우측 여백 보정`
  },
  {
    id: 'admin1-memo-20260527-notes-checklist-modal-fix',
    content: `# 2026-05-27 메모 체크리스트 모달 렌더링 수정

- [x] 메모 보기 모달의 Markdown 체크박스 크기와 한 줄 정렬 보정
- [x] task-list 불릿을 제거하고 체크박스와 텍스트만 가로 정렬
- [x] 체크박스 툴은 raw Markdown 대신 체크리스트 편집 UI로 전환
- [x] 메모 작성/수정 모달에 작성/미리보기 탭 추가
- [x] 닫기 X 버튼 히트박스와 헤더 버튼 정렬 보강
- [x] 체크리스트 작성 행을 체크박스, 입력창, 삭제 버튼 한 줄로 고정
- [x] 체크리스트 상세는 Markdown 파서 대신 읽기 전용 체크리스트 컴포넌트로 렌더링`
  },
  {
    id: 'admin1-memo-20260527-port-80-default',
    content: `# 2026-05-27 Docker 웹 포트 80 고정

- [x] Docker web 컨테이너를 호스트 80/443 포트로 다시 매핑
- [x] 다음 Codex 세션이 18000으로 검증하지 않도록 AGENTS 지침 보강
- [x] README Docker 실행 예시를 WEB_HTTP_PORT=80 기준으로 수정
- [x] /app과 /notes를 포트 번호 없이 80에서 확인`
  },
  {
    id: 'admin1-memo-20260527-notes-ui-polish',
    content: `# 2026-05-27 메모 화면 탭과 모달 UI 정리

- [x] 공통 상단 메뉴를 세그먼트 컨트롤 형태로 보정
- [x] Guest 계정 영역의 로그인 링크 색상과 이동 표시 보강
- [x] 메모 보드 추가와 새 글 버튼의 점선 스타일을 실선/채움형으로 변경
- [x] 메모 보기/수정 창 헤더 정렬, 버튼 간격, 닫기 아이콘, 입력/툴바 크기 통일`
  },
  {
    id: 'admin1-memo-20260526-app-home-current-summary',
    content: `# 2026-05-26 앱 홈 현재 데이터 집계 보정

- [x] /app 홈 카드가 admin1 전용 집계가 아니라 현재 세션의 일정과 메모를 보도록 변경
- [x] 이전 전역 일정 저장소의 여행 코스 항목도 현재 사용자 일정 요약에 포함
- [x] 메모 카드는 프로젝트 작업이 아니라 실제 메모 보드 항목 수를 표시`
  },
  {
    id: 'admin1-memo-20260526-app-auth-pages',
    content: `# 2026-05-26 앱 전용 로그인/회원가입 분리

- [x] 앱 홈의 큰 첫 문구 제거
- [x] /login을 앱 전용 로그인 화면으로 분리
- [x] /signup을 별도 회원가입 화면으로 분리`
  },
  {
    id: 'admin1-memo-20260526-app-home-account-window',
    content: `# 2026-05-26 앱 홈 Guest/Member 시작 창 추가

- [x] 앱 홈 상단에 Guest와 Member 선택 창 추가
- [x] Guest는 게스트 세션 생성 후 메모 화면으로 진입
- [x] Member는 기존 로그인 화면으로 이동하도록 연결`
  },
  {
    id: 'admin1-memo-20260526-app-home-hero-copy',
    content: `# 2026-05-26 앱 홈 문구와 바로가기 정리

- [x] 앱 홈 첫 문구를 메모와 여행 계획 중심으로 변경
- [x] 메모부터 여행 계획까지 가볍게 정리하는 보조 문구 적용
- [x] 카드 액션과 중복되던 상단 바로가기 버튼 제거`
  },
  {
    id: 'admin1-memo-20260525-app-home-dashboard-cards',
    content: `# 2026-05-25 앱 홈 카드 모바일 정리

- [x] 앱 홈 카드의 큰 감성형 제목 제거
- [x] MEMO, SCHEDULE, TRIP 배지를 카드 기준 헤더로 정리
- [x] 각 카드에 현재 데이터 두 줄과 짧은 설명, 기존 액션 버튼만 남김
- [x] 연결 화면에서 메모 선택과 메모 진입 액션 제거`
  },
  {
    id: 'admin1-memo-20260525-connection-nav-restore',
    content: `# 2026-05-25 연결 메뉴 복구

- [x] 공통 상단 메뉴에 연결 탭 다시 노출
- [x] 여행 화면 서비스 이동 메뉴에 연결 링크 다시 노출
- [x] 일정 화면 하단 메모 연동 버튼은 제거 상태 유지
- [x] 앱 홈 메모 카드의 별도 연동 버튼은 제거 상태 유지`
  },
  {
    id: 'admin1-memo-20260525-nav-scheduler-trim',
    content: `# 2026-05-25 공통 메뉴와 일정 액션 정리

- [x] 공통 상단 메뉴에서 외부 데이터 진입 탭 제거
- [x] 앱 홈 메모 카드의 별도 데이터 진입 버튼 제거
- [x] 일정 화면 하단 액션은 일정 추가만 남김
- [x] 모바일 메모 보드 탭을 일반 문서 흐름에 놓아 프로필 영역과 겹치지 않게 조정`
  },
  {
    id: 'admin1-memo-20260525-notes-mobile-editor-window',
    content: `# 2026-05-25 메모 모바일 작성창 정리

- [x] 모바일 \`/notes\`에서 상단 메모 제목, 보드 선택, 새 메모 버튼 덩어리 숨김
- [x] 보드 탭 바로 아래 메모 목록이 먼저 보이도록 순서 정리
- [x] 보드 아래 \`+\` 버튼으로 새 글을 만들고 바로 작성창을 띄움
- [x] 메모 보기와 수정은 모바일에서 별도 창처럼 뜨게 보정
- [x] 삭제는 카드 우클릭 메뉴 중심으로 처리하고 모바일 작성창의 삭제 버튼 노출 제거`
  },
  {
    id: 'admin1-memo-20260525-notes-markdown-shortcuts',
    content: `# 2026-05-25 메모 Markdown 렌더링과 상단 바로가기 보정

- [x] \`/notes\` 상세 보기에서 \`react-markdown\`과 \`remark-gfm\` 기준 체크박스 렌더링 보강
- [x] 수정 화면에 굵게, 체크, 목록을 넣는 간단한 Markdown 툴바 추가
- [x] textarea 폰트, 줄간격, 여백을 모바일 입력 기준으로 정리
- [x] 모바일 상단 바로가기를 가로 스크롤 탭으로 복구
- [x] 현재 보드가 아닌 작업 카드 제목이 상세 상단에 크게 뜨는 선택 로직 보정`
  },
  {
    id: 'admin1-memo-20260525-notes-mobile-simple',
    content: `# 2026-05-25 메모 모바일 UI 단순화

- [x] \`/notes\` 상단 breadcrumb, 상태 플로팅 카드, 보드 선택 안내 문구 제거
- [x] 모바일에서 워크스페이스 내비게이션과 드래그 핸들을 숨기고 메모 카드를 리스트형으로 고정
- [x] 편집 중 미리보기 패널을 숨겨 입력 공간 확대
- [x] 마지막 CSS override 파일로 메모 화면 스타일 우선순위 정리

## 다음 확인

- [ ] 휴대폰에서 보드 선택, 새 메모, 수정, 삭제 버튼 겹침 여부 확인`
  },
  {
    id: 'admin1-memo-20260525-trip-detail-actions',
    content: `# 2026-05-25 AI Trip 일정 상세 액션과 하루 흐름 요약

- [x] \`/plans/{id}\` 상세 상단에 일자별 출발지, 도착지, 식사/카페 횟수, 이동 팁을 요약하는 하루 흐름 영역 추가
- [x] 상세 액션 바에 수정, 다시 만들기, 스케줄 저장, 내보내기, 공유, 삭제 버튼 추가
- [x] 수정/다시 만들기에서 현재 코스 정보를 플래너 초안으로 넘겨 이어서 조정 가능하게 변경
- [x] 체크리스트와 변경 로그에 AI Trip 상세 UX 작업 완료 기록 반영

## 다음 확인

- [ ] 모바일에서 \`/plans/{id}\` 액션 바가 두 줄 안에서 겹치지 않는지 확인
- [ ] 플래너 초안으로 넘어간 뒤 지역/장소 후보가 실제 저장 코스와 충분히 가깝게 잡히는지 확인`
  },
  {
    id: 'admin1-memo-20260525-mobile-memo-trip-direction',
    content: `# 2026-05-25 모바일 메모 UX와 제품 방향 재정리

- [x] 메모 보드 카드 제목은 기본 읽기 상태로 두고 더블클릭 때만 제목 입력을 열도록 변경
- [x] 선택한 메모 본문은 기본 미리보기로 보여주고 더블클릭 또는 수정 버튼에서만 편집 모드로 전환
- [x] 모바일에서 메모 보드가 절대 배치 캔버스가 아니라 세로 카드 리스트처럼 보이도록 CSS 보정
- [x] AI Trip 플래너에서 전체 출발지와 최종 목적지 입력을 제거하고 일자별 출발지/도착지만 남김
- [x] 앱 방향을 완성형 AI 비서가 아니라 모바일 우선 메모/일정 앱, 점진적 API 연결 흐름으로 README와 체크리스트에 반영

## 다음 확인

- [ ] 핸드폰에서 \`/notes\` 메모 작성, 수정, 삭제, 보드 전환 터치감 확인
- [ ] \`/planner\` 일자별 출발지/도착지 입력이 충분히 단순한지 확인
- [ ] 날씨, 내 위치 주변 여행지, 주변 식당/카페 API 연결 우선순위 정하기`
  },
  {
    id: 'admin1-memo-20260524-apps-route-alias',
    content: `# 2026-05-24 /apps 앱 홈 라우트 보정

- [x] \`/apps\`로 들어와도 여행 NotFound 화면 대신 \`/app\` 앱 홈으로 이동
- [x] Nginx에서도 \`/\`, \`/apps\`, \`/connections\`를 각각 기준 경로로 리다이렉트
- [x] React 라우터에도 같은 별칭 처리를 남겨 정적 fallback 상황을 보강
- [x] Docker web/API 재배포 후 공개 URL에서 \`/apps\`, \`/app\`, API 응답 확인

## 검증

- [x] \`npm --prefix apps/web run build\`
- [x] \`docker compose -f docker-compose.dev.yml up -d --build api web\`
- [x] \`/apps\` 확인`
  },
  {
    id: 'admin1-memo-20260524-web-copy-visual-refresh',
    content: `# 2026-05-24 웹 문구와 비주얼 리프레시

- [x] \`/app\`, \`/portfolio\`, \`/connect\`, 여행 화면의 핵심 문구를 더 짧고 선명하게 정리
- [x] Wikimedia Commons CC0 사진을 배경/비주얼 자산으로 교체
- [x] 버튼과 카드 아이콘 톤을 더 앱처럼 보이게 조정
- [x] 모바일 반응형에서 첫 화면 문구와 주요 액션이 먼저 보이도록 점검

## 검증

- [ ] \`npm --prefix apps/web run build\`
- [ ] Docker web/API 재배포 후 주요 URL 확인`
  },
  {
    id: 'admin1-memo-20260523-planner-generate-status',
    content: `# 2026-05-23 플래너 생성 상태 메시지 개선

- [x] \`/planner\` 일정 생성 중 진행 카드를 추가
- [x] 장소 후보 확인, 시간표 구성, 일정 저장 단계를 안내
- [x] 실패 시 API 키 필요/서버 지연 메시지를 사용자용 문장으로 정리
- [x] 실패 후 입력값 유지와 다시 생성 흐름 유지

## 검증

- [x] \`npm --prefix apps/web run build\`
- [x] Docker web 재배포 후 \`/planner\` 확인`
  },
  {
    id: 'admin1-memo-20260523-planner-connect-simple',
    content: `# 2026-05-23 플래너와 연결 화면 단순화

- [x] \`/planner\` 날짜·동선 입력을 클릭형 보강 카드로 정리
- [x] 주소, 시간, 일자별 동선은 선택 입력으로 낮추고 출발일/일수만으로 다음 단계 이동
- [x] \`/connect\` 기본 화면을 이메일/문자 2개 선택지로 단순화
- [x] API 서버와 OpenAI 키 입력은 고급 설정으로 접기

## 검증

- [x] \`npm --prefix apps/web run build\`
- [x] Docker web 재배포 후 \`/planner\`, \`/connect\` 확인`
  },
  {
    id: 'admin1-memo-20260523-ai-assistant-app-apk',
    content: `# 2026-05-23 ai-assistant 앱 라우트와 PWA 정리

- [x] 앱 이름, PWA manifest, Docker image를 \`ai-assistant\` 기준으로 정리
- [x] 기본 앱 라우트를 \`/app\`으로 고정하고 \`/\`은 \`/app\`으로 이동
- [x] 모바일 홈을 일정, 메모, 여행, 연결 진입 중심으로 통일
- [x] Docker API/Web 재빌드 및 배포 확인

## 검증

- [x] \`npm --prefix apps/web run build\`
- [x] \`docker compose -f docker-compose.dev.yml up -d --build api web\`
- [x] \`curl http://127.0.0.1/app\`
- [x] \`curl http://127.0.0.1/manifest.webmanifest\`
- [x] \`curl http://127.0.0.1/api/destinations?size=1\``
  },
  {
    id: 'admin1-memo-20260523-portfolio-app-pwa',
    content: `# 2026-05-23 포트폴리오 웹과 개인 비서 앱 분리

- [x] 공개 루트는 포트폴리오 웹으로 둔다
- [x] 실제 개인 AI 비서 홈은 \`/app\`으로 분리한다
- [x] 기존 일정, 노트, 여행 추천 경로는 유지한다
- [x] PWA manifest, 앱 아이콘, service worker 기반을 추가한다

## 다음 점검

- [ ] Docker web 재빌드 후 \`/\`, \`/app\`, \`/scheduler\`, \`/notes\`, \`/destinations\` 진입 확인
- [ ] 모바일 Chrome에서 홈 화면 추가가 노출되는지 확인
- [ ] 포트폴리오 문구와 실제 공개 링크를 배포 전 최종 조정`
  },
  {
    id: 'admin1-memo-20260521-notes-login-css-docs',
    content: `# 2026-05-21 노트/로그인/CSS/문서 정리

- [x] 보드 선택 화면의 장문 안내 문구 제거
- [x] 보드 추가 버튼을 상단 액션 중심으로 정리
- [x] 메모 삭제 후 다음 메모 선택 또는 빈 상태 표시
- [x] 로그인 버튼은 로그인 화면으로 이동하고 성공 후 원래 경로로 복귀
- [x] CSS를 기능별 파일로 분리
- [x] Docker 전용 문서로 정리하고 Kubernetes 파일 제거
- [x] DB mount는 \`mariadb_data:/var/lib/mysql\` 유지 확인

## 다음 점검

- [ ] 모바일에서 줄 단위 Markdown 편집 터치감 확인
- [ ] 보드/메모 삭제 흐름의 확인 메시지와 빈 상태 문구 다듬기
- [ ] LocalTrip/Workspace 네비게이션 스타일 중복을 별도 navigation override 파일로 추가 정리`
  }
];

function canDeleteMemoBoard(board) {
  return Boolean(board && !DEFAULT_MEMO_BOARD_ID_SET.has(board.id));
}

function BoardIcon({ type }) {
  const paths = {
    share: (
      <>
        <path d="M7 12l10-7" />
        <path d="M7 12l10 7" />
        <circle cx="5" cy="12" r="2.4" />
        <circle cx="18" cy="5" r="2.4" />
        <circle cx="18" cy="19" r="2.4" />
      </>
    ),
    comments: (
      <>
        <path d="M5 6.5h14v9H9l-4 3v-12z" />
        <path d="M8.5 10h7" />
        <path d="M8.5 13h4.5" />
      </>
    ),
    star: (
      <path d="M12 4.5l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7L12 4.5z" />
    ),
    bell: (
      <>
        <path d="M7 10.8a5 5 0 0110 0c0 3 1.2 4.2 2 5.2H5c.8-1 2-2.2 2-5.2z" />
        <path d="M10 18.3a2.2 2.2 0 004 0" />
      </>
    )
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[type]}
    </svg>
  );
}

function WorkspaceNavigator({ navigate }) {
  const session = readStoredAuth();
  const isGuest = !session || session.isGuest || session.username === 'guestuser';
  const accountPath = isGuest ? loginUrlForCurrentLocation('/app') : '/mypage';
  const displayName = isGuest ? 'Guest' : session.username;

  return (
    <nav className="workspaceNavigator" aria-label="workspace navigator">
      <button type="button" className="workspaceNavigatorBrand" onClick={() => navigate(APP_SHORTCUTS.mainHub.path)}>
        <MemoNavIcon type="home" />
        <span>앱 홈</span>
      </button>
      <a
        className="workspaceNavigatorAccount"
        href={accountPath}
        onClick={(event) => {
          event.preventDefault();
          if (isGuest) {
            redirectToLogin('/app');
            return;
          }
          navigate(accountPath);
        }}
      >
        <span>{displayName.slice(0, 1).toUpperCase()}</span>
        <strong>{displayName}</strong>
        <small>{isGuest ? '로그인' : '내 정보'}</small>
      </a>
    </nav>
  );
}

function mobileProfileForRoute(navigate, fallbackPath = '/app') {
  const session = readStoredAuth();
  const isGuest = !session || session.isGuest || session.username === 'guestuser';
  const displayName = isGuest ? 'Guest' : session.username || 'Member';

  return {
    name: displayName,
    label: isGuest ? '로그인' : '내 정보',
    onClick: () => {
      if (isGuest) {
        redirectToLogin(fallbackPath);
        return;
      }
      navigate('/mypage');
    }
  };
}

function noteBlockFilePath(block) {
  if (block.filePath) return block.filePath;
  return `memo-files/${block.id}.md`;
}

function noteBlockFileContent(block) {
  const title = noteBlockTitle(block);
  if (block.type === 'file') {
    return `# ${title}\n\n`;
  }
  return memoContentFromTitleAndBlocks(title, block?.blocks || markdownToMemoEditorBlocks(noteBlockBody(block)));
}

function workspaceMemoId(path) {
  return `workspace-${String(path || 'memo').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

function workspaceMemoFolderId(path) {
  const relative = String(path || '').replace(/^memo-files\/?/, '');
  const [firstSegment] = relative.split('/');
  if (!firstSegment || /\.[a-z0-9]+$/i.test(firstSegment)) return 'personal';
  return normalizeMemoFolderId(firstSegment);
}

function workspaceMemoBlockFromFile(path, content, index = 0) {
  const timestamp = memoTimestamp();
  return normalizeNoteBlock({
    id: workspaceMemoId(path),
    type: path.toLowerCase().endsWith('.txt') ? 'file' : 'text',
    content: content || '# 새 메모\n',
    sector: workspaceMemoFolderId(path),
    boardId: workspaceMemoFolderId(path),
    status: 'todo',
    parentId: '',
    filePath: path,
    sortOrder: index,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function loadWorkspaceMemoBlocks(token, path = 'memo-files', depth = 0) {
  if (!token || depth > 4) return [];
  let tree = null;
  try {
    tree = await requestJson(`/api/workspace/tree?path=${encodeURIComponent(path)}`, {
      headers: authHeaders(token)
    });
  } catch {
    return [];
  }

  const entries = Array.isArray(tree?.entries) ? tree.entries : [];
  const loaded = await Promise.all(entries.map(async (entry, index) => {
    if (entry?.type === 'dir') {
      return loadWorkspaceMemoBlocks(token, entry.path, depth + 1);
    }
    if (entry?.type !== 'file' || !/\.(md|txt)$/i.test(entry.name || entry.path || '')) {
      return [];
    }
    try {
      const content = await requestText(`/api/workspace/file?path=${encodeURIComponent(entry.path)}`, token);
      return [workspaceMemoBlockFromFile(entry.path, content, index)];
    } catch {
      return [];
    }
  }));

  return loaded.flat().slice(0, 200);
}

function mergeNoteBlocks(current, incoming) {
  const currentNotes = Array.isArray(current) ? current : [];
  const incomingNotes = Array.isArray(incoming) ? incoming : [];
  return mergeStorageArrays(currentNotes, incomingNotes).map(normalizeNoteBlock);
}

function checklistStatsForBlocks(blocks) {
  return blocks.reduce((stats, block) => {
    const checks = `${block.content || ''}`.match(/^\s*[-*]\s+\[[ xX]\]\s+/gm) || [];
    const done = checks.filter((line) => /^\s*[-*]\s+\[[xX]\]\s+/.test(line)).length;
    return {
      total: stats.total + checks.length,
      done: stats.done + done
    };
  }, { total: 0, done: 0 });
}

function textAfterMarkdownLabel(content, label) {
  const match = `${content || ''}`.match(new RegExp(`^\\s*[-*]\\s+${label}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim() || '';
}

function parseTravelPlanPlaceLine(line, index = 0) {
  const parsed = parseChecklistLine(line);
  if (!parsed?.text) return null;
  const match = parsed.text.match(/^(([01]\d|2[0-3]):[0-5]\d)(?:\s*[-~]\s*(([01]\d|2[0-3]):[0-5]\d))?\s+(.+)$/);
  if (!match) return null;
  const time = match[3] ? `${match[1]}-${match[3]}` : match[1];
  const parts = match[5].split(/\s+·\s+/).map((part) => part.trim()).filter(Boolean);
  const title = parts.shift() || '여행지';
  const category = parts.find((part) => !part.includes(':')) || '';
  const place = parts.find((part) => part.startsWith('장소:'))?.replace(/^장소:\s*/, '') || '';
  const move = parts.find((part) => part.startsWith('이동:'))?.replace(/^이동:\s*/, '') || '';
  const meta = [time, place || category, move ? `이동 ${move}` : ''].filter(Boolean).join(' · ');
  return {
    id: `travel-place-${index}-${title}`,
    order: index + 1,
    title: plainMarkdownText(title),
    tag: category || '여행지',
    meta,
    time,
    done: Boolean(parsed.checked)
  };
}

function travelPlanPreviewFromBlocks(blocks, todayKey) {
  const candidates = blocks
    .filter((block) => `${block.id || ''}`.startsWith('travel-plan-memo-') || `${block.boardId || block.folderId || ''}`.startsWith('travel-plan-board-'))
    .map((block) => {
      const lines = `${block.content || ''}`.split('\n');
      const places = lines.map(parseTravelPlanPlaceLine).filter(Boolean);
      if (!places.length) return null;
      const scheduleDate = isDateKey(block.schedule?.date) ? block.schedule.date : '';
      const daysUntil = scheduleDate ? diffDays(todayKey, scheduleDate) : 9999;
      const totalCount = places.length;
      const doneCount = places.filter((place) => place.done).length;
      const region = textAfterMarkdownLabel(block.content, '지역');
      const period = textAfterMarkdownLabel(block.content, '기간');
      const start = textAfterMarkdownLabel(block.content, '시작');
      const boardId = block.boardId || block.folderId || block.sector || 'travel';
      return {
        title: noteBlockTitle(block),
        subtitle: [region, period].filter(Boolean).join(' · ') || start || '저장된 여행 코스',
        date: scheduleDate,
        dateLabel: scheduleDate ? formatDateLabel(scheduleDate) : '',
        dDayLabel: scheduleDate
          ? daysUntil > 0
            ? `D-${daysUntil}`
            : daysUntil === 0
              ? 'D-Day'
              : '여행 중'
          : '코스',
        progress: totalCount ? Math.round((doneCount / totalCount) * 100) : 0,
        doneCount,
        totalCount,
        items: places.slice(0, 3),
        notePath: `/notes?board=${encodeURIComponent(boardId)}&block=${encodeURIComponent(block.id)}`,
        sortDate: scheduleDate || '9999-12-31',
        updatedAt: block.updatedAt || block.createdAt || ''
      };
    })
    .filter(Boolean);

  if (!candidates.length) return null;
  return candidates.sort((left, right) => {
    const leftPast = left.sortDate < todayKey ? 1 : 0;
    const rightPast = right.sortDate < todayKey ? 1 : 0;
    if (leftPast !== rightPast) return leftPast - rightPast;
    const dateOrder = left.sortDate.localeCompare(right.sortDate);
    if (dateOrder) return dateOrder;
    return `${right.updatedAt}`.localeCompare(`${left.updatedAt}`);
  })[0];
}

function schedulerItemMatchesPlanMode(item, mode) {
  const normalizedMode = normalizeHomePlanMode(mode);
  const type = normalizeSchedulerType(item?.type);
  const source = `${item?.source || ''} ${item?.id || ''} ${item?.title || ''} ${item?.memo || ''}`.toLowerCase();
  const isTravel = item?.source === 'travel-plan'
    || `${item?.id || ''}`.startsWith('travel-plan-')
    || type === '여행'
    || source.includes('travel')
    || source.includes('trip')
    || source.includes('여행')
    || source.includes('코스')
    || source.includes('숙소');
  if (normalizedMode === 'travel') return isTravel;
  return !isTravel;
}

function schedulerPreviewItemsForMode(items, mode) {
  return items
    .filter((item) => schedulerItemMatchesPlanMode(item, mode))
    .slice()
    .sort((left, right) => schedulerSortKey(left, true).localeCompare(schedulerSortKey(right, true)))
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title || '제목 없는 일정',
      time: schedulerTimeValue(item),
      date: item.date || '',
      type: schedulerDisplayType(item),
      done: Boolean(item.done)
    }));
}

function homeScheduleItemFromExpanded(item, extras = {}) {
  return {
    id: item.id,
    scheduleId: schedulerSourceRecordId(item),
    sourceId: item.sourceId || item.id,
    title: item.title || '제목 없는 일정',
    time: schedulerTimeValue(item),
    date: item.date || '',
    type: schedulerDisplayType(item),
    memo: item.memo || '',
    done: Boolean(item.done),
    recurring: Boolean(item.recurring),
    recurrenceLabel: item.recurrenceLabel || '',
    ...extras
  };
}

function schedulerStatsForMode(items, mode) {
  const matched = items.filter((item) => schedulerItemMatchesPlanMode(item, mode));
  const done = matched.filter((item) => item.done).length;
  return {
    total: matched.length,
    done,
    progress: matched.length ? Math.round((done / matched.length) * 100) : 0
  };
}

function memoBlockMatchesPlanMode(block, mode) {
  const normalizedMode = normalizeHomePlanMode(mode);
  return normalizeHomePlanMode(block?.planType) === normalizedMode;
}

function memoCountsByModeFromBlocks(blocks) {
  return HOME_PLAN_MODES.reduce((counts, mode) => ({
    ...counts,
    [mode]: blocks.filter((block) => memoBlockMatchesPlanMode(block, mode)).length
  }), {});
}

function recentMemoItemsFromBlocks(blocks, mode = 'personal') {
  const normalizedMode = normalizeHomePlanMode(mode);
  return blocks
    .filter((block) => memoBlockMatchesPlanMode(block, normalizedMode))
    .slice()
    .sort((left, right) => `${right.updatedAt || right.createdAt || ''}`.localeCompare(`${left.updatedAt || left.createdAt || ''}`))
    .slice(0, 3)
    .map((block) => {
      const boardId = block.boardId || block.folderId || block.sector || 'memo';
      const plain = plainMarkdownText(block.content || '');
      const lines = plain.split('\n').map((line) => line.trim()).filter(Boolean);
      const title = noteBlockTitle(block);
      const summary = lines.find((line) => line !== title) || '메모를 열어 내용을 정리하세요.';
      return {
        id: block.id,
        title,
        summary,
        label: labelsForPlanType(block.planType)[1],
        planType: block.planType,
        labels: block.labels || [],
        updatedAt: block.updatedAt || block.createdAt || '',
        path: `/notes?board=${encodeURIComponent(boardId)}&block=${encodeURIComponent(block.id)}`
      };
    });
}

function summarizeAppActivity() {
  const session = readStoredAuth();
  const schedulerItems = readCurrentSchedulerItems(session);
  const today = toDateKey(new Date());
  const weekDays = buildWeekDays(today);
  const weekDateKeys = weekDays.map((day) => day.key);
  const weekDayLabelByDate = weekDays.reduce((labels, day) => ({ ...labels, [day.key]: day.weekday }), {});
  const expandedWeekItems = expandSchedulerItemsForDates(schedulerItems, weekDateKeys);
  const todayItems = expandedWeekItems.filter((item) => item.date === today);
  const todayPreviewItems = todayItems
    .slice()
    .sort((left, right) => schedulerSortKey(left).localeCompare(schedulerSortKey(right)))
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title || '제목 없는 일정',
      time: schedulerTimeValue(item),
      type: schedulerDisplayType(item),
      done: Boolean(item.done)
    }));
  const todayDoneItems = todayItems.filter((item) => item.done);
  const personalTodayItems = todayItems.filter((item) => schedulerItemMatchesPlanMode(item, 'personal'));
  const personalTodayDoneItems = personalTodayItems.filter((item) => item.done);
  const personalTodayPreviewItems = personalTodayItems
    .slice()
    .sort((left, right) => schedulerSortKey(left).localeCompare(schedulerSortKey(right)))
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      title: item.title || '제목 없는 일정',
      time: schedulerTimeValue(item),
      type: schedulerDisplayType(item),
      done: Boolean(item.done)
    }));
  const personalTodayScheduleItems = personalTodayItems
    .slice()
    .sort((left, right) => schedulerSortKey(left).localeCompare(schedulerSortKey(right)))
    .map((item) => homeScheduleItemFromExpanded(item, {
      weekday: weekDayLabelByDate[item.date] || '',
      dateLabel: formatDateLabel(item.date)
    }));
  const weekDoneItems = expandedWeekItems.filter((item) => item.done);
  const pendingWeekItems = expandedWeekItems.filter((item) => !item.done);
  const personalWeekItems = expandedWeekItems
    .filter((item) => schedulerItemMatchesPlanMode(item, 'personal'))
    .slice()
    .sort((left, right) => schedulerSortKey(left, true).localeCompare(schedulerSortKey(right, true)))
    .map((item) => homeScheduleItemFromExpanded(item, {
      weekday: weekDayLabelByDate[item.date] || '',
      dateLabel: formatDateLabel(item.date)
    }));
  const personalWeekDoneItems = personalWeekItems.filter((item) => item.done);
  const nextSchedule = pendingWeekItems
    .slice()
    .sort((left, right) => schedulerSortKey(left, true).localeCompare(schedulerSortKey(right, true)))[0];
  const travelScheduleItems = schedulerItems.filter((item) => item.source === 'travel-plan' || `${item.id || ''}`.startsWith('travel-plan-'));

  const boards = readMemoBoards();
  const blocks = readNoteBlocks();
  const travelPlanPreview = travelPlanPreviewFromBlocks(blocks, today);
  const adminSeedBlocks = blocks.filter((block) => `${block.id || ''}`.startsWith('admin1-goal-'));
  const projectBlocks = blocks.filter((block) => (block.boardId || block.sector) === 'project');
  const memoBoards = boards.filter((board) => board.id !== 'project');
  const memoBlocks = blocks.filter((block) => (block.boardId || block.sector) !== 'project');
  const memoCountsByMode = memoCountsByModeFromBlocks(memoBlocks);
  const recentMemoItems = HOME_PLAN_MODES.reduce((grouped, mode) => ({
    ...grouped,
    [mode]: recentMemoItemsFromBlocks(memoBlocks, mode)
  }), {});
  const seededChecklist = checklistStatsForBlocks(adminSeedBlocks);
  const expectedChecklistTotal = ADMIN1_BOARD_TASKS.length * 2;
  const checklistTotal = Math.max(seededChecklist.total, expectedChecklistTotal);
  const checklistDone = seededChecklist.done;
  const travelPlanBlocks = blocks.filter((block) => `${block.id || ''}`.startsWith('travel-plan-memo-'));
  const modeStats = {
    personal: {
      total: personalTodayItems.length,
      done: personalTodayDoneItems.length,
      progress: personalTodayItems.length
        ? Math.round((personalTodayDoneItems.length / personalTodayItems.length) * 100)
        : 0
    },
    travel: schedulerStatsForMode(schedulerItems, 'travel')
  };
  const planTypeCounts = {
    personal: modeStats.personal.total + (memoCountsByMode.personal || 0),
    travel: modeStats.travel.total + (memoCountsByMode.travel || 0)
  };
  const modePreviewItems = {
    personal: personalTodayPreviewItems,
    travel: schedulerPreviewItemsForMode(expandedWeekItems, 'travel')
  };
  const statusCounts = PROJECT_BOARD_COLUMNS.reduce((counts, column) => ({
    ...counts,
    [column.id]: projectBlocks.filter((block) => block.status === column.id).length
  }), {});

  return {
    todayCount: todayItems.length,
    todayDoneCount: todayDoneItems.length,
    todayProgress: todayItems.length ? Math.round((todayDoneItems.length / todayItems.length) * 100) : 0,
    todayPreviewItems,
    weekCount: expandedWeekItems.length,
    weekDoneCount: weekDoneItems.length,
    weekProgress: expandedWeekItems.length ? Math.round((weekDoneItems.length / expandedWeekItems.length) * 100) : 0,
    weekPendingCount: pendingWeekItems.length,
    personalTodayItems: personalTodayScheduleItems,
    personalTodayCount: personalTodayScheduleItems.length,
    personalTodayDoneCount: personalTodayDoneItems.length,
    personalTodayProgress: personalTodayScheduleItems.length ? Math.round((personalTodayDoneItems.length / personalTodayScheduleItems.length) * 100) : 0,
    personalWeekItems,
    personalWeekCount: personalWeekItems.length,
    personalWeekDoneCount: personalWeekDoneItems.length,
    personalWeekProgress: personalWeekItems.length ? Math.round((personalWeekDoneItems.length / personalWeekItems.length) * 100) : 0,
    nextSchedule,
    travelPlanPreview,
    modeStats,
    modePreviewItems,
    planTypeCounts,
    memoCountsByMode,
    recentMemoItems,
    travelPlanCount: travelPlanBlocks.length,
    totalScheduleCount: schedulerItems.length,
    travelScheduleCount: travelScheduleItems.length,
    boardCount: memoBoards.length,
    noteCount: memoBlocks.length,
    memoCount: memoBlocks.length,
    adminGoalCount: Math.max(adminSeedBlocks.length, ADMIN1_BOARD_TASKS.length),
    checklistDone,
    checklistTotal,
    statusCounts
  };
}

const EMPTY_APP_OVERVIEW = {
  todayCount: 0,
  todayDoneCount: 0,
  todayProgress: 0,
  todayPreviewItems: [],
  weekCount: 0,
  weekDoneCount: 0,
  weekProgress: 0,
  weekPendingCount: 0,
  personalTodayItems: [],
  personalTodayCount: 0,
  personalTodayDoneCount: 0,
  personalTodayProgress: 0,
  personalWeekItems: [],
  personalWeekCount: 0,
  personalWeekDoneCount: 0,
  personalWeekProgress: 0,
  nextSchedule: null,
  travelPlanPreview: null,
  modeStats: {},
  modePreviewItems: {},
  planTypeCounts: {},
  memoCountsByMode: {},
  recentMemoItems: {},
  totalScheduleCount: 0,
  travelScheduleCount: 0,
  boardCount: 0,
  noteCount: 0,
  memoCount: 0,
  adminGoalCount: 0,
  checklistDone: 0,
  checklistTotal: 0,
  statusCounts: {}
};

function PortfolioHomePage({ navigate }) {
  useEffect(() => {
    document.title = 'ai-assistant Portfolio';
  }, []);

  const portfolioLinks = [
    {
      title: '개인 메모 앱',
      detail: '메모와 일정을 한 화면에서 이어 쓰는 모바일 앱',
      action: '앱 시작',
      path: '/app',
      tone: 'assistant',
      icon: 'spark'
    },
    {
      title: '여행 코스 만들기',
      detail: '갈 곳을 고르면 움직이기 쉬운 하루 동선으로 정리',
      action: '장소 찾기',
      path: '/destinations',
      tone: 'travel',
      icon: 'trip'
    },
    {
      title: '운영 워크스페이스',
      detail: '파일, 리소스, 작업 로그를 운영 기준으로 확인하는 관리자 공간',
      action: '관리 보기',
      path: '/analysisadmin',
      tone: 'workspace',
      icon: 'shield'
    }
  ];

  return (
    <main className="portfolioHome">
      <nav className="portfolioNav" aria-label="portfolio navigation">
        <button type="button" className="portfolioBrand" onClick={() => navigate('/portfolio')}>
          <span>A</span>
          <strong>ai-assistant</strong>
        </button>
        <div>
          <button type="button" onClick={() => navigate('/app')}>앱 홈</button>
          <button type="button" onClick={() => navigate('/destinations')}>여행</button>
          <button type="button" onClick={() => navigate('/analysisadmin')}>운영</button>
        </div>
      </nav>
      <section className="portfolioHero">
        <div className="portfolioHeroCopy">
          <span className="portfolioEyebrow">Personal AI Workspace</span>
          <h1>메모, 일정, 여행을 한곳에</h1>
          <p>
            적어둔 생각을 일정으로 옮기고, 여행 코스까지 이어서 관리하는 개인 앱입니다.
            공개 포트폴리오와 실제 앱 화면을 분리해 바로 써볼 수 있게 만들었습니다.
          </p>
          <div className="portfolioHeroActions">
            <button type="button" onClick={() => navigate('/app')}><MemoNavIcon type="spark" />앱 시작</button>
            <button type="button" onClick={() => navigate('/destinations')}><MemoNavIcon type="trip" />장소 찾기</button>
          </div>
        </div>
        <div className="portfolioDevice" aria-label="app preview">
          <div className="portfolioDeviceTop">
            <span />
            <strong>오늘의 흐름</strong>
            <small>AI Assistant</small>
          </div>
          <div className="portfolioDevicePhoto">
            <span>메모에서 일정까지</span>
          </div>
          <div className="portfolioPreviewGrid">
            <article>
              <span>일정</span>
              <strong>3</strong>
              <small>오늘 처리할 일</small>
            </article>
            <article>
              <span>메모</span>
              <strong>12</strong>
              <small>메모 보드</small>
            </article>
            <article>
              <span>계획</span>
              <strong>AI</strong>
              <small>타입별 정리</small>
            </article>
          </div>
          <div className="portfolioPreviewList">
            <span>09:00 오늘 일정 확인</span>
            <span>13:30 메모를 작업으로 정리</span>
            <span>20:00 주말 코스 저장</span>
          </div>
        </div>
      </section>
      <section className="portfolioShowcase" aria-label="portfolio projects">
        {portfolioLinks.map((item) => (
          <button
            key={item.path}
            type="button"
            className={`portfolioCard ${item.tone}`}
            onClick={() => navigate(item.path)}
          >
            <span><MemoNavIcon type={item.icon} />{item.action}</span>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </button>
        ))}
      </section>
    </main>
  );
}

function SpaceHomePage({ navigate }) {
  const [appOverview, setAppOverview] = useState(() => summarizeAppActivity() || EMPTY_APP_OVERVIEW);
  const [session, setSession] = useState(readStoredAuth);
  const [guestStarting, setGuestStarting] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [inlineAuthOpen, setInlineAuthOpen] = useState(false);
  const [inlineAuthMode, setInlineAuthMode] = useState('login');
  const [inlineAuthUsername, setInlineAuthUsername] = useState('');
  const [inlineAuthPassword, setInlineAuthPassword] = useState('');
  const [inlineAuthLoading, setInlineAuthLoading] = useState(false);
  const [inlineAuthError, setInlineAuthError] = useState('');
  const accountMode = session?.token && !session?.isGuest && session?.username !== 'guestuser'
    ? 'member'
    : session?.token
      ? 'guest'
      : 'none';
  const isMemberSession = accountMode === 'member';

  useEffect(() => {
    document.title = '개인 워크스페이스';
  }, []);

  useEffect(() => {
    if (!isMemberSession || !session?.token) return undefined;
    let cancelled = false;

    const refreshFromWorkspace = async () => {
      const [workspaceSchedules, workspaceNotes] = await Promise.all([
        loadWorkspaceSchedulerItems(session.token),
        loadWorkspaceMemoBlocks(session.token)
      ]);
      if (cancelled) return;

      if (workspaceSchedules.length) {
        const schedulerKey = schedulerStorageKey(session);
        const mergedSchedules = mergeSchedulerItems(readCurrentSchedulerItems(session), workspaceSchedules);
        localStorage.setItem(schedulerKey, JSON.stringify(mergedSchedules));
        window.dispatchEvent(new CustomEvent('codex:scheduler-items-updated', {
          detail: { items: mergedSchedules, storageKey: schedulerKey }
        }));
      }

      if (workspaceNotes.length) {
        const noteBlocksKey = noteBlocksStorageKey(session);
        const mergedNotes = mergeNoteBlocks(readNoteBlocks(session), workspaceNotes);
        localStorage.setItem(noteBlocksKey, JSON.stringify(mergedNotes));
        window.dispatchEvent(new CustomEvent('codex:notes-updated', {
          detail: { storageKey: noteBlocksKey }
        }));
      }

      setAppOverview(summarizeAppActivity() || EMPTY_APP_OVERVIEW);
    };

    refreshFromWorkspace().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isMemberSession, session?.token, session?.username]);

  useEffect(() => {
    const refresh = () => setAppOverview(summarizeAppActivity() || EMPTY_APP_OVERVIEW);
    const handleStorage = (event) => {
      const currentAuth = readStoredAuth();
      const watchedKeys = [
        AUTH_KEY,
        AI_NOTE_KEY,
        AI_NOTE_BOARDS_KEY,
        noteBlocksStorageKey(currentAuth),
        noteBoardsStorageKey(currentAuth),
        SCHEDULER_KEY,
        schedulerStorageKey(currentAuth)
      ];
      if (!event.key || event.key === AUTH_KEY) {
        setSession(readStoredAuth());
      }
      if (!event.key || watchedKeys.includes(event.key)) {
        refresh();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('codex:scheduler-items-updated', refresh);
    window.addEventListener('codex:notes-updated', refresh);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('codex:scheduler-items-updated', refresh);
      window.removeEventListener('codex:notes-updated', refresh);
    };
  }, []);

  const startGuest = async () => {
    if (guestStarting) return;
    setGuestStarting(true);
    setAccountError('');
    try {
      const guestSession = await requestJson('/api/auth/guest', {
        method: 'POST',
        headers: { Accept: 'application/json' }
      });
      const normalized = normalizeAuthSession({ ...guestSession, isGuest: true });
      localStorage.setItem(AUTH_KEY, JSON.stringify(normalized));
      setSession(normalized);
      setInlineAuthOpen(false);
      setAppOverview(summarizeAppActivity() || EMPTY_APP_OVERVIEW);
      navigate('/app');
    } catch (error) {
      setAccountError(error.message || '게스트 세션을 만들 수 없습니다.');
    } finally {
      setGuestStarting(false);
    }
  };

  const openInlineAuth = () => {
    setInlineAuthOpen(true);
    setInlineAuthError('');
    setAccountError('');
  };

  const closeInlineAuth = () => {
    setInlineAuthOpen(false);
    setInlineAuthError('');
  };

  const changeInlineAuthMode = (mode) => {
    setInlineAuthMode(mode === 'signup' ? 'signup' : 'login');
    setInlineAuthError('');
  };

  const submitInlineAuth = async (event) => {
    event.preventDefault();
    if (inlineAuthLoading) return;
    const validationError = validateAuthForm(inlineAuthMode, inlineAuthUsername, inlineAuthPassword);
    if (validationError) {
      setInlineAuthError(validationError);
      return;
    }
    setInlineAuthLoading(true);
    setInlineAuthError('');
    setAccountError('');
    try {
      const authSession = await requestJson(inlineAuthMode === 'signup' ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username: inlineAuthUsername.trim(), password: inlineAuthPassword })
      });
      const normalized = normalizeAuthSession(authSession);
      localStorage.setItem(AUTH_KEY, JSON.stringify(normalized));
      setSession(normalized);
      setInlineAuthOpen(false);
      setInlineAuthPassword('');
      setAppOverview(summarizeAppActivity() || EMPTY_APP_OVERVIEW);
    } catch (error) {
      setInlineAuthError(error.message || '로그인 중 문제가 발생했습니다.');
    } finally {
      setInlineAuthLoading(false);
    }
  };

  const toggleHomeSchedule = (item, done) => {
    if (!item?.sourceId && !item?.id) return;
    const schedulerKey = schedulerStorageKey(session);
    const sourceId = item.recurring ? item.sourceId || item.scheduleId || item.id : item.scheduleId || item.id;
    const nextItems = readCurrentSchedulerItems(session).map((source) => {
      if (source.id !== sourceId) return source;
      if (item.recurring) {
        return {
          ...source,
          doneOverrides: {
            ...(source.doneOverrides || {}),
            [item.date]: Boolean(done)
          }
        };
      }
      return { ...source, done: Boolean(done) };
    });

    try {
      localStorage.setItem(schedulerKey, JSON.stringify(nextItems));
      if (localStorage.getItem(SCHEDULER_KEY)) {
        localStorage.removeItem(SCHEDULER_KEY);
      }
    } catch {
      return;
    }

    window.dispatchEvent(new CustomEvent('codex:scheduler-items-updated', {
      detail: { item: { ...item, done: Boolean(done) }, items: nextItems, storageKey: schedulerKey }
    }));
    setAppOverview(summarizeAppActivity() || EMPTY_APP_OVERVIEW);
  };

  return (
    <AppHome
      accountError={accountError}
      accountMode={accountMode}
      appOverview={appOverview}
      guestStarting={guestStarting}
      inlineAuth={{
        open: inlineAuthOpen && !isMemberSession,
        mode: inlineAuthMode,
        username: inlineAuthUsername,
        password: inlineAuthPassword,
        loading: inlineAuthLoading,
        error: inlineAuthError,
        onOpen: openInlineAuth,
        onClose: closeInlineAuth,
        onModeChange: changeInlineAuthMode,
        onUsernameChange: setInlineAuthUsername,
        onPasswordChange: setInlineAuthPassword,
        onSubmit: submitInlineAuth
      }}
      isMemberSession={isMemberSession}
      navigate={navigate}
      onStartGuest={startGuest}
      onScheduleToggle={toggleHomeSchedule}
      session={session}
    />
  );
}

function MorePage({ navigate }) {
  const extraFeatures = [
    {
      key: 'travel',
      title: '여행',
      description: '다가오는 여행 일정과 코스를 관리해요.',
      icon: 'trip',
      path: '/travel',
      status: '열기'
    },
    {
      key: 'budget',
      title: '가계부',
      description: '입금과 출금을 빠르게 기록해요.',
      icon: 'chart',
      path: '/budget',
      status: '열기'
    },
    {
      key: 'workout',
      title: '운동',
      description: '오늘 운동 템플릿을 기록해요.',
      icon: 'trophy',
      path: '/workout',
      status: '열기'
    },
    {
      key: 'reading',
      title: '독서',
      description: '관심있는 책과 읽고있는 책을 관리해요.',
      icon: 'book',
      path: '/reading',
      status: '열기'
    }
  ];

  useEffect(() => {
    document.title = '더보기';
  }, []);

  return (
    <MobilePageShell
      activeTab="more"
      className="spaceHome referenceHome"
      icon="menu"
      navigate={navigate}
      profile={mobileProfileForRoute(navigate, '/more')}
      title="더보기"
    >
      <section className="spaceAppFrame appHomeDashboard morePageDashboard" aria-label="더보기">
        <section className="appHomeCard moreFeatureCard" aria-label="확장 기능">
          <div className="moreFeatureList">
            {extraFeatures.map((feature) => (
              <button
                type="button"
                key={feature.key}
                className={feature.path ? '' : 'pending'}
                aria-disabled={!feature.path}
                onClick={() => (feature.path ? navigate(feature.path) : undefined)}
              >
                <span>
                  <MemoNavIcon type={feature.icon} />
                </span>
                <strong>{feature.title}</strong>
                <small>{feature.description}</small>
                <em>{feature.status}</em>
              </button>
            ))}
          </div>
        </section>
      </section>
    </MobilePageShell>
  );
}

function AccountPage({ navigate }) {
  const [session, setSession] = useState(() => readStoredAuth());
  const isGuest = !session || session.isGuest || session.username === 'guestuser';
  const displayName = isGuest ? 'Guest' : session.username || 'Member';

  useEffect(() => {
    document.title = '내 정보';
  }, []);

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setSession(null);
    navigate('/app');
  };

  return (
    <MobilePageShell
      activeTab="home"
      className="spaceHome referenceHome utilityPageShell accountPageShell"
      icon="user"
      navigate={navigate}
      onBack={() => navigate('/app')}
      profile={mobileProfileForRoute(navigate, '/mypage')}
      subtitle={isGuest ? '로그인 필요' : '회원 계정'}
      title="내 정보"
    >
      <section className="spaceAppFrame appHomeDashboard utilityPageDashboard" aria-label="내 정보">
        <section className="utilityPageCard accountSummaryCard">
          <div className="accountAvatar">{displayName.slice(0, 1).toUpperCase()}</div>
          <div className="accountSummaryCopy">
            <strong>{displayName}</strong>
            <small>{isGuest ? '로그인하면 계정별 데이터가 분리됩니다.' : '회원 세션이 활성화되어 있습니다.'}</small>
          </div>
          <dl className="accountDetailList">
            <div>
              <dt>상태</dt>
              <dd>{isGuest ? 'Guest' : 'Member'}</dd>
            </div>
            <div>
              <dt>저장소</dt>
              <dd>{storageUsername(session)}</dd>
            </div>
          </dl>
          <div className="utilityActionRow">
            {isGuest ? (
              <button type="button" className="utilityPrimaryButton" onClick={() => redirectToLogin('/mypage')}>로그인</button>
            ) : (
              <button type="button" className="utilitySecondaryButton" onClick={logout}>로그아웃</button>
            )}
            <button type="button" className="utilitySecondaryButton" onClick={() => navigate('/app')}>앱 홈</button>
          </div>
        </section>
      </section>
    </MobilePageShell>
  );
}

function BudgetPage({ navigate }) {
  const session = readStoredAuth();
  const storageKey = budgetStorageKey(session);
  const [entries, setEntries] = useState(() => readBudgetEntries(session));
  const [statusText, setStatusText] = useState('');
  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7));
  const [draft, setDraft] = useState({
    type: 'withdraw',
    amount: '',
    date: today,
    category: '식비',
    memo: ''
  });

  useEffect(() => {
    document.title = '가계부';
  }, []);

  const monthDays = useMemo(() => buildMonthDays(calendarMonth), [calendarMonth]);
  const monthEntries = useMemo(() => entries.filter((entry) => entry.date.startsWith(calendarMonth)), [entries, calendarMonth]);
  const monthTotals = useMemo(() => summarizeBudgetEntries(monthEntries), [monthEntries]);
  const monthBalance = monthTotals.income - monthTotals.expense;
  const selectedDateEntries = useMemo(() => entries
    .filter((entry) => entry.date === selectedDate)
    .sort(compareDatedRecords), [entries, selectedDate]);
  const entriesByDate = useMemo(() => monthEntries.reduce((groups, entry) => {
    const current = groups[entry.date] || { income: 0, expense: 0, count: 0 };
    if (entry.type === 'deposit') {
      current.income += entry.amount;
    } else {
      current.expense += entry.amount;
    }
    current.count += 1;
    groups[entry.date] = current;
    return groups;
  }, {}), [monthEntries]);

  const setDraftValue = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    if (field === 'date' && isDateKey(value)) {
      setSelectedDate(value);
      setCalendarMonth(value.slice(0, 7));
    }
  };

  const submitEntry = (event) => {
    event.preventDefault();
    const amount = Math.round(Math.abs(Number(draft.amount) || 0));
    if (!amount) {
      setStatusText('금액을 입력하세요.');
      return;
    }
    const type = draft.type === 'deposit' ? 'deposit' : 'withdraw';
    const nextEntry = normalizeBudgetEntry({
      id: `budget-${Date.now()}`,
      type,
      amount,
      date: isDateKey(draft.date) ? draft.date : toDateKey(new Date()),
      category: draft.category,
      memo: draft.memo,
      createdAt: new Date().toISOString()
    });
    if (!nextEntry) return;
    setEntries((current) => saveBudgetEntries(storageKey, [nextEntry, ...current]));
    setSelectedDate(nextEntry.date);
    setCalendarMonth(nextEntry.date.slice(0, 7));
    setDraft((current) => ({ ...current, amount: '', memo: '' }));
    setStatusText(`${type === 'deposit' ? '입금' : '출금'}을 기록했습니다.`);
  };

  const deleteEntry = (entryId) => {
    setEntries((current) => saveBudgetEntries(storageKey, current.filter((entry) => entry.id !== entryId)));
  };

  return (
    <MobilePageShell
      activeTab="more"
      className="spaceHome referenceHome utilityPageShell budgetPageShell"
      icon="chart"
      navigate={navigate}
      onBack={() => navigate('/more')}
      profile={mobileProfileForRoute(navigate, '/budget')}
      subtitle="입금 · 출금 · 잔액"
      title="가계부"
    >
      <section className="spaceAppFrame appHomeDashboard utilityPageDashboard" aria-label="가계부">
        <section className="utilityStatsGrid" aria-label="가계부 요약">
          <article className="utilityStat income">
            <span>{calendarMonth} 입금</span>
            <strong>{formatKoreanMoney(monthTotals.income)}</strong>
          </article>
          <article className="utilityStat expense">
            <span>{calendarMonth} 출금</span>
            <strong>{formatKoreanMoney(monthTotals.expense)}</strong>
          </article>
          <article className="utilityStat balance">
            <span>월 잔액</span>
            <strong>{formatKoreanMoney(monthBalance)}</strong>
          </article>
        </section>

        <section className="utilityPageCard budgetCalendarCard" aria-label="월간 가계부 달력">
          <header className="utilitySectionHeader budgetCalendarHeader">
            <button type="button" className="utilityIconButton" onClick={() => setCalendarMonth((current) => moveMonthKey(current, -1))} aria-label="이전 달">
              <MemoNavIcon type="chevronLeft" />
            </button>
            <div>
              <strong>{calendarMonth}</strong>
              <small>한 달 입금/출금</small>
            </div>
            <button type="button" className="utilityIconButton" onClick={() => setCalendarMonth((current) => moveMonthKey(current, 1))} aria-label="다음 달">
              <MemoNavIcon type="chevronRight" />
            </button>
          </header>
          <div className="budgetCalendarWeekdays" aria-hidden="true">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="budgetCalendarGrid">
            {monthDays.map((day) => {
              const summary = entriesByDate[day.key] || { income: 0, expense: 0, count: 0 };
              const selected = selectedDate === day.key;
              return (
                <button
                  type="button"
                  key={day.key}
                  className={[
                    'budgetCalendarDay',
                    day.currentMonth ? '' : 'muted',
                    selected ? 'selected' : '',
                    summary.count ? 'hasEntry' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    setSelectedDate(day.key);
                    setDraft((current) => ({ ...current, date: day.key }));
                  }}
                >
                  <span>{day.dayNumber}</span>
                  <strong>{summary.income ? `+${KRW_FORMATTER.format(summary.income)}` : ''}</strong>
                  <em>{summary.expense ? `-${KRW_FORMATTER.format(summary.expense)}` : ''}</em>
                </button>
              );
            })}
          </div>
        </section>

        <form className="utilityPageCard utilityForm" onSubmit={submitEntry}>
          <div className="utilitySegment" aria-label="거래 유형">
            <button
              type="button"
              className={draft.type === 'deposit' ? 'active' : ''}
              onClick={() => setDraft((current) => ({ ...current, type: 'deposit', category: current.category || '급여' }))}
            >
              입금
            </button>
            <button
              type="button"
              className={draft.type === 'withdraw' ? 'active' : ''}
              onClick={() => setDraft((current) => ({ ...current, type: 'withdraw', category: current.category || '생활비' }))}
            >
              출금
            </button>
          </div>
          <div className="utilityFormGrid">
            <label className="utilityField">
              <span>금액</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="0"
                value={draft.amount}
                onChange={(event) => setDraftValue('amount', event.target.value)}
              />
            </label>
            <label className="utilityField">
              <span>날짜</span>
              <input
                type="date"
                value={draft.date}
                onChange={(event) => setDraftValue('date', event.target.value)}
              />
            </label>
            <label className="utilityField">
              <span>카테고리</span>
              <input
                value={draft.category}
                onChange={(event) => setDraftValue('category', event.target.value)}
                placeholder="식비"
              />
            </label>
            <label className="utilityField full">
              <span>메모</span>
              <input
                value={draft.memo}
                onChange={(event) => setDraftValue('memo', event.target.value)}
                placeholder="간단한 메모"
              />
            </label>
          </div>
          <button type="submit" className="utilityPrimaryButton">기록하기</button>
          {statusText ? <p className="utilityStatusText">{statusText}</p> : null}
        </form>

        <section className="utilityPageCard utilityRecentCard" aria-label="선택한 날짜 가계부 내역">
          <header className="utilitySectionHeader">
            <strong>{selectedDate} 내역</strong>
            <small>{selectedDateEntries.length}개</small>
          </header>
          <div className="utilityRecentList">
            {selectedDateEntries.map((entry) => (
              <article className="utilityLogRow budgetLogRow" key={entry.id}>
                <span className={`utilityLogBadge ${entry.type}`}>{entry.type === 'deposit' ? '입금' : '출금'}</span>
                <div>
                  <strong>{entry.category}</strong>
                  <small>{[entry.date, entry.memo].filter(Boolean).join(' · ')}</small>
                </div>
                <em className={entry.type}>{formatKoreanMoney(entry.amount)}</em>
                <button type="button" className="utilityIconButton" onClick={() => deleteEntry(entry.id)} aria-label="내역 삭제">
                  <MemoNavIcon type="trash" />
                </button>
              </article>
            ))}
            {selectedDateEntries.length ? null : <p className="utilityEmptyText">선택한 날짜의 기록이 없습니다.</p>}
          </div>
        </section>
      </section>
    </MobilePageShell>
  );
}

function WorkoutPage({ navigate }) {
  const session = readStoredAuth();
  const storageKey = workoutStorageKey(session);
  const profileKey = workoutProfileStorageKey(session);
  const schedulerKey = schedulerStorageKey(session);
  const today = toDateKey(new Date());
  const [logs, setLogs] = useState(() => readWorkoutLogs(session));
  const [profile, setProfile] = useState(() => readWorkoutProfile(session));
  const [statusText, setStatusText] = useState('');
  const [draft, setDraft] = useState(() => ({
    templateId: WORKOUT_TEMPLATES[0].id,
    date: today,
    startTime: '',
    durationMinutes: '',
    caloriesBurned: '',
    addToSchedule: true,
    memo: '',
    exercises: workoutExercisesForTemplate(WORKOUT_TEMPLATES[0])
  }));
  const activeTemplate = useMemo(
    () => WORKOUT_TEMPLATES.find((template) => template.id === draft.templateId) || WORKOUT_TEMPLATES[0],
    [draft.templateId]
  );
  const isCardioTemplate = activeTemplate.id === 'cardio';
  const normalizedDraftExercises = useMemo(
    () => draft.exercises.map(normalizeWorkoutExercise).filter(Boolean),
    [draft.exercises]
  );
  const draftDurationMinutes = useMemo(() => workoutDurationMinutes({
    templateId: draft.templateId,
    durationMinutes: draft.durationMinutes,
    exercises: normalizedDraftExercises
  }), [draft.durationMinutes, draft.templateId, normalizedDraftExercises]);
  const draftEstimatedCalories = useMemo(() => estimateWorkoutCalories({
    templateId: draft.templateId,
    durationMinutes: draft.durationMinutes,
    exercises: normalizedDraftExercises,
    profile
  }), [draft.durationMinutes, draft.templateId, normalizedDraftExercises, profile]);
  const draftManualCalories = parseWorkoutNumber(draft.caloriesBurned);
  const draftCaloriesBurned = draftManualCalories || draftEstimatedCalories;
  const basalMetabolicRate = useMemo(() => calculateWorkoutBmr(profile), [profile]);
  const recentLogs = useMemo(() => [...logs].sort(compareDatedRecords).slice(0, 10), [logs]);
  const monthKey = draft.date.slice(0, 7);
  const monthLogs = useMemo(() => logs.filter((log) => log.date.startsWith(monthKey)), [logs, monthKey]);
  const monthDuration = monthLogs.reduce((total, log) => total + (Number(log.durationMinutes) || 0), 0);
  const monthExerciseCount = monthLogs.reduce((total, log) => total + (log.exercises?.length || 0), 0);
  const monthCalories = monthLogs.reduce((total, log) => total + (
    Number(log.caloriesBurned)
    || estimateWorkoutCalories({
      templateId: log.templateId,
      durationMinutes: log.durationMinutes,
      exercises: log.exercises,
      profile
    })
    || 0
  ), 0);

  useEffect(() => {
    document.title = '운동';
  }, []);

  useEffect(() => {
    saveWorkoutProfile(profileKey, profile);
  }, [profile, profileKey]);

  const selectTemplate = (template) => {
    setDraft((current) => ({
      ...current,
      templateId: template.id,
      durationMinutes: template.id === 'cardio' ? '' : current.durationMinutes,
      exercises: workoutExercisesForTemplate(template)
    }));
  };

  const updateWorkoutDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateWorkoutProfile = (field, value) => {
    setProfile((current) => normalizeWorkoutProfile({ ...current, [field]: value }));
  };

  const updateWorkoutExercise = (index, field, value) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, exerciseIndex) => (
        exerciseIndex === index ? { ...exercise, [field]: value } : exercise
      ))
    }));
  };

  const updateCardioExerciseActivity = (index, activityId) => {
    const activity = cardioActivityForId(activityId) || WORKOUT_CARDIO_ACTIVITIES[0];
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((exercise, exerciseIndex) => (
        exerciseIndex === index
          ? {
            ...exercise,
            mode: 'cardio',
            name: activity.name,
            weight: '',
            durationMinutes: String(activity.durationMinutes),
            met: String(activity.met)
          }
          : exercise
      ))
    }));
  };

  const addWorkoutExercise = () => {
    setDraft((current) => ({
      ...current,
      exercises: [
        ...current.exercises,
        current.templateId === 'cardio'
          ? createCardioExercise(WORKOUT_CARDIO_ACTIVITIES[current.exercises.length % WORKOUT_CARDIO_ACTIVITIES.length])
          : { id: `exercise-${Date.now()}`, name: '', sets: '', reps: '', weight: '' }
      ]
    }));
  };

  const removeWorkoutExercise = (index) => {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.filter((_, exerciseIndex) => exerciseIndex !== index)
    }));
  };

  const submitWorkout = (event) => {
    event.preventDefault();
    const template = WORKOUT_TEMPLATES.find((item) => item.id === draft.templateId) || WORKOUT_TEMPLATES[0];
    const exercises = draft.exercises.map(normalizeWorkoutExercise).filter(Boolean);
    if (!exercises.length) {
      setStatusText('운동 항목을 하나 이상 입력하세요.');
      return;
    }
    const durationMinutes = workoutDurationMinutes({
      templateId: template.id,
      durationMinutes: draft.durationMinutes,
      exercises
    });
    const caloriesBurned = parseWorkoutNumber(draft.caloriesBurned) || estimateWorkoutCalories({
      templateId: template.id,
      durationMinutes,
      exercises,
      profile
    });
    const nextLog = normalizeWorkoutLog({
      id: `workout-${Date.now()}`,
      templateId: template.id,
      title: template.title,
      date: isDateKey(draft.date) ? draft.date : today,
      startTime: draft.startTime,
      durationMinutes,
      caloriesBurned: caloriesBurned || 0,
      bodyWeightKg: parseWorkoutNumber(profile.weightKg),
      bodyHeightCm: parseWorkoutNumber(profile.heightCm),
      memo: draft.memo,
      exercises,
      createdAt: new Date().toISOString()
    });
    setLogs((current) => saveWorkoutLogs(storageKey, [nextLog, ...current]));
    if (draft.addToSchedule) {
      upsertWorkoutScheduleItem(schedulerKey, buildWorkoutScheduleItem(nextLog, draft.startTime));
    }
    setDraft((current) => ({ ...current, startTime: '', durationMinutes: '', caloriesBurned: '', memo: '', addToSchedule: true }));
    setStatusText(draft.addToSchedule
      ? `${nextLog.date} ${nextLog.title} 운동과 일정을 기록했습니다.${nextLog.caloriesBurned ? ` 예상 소모 ${formatKcal(nextLog.caloriesBurned)}.` : ''}`
      : `${nextLog.date} ${nextLog.title} 운동을 기록했습니다.${nextLog.caloriesBurned ? ` 예상 소모 ${formatKcal(nextLog.caloriesBurned)}.` : ''}`);
  };

  const deleteLog = (logId) => {
    setLogs((current) => saveWorkoutLogs(storageKey, current.filter((log) => log.id !== logId)));
    const removedSchedule = deleteWorkoutScheduleForLog(schedulerKey, logId);
    setStatusText(removedSchedule ? '운동 기록과 연결된 일정도 삭제했습니다.' : '운동 기록을 삭제했습니다.');
  };

  return (
    <MobilePageShell
      activeTab="more"
      className="spaceHome referenceHome utilityPageShell workoutPageShell"
      icon="trophy"
      navigate={navigate}
      onBack={() => navigate('/more')}
      profile={mobileProfileForRoute(navigate, '/workout')}
      subtitle="상체 · 하체 · 유산소"
      title="운동"
    >
      <section className="spaceAppFrame appHomeDashboard utilityPageDashboard" aria-label="운동">
        <section className="utilityStatsGrid workoutStatsGrid" aria-label="운동 요약">
          <article className="utilityStat">
            <span>{monthKey} 운동일</span>
            <strong>{monthLogs.length}일</strong>
          </article>
          <article className="utilityStat">
            <span>운동 시간</span>
            <strong>{monthDuration}분</strong>
          </article>
          <article className="utilityStat">
            <span>기록 종목</span>
            <strong>{monthExerciseCount}개</strong>
          </article>
          <article className="utilityStat">
            <span>소모 칼로리</span>
            <strong>{formatKcal(monthCalories)}</strong>
          </article>
        </section>

        <section className="utilityPageCard workoutProfileCard" aria-label="몸 정보와 칼로리 계산">
          <header className="utilitySectionHeader">
            <strong>내 몸 정보</strong>
            <small>BMR · kcal</small>
          </header>
          <div className="utilityFormGrid workoutProfileGrid">
            <label className="utilityField">
              <span>몸무게(kg)</span>
              <input type="number" min="0" step="0.1" inputMode="decimal" placeholder="kg" value={profile.weightKg} onChange={(event) => updateWorkoutProfile('weightKg', event.target.value)} />
            </label>
            <label className="utilityField">
              <span>키(cm)</span>
              <input type="number" min="0" step="0.1" inputMode="decimal" placeholder="cm" value={profile.heightCm} onChange={(event) => updateWorkoutProfile('heightCm', event.target.value)} />
            </label>
            <label className="utilityField">
              <span>나이</span>
              <input type="number" min="1" inputMode="numeric" value={profile.age} onChange={(event) => updateWorkoutProfile('age', event.target.value)} />
            </label>
            <label className="utilityField">
              <span>성별</span>
              <select value={profile.sex} onChange={(event) => updateWorkoutProfile('sex', event.target.value)}>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </label>
          </div>
          <div className="workoutMetricGrid" aria-label="운동 계산 결과">
            <article>
              <span>기초대사량</span>
              <strong>{basalMetabolicRate ? formatKcal(basalMetabolicRate) : '-'}</strong>
              <small>하루 기준</small>
            </article>
            <article>
              <span>이번 운동</span>
              <strong>{draftCaloriesBurned ? formatKcal(draftCaloriesBurned) : '-'}</strong>
              <small>{draftDurationMinutes ? `${draftDurationMinutes}분` : '시간 필요'}</small>
            </article>
            <article>
              <span>{monthKey} 소모</span>
              <strong>{formatKcal(monthCalories)}</strong>
              <small>기록 기준</small>
            </article>
          </div>
        </section>

        <form className="utilityPageCard workoutRecordCard" aria-label="운동 기록" onSubmit={submitWorkout}>
          <header className="utilitySectionHeader">
            <strong>운동 기록</strong>
            <small>{isCardioTemplate ? '분 · MET · 칼로리' : '세트 · 횟수 · 무게'}</small>
          </header>
          <div className="workoutTemplateTabs" aria-label="운동 종류">
            {WORKOUT_TEMPLATES.map((template) => (
              <button
                type="button"
                key={template.id}
                className={draft.templateId === template.id ? 'active' : ''}
                onClick={() => selectTemplate(template)}
              >
                {template.title}
              </button>
            ))}
          </div>
          <div className="utilityFormGrid workoutMetaGrid">
            <label className="utilityField">
              <span>날짜</span>
              <input type="date" value={draft.date} onChange={(event) => updateWorkoutDraft('date', event.target.value)} />
            </label>
            <label className="utilityField">
              <span>시작 시간</span>
              <input type="time" value={draft.startTime} onChange={(event) => updateWorkoutDraft('startTime', event.target.value)} />
            </label>
            <label className="utilityField">
              <span>{isCardioTemplate ? '총 유산소(분)' : '운동 시간(분)'}</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="분"
                readOnly={isCardioTemplate}
                value={isCardioTemplate ? draftDurationMinutes || '' : draft.durationMinutes}
                onChange={(event) => updateWorkoutDraft('durationMinutes', event.target.value)}
              />
            </label>
            <label className="utilityField">
              <span>소모 칼로리(kcal)</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder={draftEstimatedCalories ? `${draftEstimatedCalories}` : '자동 계산 또는 직접 입력'}
                value={draft.caloriesBurned}
                onChange={(event) => updateWorkoutDraft('caloriesBurned', event.target.value)}
              />
            </label>
          </div>
          <label className={`workoutScheduleToggle ${draft.addToSchedule ? 'enabled' : ''}`}>
            <input
              type="checkbox"
              checked={draft.addToSchedule}
              aria-label="스케줄러 등록"
              onChange={(event) => updateWorkoutDraft('addToSchedule', event.target.checked)}
            />
            <span className="workoutScheduleSwitch" aria-hidden="true">
              <i />
            </span>
            <span className="workoutScheduleCopy">
              <strong>스케줄러 등록</strong>
              <small>{draft.startTime ? '시작 시간과 운동 시간(분)을 일정에 함께 저장합니다.' : '시작 시간이 비어 있으면 날짜 기준 일정으로 저장합니다.'}</small>
            </span>
            <em>{draft.addToSchedule ? 'ON' : 'OFF'}</em>
          </label>
          <div className={`workoutExerciseTable ${isCardioTemplate ? 'cardio' : ''}`} aria-label="운동 항목">
            <div className="workoutExerciseHeader">
              <span>{isCardioTemplate ? '유산소' : '운동명'}</span>
              <span>{isCardioTemplate ? '분' : '세트'}</span>
              <span>{isCardioTemplate ? 'MET' : '횟수'}</span>
              <span>{isCardioTemplate ? '소모' : '무게'}</span>
              <span />
            </div>
            {draft.exercises.map((exercise, index) => {
              const exerciseCalories = workoutExerciseCalories(exercise, profile);
              return isCardioTemplate ? (
                <div className="workoutExerciseRow workoutCardioRow" key={exercise.id || index}>
                  <select value={cardioActivityIdForExercise(exercise)} onChange={(event) => updateCardioExerciseActivity(index, event.target.value)}>
                    {WORKOUT_CARDIO_ACTIVITIES.map((activity) => (
                      <option value={activity.id} key={activity.id}>{activity.name}</option>
                    ))}
                  </select>
                  <input type="number" min="0" inputMode="numeric" value={exercise.durationMinutes || ''} onChange={(event) => updateWorkoutExercise(index, 'durationMinutes', event.target.value)} placeholder="분" />
                  <input type="number" min="0" step="0.1" inputMode="decimal" value={exercise.met || ''} onChange={(event) => updateWorkoutExercise(index, 'met', event.target.value)} placeholder="MET" />
                  <span className="workoutExerciseCalories">{exerciseCalories ? formatKcal(exerciseCalories) : '-'}</span>
                  <button type="button" className="utilityIconButton" onClick={() => removeWorkoutExercise(index)} aria-label="운동 항목 삭제">
                    <MemoNavIcon type="trash" />
                  </button>
                </div>
              ) : (
                <div className="workoutExerciseRow" key={exercise.id || index}>
                  <input value={exercise.name} onChange={(event) => updateWorkoutExercise(index, 'name', event.target.value)} placeholder="운동명" />
                  <input value={exercise.sets} onChange={(event) => updateWorkoutExercise(index, 'sets', event.target.value)} placeholder="3" />
                  <input value={exercise.reps} onChange={(event) => updateWorkoutExercise(index, 'reps', event.target.value)} placeholder="10" />
                  <input value={exercise.weight} onChange={(event) => updateWorkoutExercise(index, 'weight', event.target.value)} placeholder="kg" />
                  <button type="button" className="utilityIconButton" onClick={() => removeWorkoutExercise(index)} aria-label="운동 항목 삭제">
                    <MemoNavIcon type="trash" />
                  </button>
                </div>
              );
            })}
          </div>
          <button type="button" className="utilitySecondaryButton" onClick={addWorkoutExercise}>운동 추가</button>
          <label className="utilityField full">
            <span>메모</span>
            <input value={draft.memo} onChange={(event) => updateWorkoutDraft('memo', event.target.value)} placeholder="컨디션, 통증, 다음 목표" />
          </label>
          <button type="submit" className="utilityPrimaryButton">운동 기록 저장</button>
          {statusText ? <p className="utilityStatusText">{statusText}</p> : null}
        </form>

        <section className="utilityPageCard utilityRecentCard" aria-label="최근 운동 기록">
          <header className="utilitySectionHeader">
            <strong>최근 운동 로그</strong>
            <small>{logs.length}개</small>
          </header>
          <div className="utilityRecentList">
            {recentLogs.map((log) => {
              const logCalories = Number(log.caloriesBurned) || estimateWorkoutCalories({
                templateId: log.templateId,
                durationMinutes: log.durationMinutes,
                exercises: log.exercises,
                profile
              });
              return (
                <article className="utilityLogRow workoutLogRow" key={log.id}>
                  <span className="utilityLogBadge workout">{log.title.slice(0, 1)}</span>
                  <div>
                    <strong>{log.date}{log.startTime ? ` · ${log.startTime}` : ''} · {log.title}{log.durationMinutes ? ` · ${log.durationMinutes}분` : ''}{logCalories ? ` · ${formatKcal(logCalories)}` : ''}</strong>
                    <small>{workoutLogSummary(log)}{log.memo ? ` · ${log.memo}` : ''}</small>
                  </div>
                  <button type="button" className="utilityIconButton" onClick={() => deleteLog(log.id)} aria-label="운동 로그 삭제">
                    <MemoNavIcon type="trash" />
                  </button>
                </article>
              );
            })}
            {recentLogs.length ? null : <p className="utilityEmptyText">오늘 운동을 기록해보세요.</p>}
          </div>
        </section>
      </section>
    </MobilePageShell>
  );
}

function AiNotePage({ navigate }) {
  const session = readStoredAuth();
  const noteBlocksKey = noteBlocksStorageKey(session);
  const noteBoardsKey = noteBoardsStorageKey(session);
  const routeTargetRef = useRef({
    applied: false,
    boardId: new URLSearchParams(window.location.search).get('board') || '',
    blockId: new URLSearchParams(window.location.search).get('block') || ''
  });
  const [boards, setBoards] = useState(() => readMemoBoards(session));
  const [blocks, setBlocks] = useState(() => readNoteBlocks(session));
  const [activeId, setActiveId] = useState('');
  const [workspaceMode, setWorkspaceMode] = useState('board');
  const [noteContentOpen, setNoteContentOpen] = useState(true);
  const [syncCount, setSyncCount] = useState(0);
  const [fileStatus, setFileStatus] = useState('');
  const [draggingBlockId, setDraggingBlockId] = useState('');
  const [movingBlock, setMovingBlock] = useState(null);
  const freeformBoardRef = useRef(null);
  const memoTextareaRef = useRef(null);
  const movedBlockRef = useRef(false);
  const movedBlockResetTimerRef = useRef(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [activeBoardId, setActiveBoardId] = useState(routeTargetRef.current.boardId || 'memo');
  const [memoActiveLine, setMemoActiveLine] = useState(null);
  const [editingBlockId, setEditingBlockId] = useState('');
  const [editingTitleId, setEditingTitleId] = useState('');
  const [editingBoardId, setEditingBoardId] = useState('');
  const [memoWindowOpen, setMemoWindowOpen] = useState(false);
  const [memoComposerMode, setMemoComposerMode] = useState('edit');

  useEffect(() => {
    document.title = '메모';
  }, []);

  useEffect(() => {
    localStorage.setItem(noteBlocksKey, JSON.stringify(blocks));
    localStorage.removeItem(AI_NOTE_KEY);
    window.dispatchEvent(new CustomEvent('codex:notes-updated', { detail: { storageKey: noteBlocksKey } }));
    setSyncCount(syncNoteSchedules(blocks));
  }, [blocks, noteBlocksKey]);

  useEffect(() => {
    localStorage.setItem(noteBoardsKey, JSON.stringify(boards));
    localStorage.removeItem(AI_NOTE_BOARDS_KEY);
    window.dispatchEvent(new CustomEvent('codex:notes-updated', { detail: { storageKey: noteBoardsKey } }));
  }, [boards, noteBoardsKey]);

  useEffect(() => {
    if (session?.username !== 'admin1') return;
    setBoards((current) => (
      current.some((board) => board.id === 'memo')
        ? current
        : [...current, { id: 'memo', title: '메모 보드' }]
    ));
    setBlocks((current) => {
      const existingIds = new Set(current.map((block) => block.id));
      const missingTasks = ADMIN1_BOARD_TASKS.filter((task) => !existingIds.has(task.id));
      const missingLogs = ADMIN1_MEMO_LOGS.filter((memo) => !existingIds.has(memo.id));
      if (!missingTasks.length && !missingLogs.length) return current;
      return [
        ...missingTasks.map((task, index) => ({
          id: task.id,
          type: 'text',
          content: `## ${task.title}\n\n- [ ] 진행 상태 확인\n- [ ] 운영 화면 확인`,
          sector: 'project',
          boardId: 'project',
          status: task.status,
          parentId: '',
          filePath: `memo-files/admin1/${task.id}.md`,
          width: 220,
          height: 120,
          x: 18 + (index % 3) * 24,
          y: 18 + Math.floor(index / 3) * 32
        })),
        ...missingLogs.map((memo, index) => ({
          id: memo.id,
          type: 'text',
          content: memo.content,
          sector: 'memo',
          boardId: 'memo',
          status: 'done',
          parentId: '',
          filePath: `memo-files/admin1/${memo.id}.md`,
          width: 760,
          height: 120,
          x: 28 + (index % 2) * 44,
          y: 28 + index * 82
        })),
        ...current
      ];
    });
  }, [session?.username]);

  useEffect(() => {
    if (!boards.some((board) => board.id === activeBoardId)) {
      setActiveBoardId(boards[0]?.id || 'project');
    }
  }, [activeBoardId, boards]);

  useEffect(() => {
    if (!blocks.length) return;
    if (!activeId || !blocks.some((block) => block.id === activeId)) {
      const firstBoardBlock = blocks.find((block) => (block.boardId || block.sector) === activeBoardId);
      setActiveId((firstBoardBlock || blocks[0]).id);
    }
  }, [activeBoardId, activeId, blocks]);

  useEffect(() => {
    const target = routeTargetRef.current;
    if (target.applied || !target.blockId) return;
    const targetBlock = blocks.find((block) => block.id === target.blockId);
    if (!targetBlock) return;
    target.applied = true;
    setActiveBoardId(target.boardId || targetBlock.boardId || targetBlock.sector || 'memo');
    setActiveId(targetBlock.id);
    setNoteContentOpen(true);
    setMemoWindowOpen(true);
    setEditingBlockId(targetBlock.id);
    setEditingTitleId('');
    setMemoActiveLine(null);
    setMemoComposerMode('edit');
    setFileStatus(`${noteBlockTitle(targetBlock)} 메모를 열었습니다.`);
  }, [blocks]);

  const addBoard = () => {
    const nextIndex = boards.length + 1;
    const nextBoard = {
      id: `board-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: `새 보드 ${nextIndex}`
    };
    setBoards((current) => [...current, nextBoard]);
    setActiveBoardId(nextBoard.id);
    setNoteContentOpen(true);
    setEditingBoardId(nextBoard.id);
  };

  const renameBoard = (id, title) => {
    setBoards((current) => current.map((board) => (board.id === id ? { ...board, title } : board)));
  };

  const deleteBoard = (id) => {
    const targetBoard = boards.find((board) => board.id === id);
    if (!canDeleteMemoBoard(targetBoard)) {
      setFileStatus('프로젝트 보드는 작업 기준이라 삭제하지 않습니다.');
      return;
    }
    if (!window.confirm(`${targetBoard.title} 보드를 삭제할까요? 보드 안의 메모도 함께 삭제됩니다.`)) {
      return;
    }
    const nextBoard = boards.find((board) => board.id !== id) || null;
    setBoards((current) => current.filter((board) => board.id !== id));
    setBlocks((current) => current.filter((block) => (block.boardId || block.sector) !== id));
    setActiveBoardId(nextBoard?.id || 'project');
    setActiveId('');
    setMemoActiveLine(null);
    setEditingBlockId('');
    setEditingTitleId('');
    setEditingBoardId('');
    setNoteContentOpen(Boolean(nextBoard));
    setFileStatus(`${targetBoard.title} 보드를 삭제했습니다.`);
  };

  const addBlock = (type, parentId = '', status = 'todo', boardId = activeBoardId, options = {}) => {
    const nextId = `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const extension = type === 'file' ? 'txt' : 'md';
    const blockType = ['file', 'checklist'].includes(type) ? type : 'text';
    const nextBlock = {
      id: nextId,
      type: blockType,
      content: blockType === 'file' ? '새 메모' : blockType === 'checklist' ? '# 새 체크리스트\n\n- [ ] 첫 번째 항목' : '새 메모',
      sector: boardId,
      boardId,
      status,
      parentId,
      filePath: `memo-files/${boardId}/${nextId}.${extension}`,
      width: boardId === 'project' ? 220 : 760,
      height: boardId === 'project' ? 120 : blockType === 'checklist' ? 104 : 58,
      x: boardId === 'project' ? 0 : 28 + (blocks.filter((block) => (block.boardId || block.sector) === boardId).length % 3) * 38,
      y: boardId === 'project' ? 0 : 28 + (blocks.filter((block) => (block.boardId || block.sector) === boardId).length % 6) * 72
    };
    setBlocks((current) => [...current, nextBlock]);
    setActiveId(nextBlock.id);
    setEditingBlockId(options.edit === false ? '' : nextBlock.id);
    setEditingTitleId('');
    setMemoWindowOpen(Boolean(options.openWindow));
    setFileStatus(`${noteBlockTitle(nextBlock)} 항목을 추가했습니다.`);
  };

  const addTaskBlock = (title) => {
    const nextId = `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextBlock = {
      id: nextId,
      type: 'text',
      content: title,
      sector: activeBoardId,
      boardId: activeBoardId,
      status: 'todo',
      parentId: '',
      filePath: `memo-files/${activeBoardId}/${nextId}.md`,
      width: activeBoardId === 'project' ? 220 : 760,
      height: activeBoardId === 'project' ? 120 : 58,
      x: activeBoardId === 'project' ? 0 : 28 + (blocks.filter((block) => (block.boardId || block.sector) === activeBoardId).length % 3) * 38,
      y: activeBoardId === 'project' ? 0 : 28 + (blocks.filter((block) => (block.boardId || block.sector) === activeBoardId).length % 6) * 72
    };
    setBlocks((current) => [...current, nextBlock]);
    setActiveId(nextBlock.id);
    setEditingBlockId(nextBlock.id);
    setEditingTitleId('');
    setFileStatus(`'${title}' 블록을 추가했습니다.`);
  };

  const updateBlock = (id, patch) => {
    setBlocks((current) => current.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  };

  const updateActiveBlockContent = (id, content) => {
    updateBlock(id, { content });
  };

  const updateBlockSchedule = (block, patch) => {
    if (!block) return;
    const current = normalizeNoteSchedule(block.schedule, block);
    updateBlock(block.id, {
      schedule: {
        ...current,
        ...patch,
        enabled: Object.prototype.hasOwnProperty.call(patch, 'enabled') ? Boolean(patch.enabled) : current.enabled,
        date: isDateKey(patch.date) ? patch.date : current.date,
        time: isTimeKey(patch.time) ? patch.time : current.time
      }
    });
  };

  const applyMarkdownTool = (block, tool) => {
    if (!block || block.type === 'checklist') return;
    setMemoComposerMode('edit');
    const textarea = memoTextareaRef.current;
    const content = block.content || '';
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const selected = content.slice(start, end);
    let insert = '';
    let nextCursor = start;

    if (tool === 'bold') {
      const text = selected || '강조할 내용';
      insert = `**${text}**`;
      nextCursor = selected ? start + insert.length : start + 2;
    } else if (tool === 'check') {
      const source = selected || noteBlockBody(block) || '할 일';
      const items = source
        .split('\n')
        .map((line) => line.replace(/^\s*[-*]\s+(\[[ xX]?\]\s*)?/, '').trim())
        .filter(Boolean)
        .map((line) => ({ checked: false, text: line || '할 일' }));
      updateBlock(block.id, {
        type: 'checklist',
        content: checklistContentWithItems(block, items.length ? items : [{ checked: false, text: '할 일' }])
      });
      return;
    } else {
      const text = selected || '목록';
      insert = text
        .split('\n')
        .map((line) => `- ${line.replace(/^\s*[-*]\s+(\[[ xX]?\]\s*)?/, '').trim() || '목록'}`)
        .join('\n');
      nextCursor = start + insert.length;
    }

    const nextContent = `${content.slice(0, start)}${insert}${content.slice(end)}`;
    updateActiveBlockContent(block.id, nextContent);
    window.setTimeout(() => {
      memoTextareaRef.current?.focus();
      memoTextareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const updateBlockTitle = (block, title) => {
    updateBlock(block.id, { content: noteBlockContentWithTitle(block, title) });
  };

  const beginBlockEdit = (block) => {
    if (!block) return;
    openBlockFile(block);
    setMemoWindowOpen(true);
    setEditingBlockId(block.id);
    setEditingTitleId('');
    setMemoActiveLine(null);
    setMemoComposerMode('edit');
    setFileStatus(`${noteBlockTitle(block)} 메모를 수정합니다.`);
  };

  const finishBlockEdit = () => {
    setEditingBlockId('');
    setEditingTitleId('');
    setMemoWindowOpen(false);
    setMemoComposerMode('edit');
    setFileStatus('메모를 저장했습니다.');
  };

  const closeMemoWindow = () => {
    setMemoWindowOpen(false);
    setEditingBlockId('');
    setEditingTitleId('');
    setMemoActiveLine(null);
    setMemoComposerMode('edit');
  };

  const updateActiveBlockLine = (block, lineIndex, value) => {
    updateBlock(block.id, { content: updateMarkdownLine(block.content || '', lineIndex, value) });
  };

  const insertActiveBlockLine = (block, lineIndex) => {
    const next = insertMarkdownLine(block.content || '', lineIndex);
    updateBlock(block.id, { content: next.content });
    setMemoActiveLine(`${block.id}:${next.lineIndex}`);
  };

  const deleteBlock = (id) => {
    const targetBlock = blocks.find((block) => block.id === id);
    const targetBoardId = targetBlock ? (targetBlock.boardId || targetBlock.sector) : activeBoardId;
    const nextBlock = blocks.find((block) => block.id !== id && (block.boardId || block.sector) === targetBoardId);
    setBlocks((current) => current.filter((block) => block.id !== id));
    setActiveId(nextBlock?.id || '');
    setMemoActiveLine(null);
    setEditingBlockId('');
    setEditingTitleId('');
    setMemoWindowOpen(false);
    setFileStatus(targetBlock ? `${noteBlockTitle(targetBlock)} 메모를 삭제했습니다.` : '메모를 삭제했습니다.');
  };

  const moveBlockToStatus = (id, status) => {
    setBlocks((current) => current.map((block) => (block.id === id ? { ...block, status, sector: activeBoardId, boardId: activeBoardId, parentId: '' } : block)));
    setActiveId(id);
  };

  useEffect(() => {
    if (!movingBlock) return undefined;
    const handlePointerMove = (event) => {
      const deltaX = event.clientX - movingBlock.startX;
      const deltaY = event.clientY - movingBlock.startY;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        movedBlockRef.current = true;
      }
      const maxX = Math.max(0, (movingBlock.boardWidth || 0) - (movingBlock.width || 0));
      const nextX = Math.max(0, Math.min(maxX || 1600, Math.round(movingBlock.baseX + deltaX)));
      const nextY = Math.max(0, Math.round(movingBlock.baseY + deltaY));
      setBlocks((current) => current.map((block) => (block.id === movingBlock.id ? { ...block, x: nextX, y: nextY } : block)));
    };
    const handlePointerUp = () => {
      setMovingBlock(null);
      setDraggingBlockId('');
      window.clearTimeout(movedBlockResetTimerRef.current);
      movedBlockResetTimerRef.current = window.setTimeout(() => {
        movedBlockRef.current = false;
      }, 250);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [movingBlock]);

  const openBlockFile = async (block) => {
    const filePath = noteBlockFilePath(block);
    setActiveId(block.id);
    setEditingBlockId((current) => (current === block.id ? current : ''));
    setEditingTitleId('');
    setMemoActiveLine(null);
    setNoteContentOpen(true);
    setFileStatus('파일을 준비하는 중...');
    setBlocks((current) => current.map((item) => (item.id === block.id ? { ...item, filePath } : item)));
    const session = readStoredAuth();
    if (!session?.token) {
      setFileStatus('보드 안에서 메모를 편집합니다. 로그인하면 파일 저장도 사용할 수 있습니다.');
      return;
    }
    try {
      const folderPath = filePath.includes('/') ? filePath.split('/').slice(0, -1).join('/') : '';
      await requestJson(`/api/workspace/folder?path=${encodeURIComponent(folderPath || 'memo-files')}`, {
        method: 'POST',
        headers: authHeaders(session.token)
      }).catch(() => null);
      try {
        await requestText(`/api/workspace/file?path=${encodeURIComponent(filePath)}`, session.token);
      } catch {
        await requestJson('/api/workspace/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders(session.token) },
          body: JSON.stringify({ path: filePath, content: noteBlockFileContent(block) })
        });
      }
      setFileStatus(`${noteBlockTitle(block)} 메모를 선택했습니다.`);
    } catch (error) {
      setFileStatus(error.message);
    }
  };

  const openBlockEditor = async (block) => {
    const filePath = noteBlockFilePath(block);
    setActiveId(block.id);
    setFileStatus('연결된 파일을 여는 중...');
    setBlocks((current) => current.map((item) => (item.id === block.id ? { ...item, filePath } : item)));
    const editorUrl = `/analysis?file=${encodeURIComponent(filePath)}&autosave=1`;
    const session = readStoredAuth();
    if (!session?.token) {
      setFileStatus('게스트 편집기를 엽니다.');
      navigate(editorUrl);
      return;
    }
    try {
      const folderPath = filePath.includes('/') ? filePath.split('/').slice(0, -1).join('/') : '';
      await requestJson(`/api/workspace/folder?path=${encodeURIComponent(folderPath || 'memo-files')}`, {
        method: 'POST',
        headers: authHeaders(session.token)
      }).catch(() => null);
      await requestJson('/api/workspace/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(session.token) },
        body: JSON.stringify({ path: filePath, content: noteBlockFileContent(block) })
      });
      navigate(editorUrl);
    } catch (error) {
      setFileStatus(error.message);
    }
  };

  const rootBlocks = blocks.filter((block) => !block.parentId);
  const activeBoard = boards.find((board) => board.id === activeBoardId) || boards[0];
  const boardBlocks = rootBlocks.filter((block) => (block.boardId || block.sector) === activeBoardId);
  const activeBlock = boardBlocks.find((block) => block.id === activeId) || boardBlocks[0] || null;
  const boardMemoCount = (id) => rootBlocks.filter((block) => (block.boardId || block.sector) === id).length;
  const recentMemoBlocks = rootBlocks
    .filter((block) => (block.boardId || block.sector) !== 'project')
    .slice(-4)
    .reverse();
  const projectBlocksByStatus = PROJECT_BOARD_COLUMNS.reduce((grouped, column) => ({
    ...grouped,
    [column.id]: rootBlocks.filter((block) => (block.boardId || block.sector) === 'project' && block.status === column.id)
  }), {});
  const openContextMenu = (event, status = 'todo') => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, status, boardId: activeBoardId });
  };
  const openBlockContextMenu = (event, block) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveId(block.id);
    setContextMenu({ x: event.clientX, y: event.clientY, blockId: block.id, boardId: block.boardId || block.sector });
  };
  const createTextFileBlock = (status = 'todo', boardId = activeBoardId) => {
    setNoteContentOpen(true);
    addBlock('file', '', status, boardId, { openWindow: true });
    setContextMenu(null);
  };
  const createChecklistBlock = (status = 'todo', boardId = activeBoardId) => {
    setNoteContentOpen(true);
    addBlock('text', '', status, boardId, { openWindow: true });
    setContextMenu(null);
  };
  const renderCardTitle = (block) => {
    const title = noteBlockTitle(block);
    if (editingTitleId === block.id) {
      return (
        <input
          autoFocus
          className="memoCardName"
          value={title}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onChange={(event) => updateBlockTitle(block, event.target.value)}
          onBlur={() => setEditingTitleId('')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setEditingTitleId('');
            }
          }}
          aria-label="메모 제목"
        />
      );
    }
    return (
      <strong
        className="memoCardName memoCardNameText"
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setActiveId(block.id);
          setEditingTitleId(block.id);
        }}
      >
        {title}
      </strong>
    );
  };
  const renderMarkdownLineEditor = (block, line, index) => {
    const lineKey = `${block.id}:${index}`;
    const editing = memoActiveLine === lineKey;
    const preview = line.trim() ? <MarkdownPreview markdown={line} /> : <span className="memoBlankLine">빈 줄</span>;
    return (
      <div
        className={`memoPreviewLine ${editing ? 'editing' : ''}`}
        key={`memo-line-${block.id}-${index}`}
        onMouseEnter={() => setMemoActiveLine(lineKey)}
        onMouseLeave={(event) => {
          if (!event.currentTarget.contains(document.activeElement)) {
            setMemoActiveLine(null);
          }
        }}
      >
        {editing ? (
          <textarea
            autoFocus
            value={line}
            rows={Math.max(1, Math.min(4, Math.ceil(Math.max(line.length, 1) / 80)))}
            onChange={(event) => updateActiveBlockLine(block, index, event.target.value)}
            onFocus={() => setMemoActiveLine(lineKey)}
            onBlur={() => setMemoActiveLine(null)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                insertActiveBlockLine(block, index);
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
            aria-label={`${index + 1}번째 Markdown 줄`}
          />
        ) : (
          <div
            className="memoPreviewLineRender"
            role="button"
            tabIndex={0}
            onClick={() => setMemoActiveLine(lineKey)}
            onFocus={() => setMemoActiveLine(lineKey)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setMemoActiveLine(lineKey);
              }
            }}
          >
            {preview}
          </div>
        )}
      </div>
    );
  };
  const renderScheduleChip = (block, className = 'memoScheduleCardMeta') => {
    const schedule = normalizeNoteSchedule(block.schedule, block);
    return schedule.enabled ? (
      <small className={className}>
        <MemoNavIcon type="calendar" />
        <span>{schedule.date} {schedule.time}</span>
      </small>
    ) : null;
  };
  const renderBoardCard = (block) => (
    <article
      className={`projectTaskCard memoBoardCard ${activeId === block.id ? 'active' : ''} ${draggingBlockId === block.id ? 'dragging' : ''}`}
      key={block.id}
      style={{ left: `${block.x || 0}px`, top: `${block.y || 0}px`, width: `${block.width || 220}px`, height: `${block.height || 120}px` }}
      onMouseUp={(event) => {
        const width = Math.round(event.currentTarget.offsetWidth);
        const height = Math.round(event.currentTarget.offsetHeight);
        if (width !== block.width || height !== block.height) {
          updateBlock(block.id, { width, height });
        }
      }}
      onContextMenu={(event) => openBlockContextMenu(event, block)}
      onClick={(event) => {
        if (movedBlockRef.current) {
          event.preventDefault();
          event.stopPropagation();
          movedBlockRef.current = false;
          window.clearTimeout(movedBlockResetTimerRef.current);
          return;
        }
        beginBlockEdit(block);
      }}
    >
      <button
        type="button"
        className="memoMoveHandle"
        aria-label="블록 이동"
        title="블록 이동"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          const boardRect = freeformBoardRef.current?.getBoundingClientRect();
          const cardRect = event.currentTarget.closest('.memoBoardCard')?.getBoundingClientRect();
          window.clearTimeout(movedBlockResetTimerRef.current);
          movedBlockRef.current = false;
          setActiveId(block.id);
          setDraggingBlockId(block.id);
          setMovingBlock({
            id: block.id,
            startX: event.clientX,
            startY: event.clientY,
            baseX: block.x || 0,
            baseY: block.y || 0,
            boardWidth: boardRect?.width || 0,
            width: cardRect?.width || block.width || 0
          });
        }}
      >
        ::
      </button>
      {renderCardTitle(block)}
      {renderScheduleChip(block)}
      {block.type === 'checklist' ? (
        <small className="memoChecklistCardMeta">
          {checklistItemsFromBlock(block).filter((item) => item.checked).length}/{checklistItemsFromBlock(block).length} 완료
        </small>
      ) : null}
    </article>
  );
  const renderProjectCard = (block) => (
    <article
      className={`projectTaskCard memoProjectCard ${activeId === block.id ? 'active' : ''}`}
      key={block.id}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', block.id);
        event.dataTransfer.effectAllowed = 'move';
        setDraggingBlockId(block.id);
      }}
      onDragEnd={() => setDraggingBlockId('')}
      onContextMenu={(event) => openBlockContextMenu(event, block)}
      onClick={() => beginBlockEdit(block)}
    >
      {renderCardTitle(block)}
      {renderScheduleChip(block)}
      {block.type === 'checklist' ? (
        <small className="memoChecklistCardMeta">
          {checklistItemsFromBlock(block).filter((item) => item.checked).length}/{checklistItemsFromBlock(block).length} 완료
        </small>
      ) : null}
    </article>
  );
  const renderSchedulePicker = (block) => {
    const schedule = normalizeNoteSchedule(block.schedule, block);
    return (
      <section className={`memoSchedulePicker ${schedule.enabled ? 'enabled' : ''}`} aria-label="메모 일정">
        <label className="memoScheduleToggle">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(event) => updateBlockSchedule(block, { enabled: event.target.checked })}
          />
          <span>일정</span>
        </label>
        <div className="memoScheduleFields">
          <label>
            <span>날짜</span>
            <input
              type="date"
              value={schedule.date}
              disabled={!schedule.enabled}
              onChange={(event) => updateBlockSchedule(block, { date: event.target.value })}
            />
          </label>
          <label>
            <span>시간</span>
            <input
              type="time"
              value={schedule.time}
              disabled={!schedule.enabled}
              onChange={(event) => updateBlockSchedule(block, { time: event.target.value })}
            />
          </label>
        </div>
      </section>
    );
  };
  const renderChecklistEditor = (block) => {
    const items = checklistItemsFromBlock(block);
    const updateChecklistItems = (nextItems) => {
      updateBlock(block.id, { content: checklistContentWithItems(block, nextItems) });
    };
    return (
      <div className="memoChecklistEditor">
        {items.map((item, index) => (
          <div className="memoChecklistItem" key={`checklist-${index}`}>
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(event) => {
                const nextItems = items.map((current, itemIndex) => (itemIndex === index ? { ...current, checked: event.target.checked } : current));
                updateChecklistItems(nextItems);
              }}
            />
            <input
              value={item.text}
              onChange={(event) => {
                const nextItems = items.map((current, itemIndex) => (itemIndex === index ? { ...current, text: event.target.value } : current));
                updateChecklistItems(nextItems);
              }}
              placeholder="체크리스트 항목"
            />
            <button
              type="button"
              aria-label="항목 삭제"
              onClick={() => updateChecklistItems(items.length > 1 ? items.filter((_, itemIndex) => itemIndex !== index) : [{ checked: false, text: '' }])}
            >
              삭제
            </button>
          </div>
        ))}
        <button type="button" className="memoChecklistAdd" onClick={() => updateChecklistItems([...items, { checked: false, text: '' }])}>
          항목 추가
        </button>
      </div>
    );
  };

  return (
    <main className="aiNoteShell">
      <WorkspaceNavigator active="notes" navigate={navigate} />
      <section
        className={`aiNotePage ${workspaceMode === 'scheduler' ? 'schedulerMode' : ''}`}
        onClick={() => workspaceMode === 'board' && setContextMenu(null)}
        onContextMenu={(event) => {
          if (workspaceMode === 'board' && noteContentOpen) {
            openContextMenu(event, 'todo');
          }
        }}
      >
        {workspaceMode === 'scheduler' ? (
          <SchedulerPage navigate={navigate} embedded />
        ) : (
        <section
          className={`aiNoteBoardPanel ${memoWindowOpen ? 'memoWindowIsOpen' : ''}`}
          onContextMenu={(event) => noteContentOpen && openContextMenu(event, 'todo')}
        >
          <header className="projectTopbar">
            <div>
              <h1>메모</h1>
            </div>
            <div className="projectTopActions" aria-label="workspace actions">
              <button type="button" onClick={() => setWorkspaceMode('scheduler')} title="일정"><MemoNavIcon type="calendar" /></button>
              <button type="button" onClick={addBoard} title="보드 생성"><MemoNavIcon type="plus" /><span>보드</span></button>
            </div>
          </header>
          <section className="projectBoardHero">
            <div>
              {noteContentOpen ? (
                <div className="memoBoardTitleRow">
                  {activeBoard && editingBoardId === activeBoard.id ? (
                    <input
                      autoFocus
                      value={activeBoard.title}
                      onChange={(event) => renameBoard(activeBoard.id, event.target.value)}
                      onBlur={() => setEditingBoardId('')}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setEditingBoardId('');
                        }
                      }}
                      aria-label="현재 보드 이름"
                    />
                  ) : (
                    <button
                      type="button"
                      className="memoBoardTitleButton"
                      onDoubleClick={() => activeBoard && setEditingBoardId(activeBoard.id)}
                    >
                      {activeBoard?.title || '메모 보드'}
                    </button>
                  )}
                  {activeBoard && canDeleteMemoBoard(activeBoard) ? (
                    <button type="button" className="memoDangerButton" onClick={() => deleteBoard(activeBoard.id)}>
                      삭제
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {noteContentOpen ? (
              <div className="memoBoardCreateActions">
                <button type="button" className="projectNewItemButton ghost" onClick={() => setNoteContentOpen(false)}>보드 선택</button>
                <button type="button" className="projectNewItemButton iconAdd" onClick={() => { setNoteContentOpen(true); addBlock('text', '', 'todo', activeBoardId, { openWindow: true }); }} title="메모 생성">
                  <MemoNavIcon type="plus" /><span>새 메모</span>
                </button>
              </div>
            ) : null}
          </section>
          {noteContentOpen ? (
            <div className="memoBoardNavigator" aria-label="메모 보드 목록">
              {boards.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  className={activeBoardId === board.id ? 'active' : ''}
                  onClick={() => {
                    setActiveBoardId(board.id);
                    setEditingBlockId('');
                    setEditingTitleId('');
                    setMemoWindowOpen(false);
                  }}
                >
                  <MemoNavIcon type="board" />
                  <span>{board.title}</span>
                  <small>{boardMemoCount(board.id)}</small>
                </button>
              ))}
              <button type="button" className="memoBoardAddButton" onClick={addBoard}>
                <MemoNavIcon type="plus" />
                <span>보드</span>
              </button>
            </div>
          ) : null}
          {!noteContentOpen ? (
            <section className="notePadStart">
              <div className="notePadBoardGrid">
                {boards.map((board) => (
                  <article className="notePadBoardCard" key={board.id}>
                    <button
                      type="button"
                      className="notePadBoardOpen"
                      onClick={() => {
                        setActiveBoardId(board.id);
                        setNoteContentOpen(true);
                      }}
                    >
                      <MemoNavIcon type="board" />
                      <span>{board.title}</span>
                      <small>{rootBlocks.filter((block) => (block.boardId || block.sector) === board.id).length}</small>
                    </button>
                    {canDeleteMemoBoard(board) ? (
                      <button type="button" className="notePadBoardDelete" onClick={() => deleteBoard(board.id)}>
                        삭제
                      </button>
                    ) : null}
                  </article>
                ))}
                <button type="button" className="notePadAddBoard" onClick={addBoard}>
                  <MemoNavIcon type="plus" />
                  <span>보드 생성</span>
                  <small>+</small>
                </button>
              </div>
            </section>
          ) : (
            <>
          {activeBlock ? (
            <section
              className={`memoInlineEditor ${editingBlockId === activeBlock.id ? 'editing' : 'previewing'}`}
              onContextMenu={(event) => event.stopPropagation()}
              onDoubleClick={() => beginBlockEdit(activeBlock)}
            >
              <header>
                <div>
	                  {editingBlockId === activeBlock.id ? (
	                    <input
	                      value={noteBlockTitle(activeBlock)}
	                      onChange={(event) => updateBlockTitle(activeBlock, event.target.value)}
	                      aria-label="메모 제목"
	                    />
	                  ) : (
	                    <button type="button" className="memoInlineTitleButton" onClick={() => openBlockFile(activeBlock)}>
	                      {noteBlockTitle(activeBlock)}
	                    </button>
	                  )}
	                  {renderScheduleChip(activeBlock, 'memoScheduleInlineChip')}
	                </div>
	                <div className="memoInlineTools">
                  {editingBlockId === activeBlock.id ? (
                    <button type="button" className="active" onClick={finishBlockEdit}>완료</button>
                  ) : (
                    <button type="button" onClick={() => beginBlockEdit(activeBlock)}>수정</button>
                  )}
                  {memoWindowOpen ? (
                    <button type="button" className="memoWindowCloseButton" onClick={closeMemoWindow} aria-label="닫기" title="닫기">
                      <MemoNavIcon type="close" />
                    </button>
                  ) : null}
                  <button type="button" className="memoDangerButton compact" onClick={() => deleteBlock(activeBlock.id)}>삭제</button>
                </div>
	              </header>
	              {editingBlockId === activeBlock.id ? (
	                <div className="memoMarkdownComposer">
	                  {renderSchedulePicker(activeBlock)}
	                  {activeBlock.type === 'checklist' ? renderChecklistEditor(activeBlock) : (
                    <>
                      <div className="memoMarkdownComposerHeader">
                        <div className="memoComposerTabs" role="tablist" aria-label="메모 작성 보기">
                          <button
                            type="button"
                            role="tab"
                            aria-selected={memoComposerMode === 'edit'}
                            className={memoComposerMode === 'edit' ? 'active' : ''}
                            onClick={() => setMemoComposerMode('edit')}
                          >
                            작성
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={memoComposerMode === 'preview'}
                            className={memoComposerMode === 'preview' ? 'active' : ''}
                            onClick={() => setMemoComposerMode('preview')}
                          >
                            미리보기
                          </button>
                        </div>
                        {memoComposerMode === 'edit' ? (
                          <div className="memoMarkdownToolbar" aria-label="메모 서식">
                            <button type="button" className="memoMarkdownToolButton" onClick={() => applyMarkdownTool(activeBlock, 'bold')} aria-label="굵게" title="굵게">
                              <MemoNavIcon type="bold" />
                            </button>
                            <button type="button" className="memoMarkdownToolButton" onClick={() => applyMarkdownTool(activeBlock, 'check')} aria-label="체크박스" title="체크박스">
                              <MemoNavIcon type="checkSquare" />
                            </button>
                            <button type="button" className="memoMarkdownToolButton" onClick={() => applyMarkdownTool(activeBlock, 'list')} aria-label="목록" title="목록">
                              <MemoNavIcon type="list" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <textarea
                        className={`memoComposerEditPane ${memoComposerMode === 'edit' ? 'active' : ''}`}
                        ref={memoTextareaRef}
                        autoFocus
                        value={activeBlock.content || ''}
                        onChange={(event) => updateActiveBlockContent(activeBlock.id, event.target.value)}
                        placeholder="메모"
                      />
                      <article className={`memoInlinePreview memoComposerPreview ${memoComposerMode === 'preview' ? 'active' : ''}`}>
                        {(activeBlock.content || '').trim() ? <MarkdownPreview markdown={activeBlock.content} /> : <p>비어 있음</p>}
                      </article>
                    </>
                  )}
                </div>
              ) : (
                <article
                  className="memoInlinePreview memoReadPreview"
                  role="button"
                  tabIndex={0}
                  onClick={() => openBlockFile(activeBlock)}
                  onDoubleClick={() => beginBlockEdit(activeBlock)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      beginBlockEdit(activeBlock);
                    }
                  }}
                >
                  {(activeBlock.content || '').trim()
                    ? activeBlock.type === 'checklist'
                      ? <ChecklistPreview items={checklistItemsFromBlock(activeBlock)} />
                      : <MarkdownPreview markdown={activeBlock.content} />
                    : <p>비어 있음</p>}
                </article>
              )}
            </section>
          ) : null}
          {activeBoardId === 'project' ? (
            <section className="projectKanban" aria-label="project kanban board">
              {PROJECT_BOARD_COLUMNS.map((column) => (
                <article
                  className="projectKanbanColumn"
                  key={column.id}
                  onContextMenu={(event) => openContextMenu(event, column.id)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    moveBlockToStatus(event.dataTransfer.getData('text/plain') || draggingBlockId, column.id);
                    setDraggingBlockId('');
                  }}
                >
                  <header>
                    <div>
                      <span className="projectStatusIcon" style={{ '--status-color': column.color }}>{column.icon}</span>
                      <strong>{column.title}</strong>
                    </div>
                    <small>{projectBlocksByStatus[column.id]?.length || 0}</small>
                  </header>
                  <div className="projectTaskList">
                    {(projectBlocksByStatus[column.id] || []).map(renderProjectCard)}
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <section
              ref={freeformBoardRef}
              className="memoFreeformBoard"
              aria-label="freeform memo board"
              style={{
                minHeight: `${Math.max(520, ...boardBlocks.map((block) => (block.y || 0) + (block.height || 58) + 48))}px`
              }}
              onContextMenu={(event) => openContextMenu(event, 'todo')}
            >
              {boardBlocks.map(renderBoardCard)}
              <button
                type="button"
                className="memoBoardAddNoteTile"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setNoteContentOpen(true);
                  addBlock('text', '', 'todo', activeBoardId, { openWindow: true });
                }}
                aria-label="새 글 작성"
                title="새 글 작성"
              >
                <MemoNavIcon type="plus" />
                <span>새 글</span>
              </button>
            </section>
          )}
          {contextMenu ? (
            <div className="memoContextMenu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
              {contextMenu.blockId ? (
                <button type="button" className="dangerMenuAction" onClick={() => { deleteBlock(contextMenu.blockId); setContextMenu(null); }}>삭제</button>
              ) : (
                <>
                  <button type="button" onClick={() => { setNoteContentOpen(true); addBlock('text', '', contextMenu.status, contextMenu.boardId, { openWindow: true }); setContextMenu(null); }}>새글 작성</button>
                </>
              )}
            </div>
          ) : null}
            </>
          )}
        </section>
        )}
      </section>
    </main>
  );
}

function memoNoteExcerpt(note) {
  const text = (note?.blocks || [])
    .filter((block) => block.type !== 'divider')
    .map((block) => block.text)
    .join(' ')
    .trim();
  return text || '본문 없음';
}

function memoNoteUpdatedAt(note) {
  return note?.updatedAt || note?.createdAt || '';
}

function memoNoteTag(note, folder) {
  const schedule = normalizeNoteSchedule(note?.schedule, note);
  const planLabel = labelsForPlanType(note?.planType)[1];
  if (schedule.enabled) return `${planLabel} 일정`;
  if (note?.status === 'done') return `${planLabel} 완료`;
  if (note?.status === 'progress') return `${planLabel} 진행`;
  return planLabel || memoFolderName(folder);
}

function MemoDetail({
  note,
  folder,
  folderNotes = [],
  childFolders = [],
  breadcrumb = [],
  onTitleChange,
  onBlocksChange,
  onScheduleChange,
  onDelete,
  onCreate,
  onAddFolder,
  onSelectFolder,
  onSelectNote,
  onShare
}) {
  if (!note) {
    return (
      <section className="notesDetailPanel empty">
        <div className="notesFolderExplorer">
          <header>
            <div>
              <span>{breadcrumb.map(memoFolderName).join(' / ') || '내 워크스페이스'}</span>
              <strong>{memoFolderName(folder)}</strong>
            </div>
            <div>
              <button type="button" onClick={onAddFolder}><MemoNavIcon type="folder" />하위 폴더</button>
            </div>
          </header>
          <div className="notesFolderExplorerGrid">
            {childFolders.map((child) => (
              <button type="button" className="notesFolderExplorerItem folder" key={child.id} onClick={() => onSelectFolder(child.id)}>
                <MemoNavIcon type="folder" />
                <span>
                  <strong>{memoFolderName(child)}</strong>
                  <small>폴더 열기</small>
                </span>
              </button>
            ))}
            {folderNotes.map((item) => (
              <button type="button" className="notesFolderExplorerItem file" key={item.id} onClick={() => onSelectNote(item.id)}>
                <MemoNavIcon type="file" />
                <span>
                  <strong>{noteBlockTitle(item)}</strong>
                  <small>{memoNoteUpdatedAt(item) || '최근 수정'} · 메모</small>
                </span>
              </button>
            ))}
          </div>
          {!childFolders.length && !folderNotes.length ? (
            <div className="notesEmptyState large">
              <strong>{memoFolderName(folder)} 폴더가 비어 있습니다</strong>
              <span>하위 폴더를 만들거나 메모를 새로 작성하세요.</span>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="notesDetailPanel" aria-label="메모 상세">
      <header className="notesDetailCrumbs">
        <span>{breadcrumb.map(memoFolderName).join(' / ') || memoFolderName(folder)}</span>
        <strong>편집</strong>
      </header>
      <div className="notesDetailTopbar">
        <input
          className="notesTitleHeaderInput"
          value={noteBlockTitle(note)}
          onChange={(event) => onTitleChange(event.target.value)}
          aria-label="메모 제목"
        />
        <NotesScheduleBar schedule={normalizeNoteSchedule(note?.schedule, note)} onScheduleChange={onScheduleChange} onDelete={onDelete} onShare={onShare} />
      </div>
      <article className="notesDocument blockNoteDocument">
        <Suspense fallback={<div className="blockNoteLoading">에디터를 준비하고 있습니다.</div>}>
          <LazyBlockNoteMemoEditor
            key={note.id}
            blocks={note.blocks}
            blockNoteDocument={note.blockNoteDocument}
            onChange={onBlocksChange}
          />
        </Suspense>
      </article>
    </section>
  );
}

function NotionNotesPage({ navigate }) {
  const session = readStoredAuth();
  const noteBlocksKey = noteBlocksStorageKey(session);
  const noteBoardsKey = noteBoardsStorageKey(session);
  const routeTargetRef = useRef({
    applied: false,
    folderId: new URLSearchParams(window.location.search).get('board') || '',
    noteId: new URLSearchParams(window.location.search).get('block') || ''
  });
  const [folders, setFolders] = useState(() => readMemoBoards(session));
  const [notes, setNotes] = useState(() => readNoteBlocks(session));
  const [activeFolderId, setActiveFolderId] = useState(normalizeMemoFolderId(routeTargetRef.current.folderId || 'personal'));
  const [activeId, setActiveId] = useState(routeTargetRef.current.noteId || '');
  const [mobileView, setMobileView] = useState(routeTargetRef.current.noteId ? 'detail' : 'folders');
  const [statusText, setStatusText] = useState('');
  const [mobileExplorerMenuId, setMobileExplorerMenuId] = useState('');
  const [notesSidebarCollapsed, setNotesSidebarCollapsed] = useState(false);
  const [notesDialog, setNotesDialog] = useState(null);

  useEffect(() => {
    document.title = '메모';
  }, []);

  useEffect(() => {
    if (!session?.token || session.isGuest || session.username === 'guestuser') return undefined;
    let cancelled = false;
    loadWorkspaceMemoBlocks(session.token).then((workspaceNotes) => {
      if (cancelled || !workspaceNotes.length) return;
      setNotes((current) => {
        const merged = mergeNoteBlocks(current, workspaceNotes);
        if (merged.length === current.length) return current;
        setStatusText(`서버 workspace에서 메모 ${merged.length - current.length}개를 복구했습니다.`);
        return merged;
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.token, session?.username]);

  useEffect(() => {
    localStorage.setItem(noteBlocksKey, JSON.stringify(notes));
    localStorage.removeItem(AI_NOTE_KEY);
    window.dispatchEvent(new CustomEvent('codex:notes-updated', { detail: { storageKey: noteBlocksKey } }));
    syncNoteSchedules(notes);
  }, [notes, noteBlocksKey]);

  useEffect(() => {
    localStorage.setItem(noteBoardsKey, JSON.stringify(folders));
    localStorage.removeItem(AI_NOTE_BOARDS_KEY);
    window.dispatchEvent(new CustomEvent('codex:notes-updated', { detail: { storageKey: noteBoardsKey } }));
  }, [folders, noteBoardsKey]);

  useEffect(() => {
    if (session?.username !== 'admin1') return;
    setFolders(defaultMemoBoards());
    setNotes((current) => {
      const existingIds = new Set(current.map((note) => note.id));
      const missingTasks = ADMIN1_BOARD_TASKS.filter((task) => !existingIds.has(task.id));
      const missingLogs = ADMIN1_MEMO_LOGS.filter((memo) => !existingIds.has(memo.id));
      if (!missingTasks.length && !missingLogs.length) return current;
      return [
        ...missingTasks.map((task, index) => normalizeNoteBlock({
          id: task.id,
          type: 'text',
          title: task.title,
          content: `# ${task.title}\n\n- [ ] 진행 상태 확인\n- [ ] 운영 화면 확인`,
          sector: 'personal',
          boardId: 'personal',
          status: task.status,
          parentId: '',
          filePath: `memo-files/admin1/${task.id}.md`,
          sortOrder: index
        })),
        ...missingLogs.map((memo, index) => normalizeNoteBlock({
          id: memo.id,
          type: 'text',
          content: memo.content,
          sector: 'personal',
          boardId: 'personal',
          status: 'done',
          parentId: '',
          filePath: `memo-files/admin1/${memo.id}.md`,
          sortOrder: index
        })),
        ...current
      ];
    });
  }, [session?.username]);

  useEffect(() => {
    const existingIds = new Set(folders.map((folder) => folder.id));
    const missingFolderIds = Array.from(new Set(notes
      .map(memoFolderIdForNote)
      .filter((folderId) => folderId && !existingIds.has(folderId))));
    if (!missingFolderIds.length) return;
    const createdAt = memoTimestamp();
    setFolders((current) => [
      ...current,
      ...missingFolderIds.map((folderId, index) => ({
        id: folderId,
        parentId: DEFAULT_MEMO_BOARD_ID_SET.has(folderId) ? null : 'personal',
        name: folderId === 'travel' ? '여행' : folderId === 'personal' ? '개인' : folderId,
        title: folderId === 'travel' ? '여행' : folderId === 'personal' ? '개인' : folderId,
        sortOrder: current.length + index,
        createdAt,
        updatedAt: createdAt
      }))
    ]);
  }, [folders, notes]);

  useEffect(() => {
    if (!folders.some((folder) => folder.id === activeFolderId)) {
      setActiveFolderId(folders.find((folder) => folder.id === 'personal')?.id || folders[0]?.id || '');
    }
  }, [activeFolderId, folders]);

  useEffect(() => {
    const folderNotes = notes.filter((note) => memoFolderIdForNote(note) === activeFolderId && !note.parentId);
    if (activeId && !folderNotes.some((note) => note.id === activeId)) {
      setActiveId('');
    }
  }, [activeFolderId, activeId, notes]);

  useEffect(() => {
    const target = routeTargetRef.current;
    if (target.applied || !target.noteId) return;
    const targetNote = notes.find((note) => note.id === target.noteId);
    if (!targetNote) return;
    target.applied = true;
    setActiveFolderId(normalizeMemoFolderId(target.folderId || memoFolderIdForNote(targetNote), targetNote.planType));
    setActiveId(targetNote.id);
    setMobileView('detail');
  }, [notes]);

  const activeFolder = folders.find((folder) => folder.id === activeFolderId) || folders[0] || null;
  const folderNotes = notes
    .filter((note) => memoFolderIdForNote(note) === activeFolderId && !note.parentId)
    .slice()
    .sort((left, right) => (memoNoteUpdatedAt(right) || '').localeCompare(memoNoteUpdatedAt(left) || ''));
  const activeNote = folderNotes.find((note) => note.id === activeId) || null;
  const noteCounts = notes.reduce((counts, note) => {
    const folderId = memoFolderIdForNote(note);
    counts[folderId] = (counts[folderId] || 0) + 1;
    return counts;
  }, {});
  const breadcrumb = memoFolderPath(folders, activeFolderId);
  const isGuestSession = !session || session.isGuest || session.username === 'guestuser';
  const accountName = isGuestSession ? 'Guest' : session.username;
  const accountPath = isGuestSession ? loginUrlForCurrentLocation('/notes') : '/mypage';
  const accountLabel = isGuestSession ? '로그인' : '내 정보';
  const accountInitial = accountName.slice(0, 1).toUpperCase();
  const primaryMemoFolderId = folders.find((folder) => folder.id === 'personal')?.id || activeFolderId || folders[0]?.id || 'personal';
  const mobileFolder = activeFolder || folders.find((folder) => folder.id === primaryMemoFolderId) || folders[0] || null;
  const mobileFolderId = mobileFolder?.id || '';
  const mobileParentFolder = mobileFolder?.parentId ? folders.find((folder) => folder.id === mobileFolder.parentId) || null : null;
  const mobileFolderPath = memoFolderPath(folders, mobileFolderId);
  const mobilePathLabel = mobileFolderPath.length ? mobileFolderPath.map(memoFolderName).join(' / ') : '메모';
  const mobileChildFolders = memoFolderChildren(folders, mobileFolderId || null);
  const mobileFiles = notes
    .filter((note) => memoFolderIdForNote(note) === mobileFolderId && !note.parentId)
    .slice()
    .sort((left, right) => noteBlockTitle(left).localeCompare(noteBlockTitle(right), 'ko'));
  const mobileRootFolders = folders.filter((folder) => DEFAULT_MEMO_BOARD_ID_SET.has(folder.id));

  const replaceNotesRoute = (folderId = activeFolderId, noteId = '') => {
    const params = new URLSearchParams();
    const normalizedFolderId = normalizeMemoFolderId(folderId || 'personal');
    if (normalizedFolderId) params.set('board', normalizedFolderId);
    if (noteId) params.set('block', noteId);
    window.history.replaceState({}, '', params.toString() ? `/notes?${params.toString()}` : '/notes');
  };

  const updateNote = (id, updater) => {
    setNotes((current) => current.map((note) => {
      if (note.id !== id) return note;
      const patch = typeof updater === 'function' ? updater(note) : updater;
      const next = { ...note, ...patch, updatedAt: memoTimestamp() };
      const title = typeof next.title === 'string' && next.title.trim() ? next.title.trim() : noteBlockTitle(next);
      const bodyBlocks = Array.isArray(next.blocks) && next.blocks.length ? next.blocks.map(normalizeMemoEditorBlock) : [newMemoEditorBlock('paragraph')];
      const schedule = normalizeNoteSchedule(next.schedule, next);
      const folderId = normalizeMemoFolderId(next.folderId || next.boardId || next.sector || 'personal', next.planType);
      return {
        ...next,
        title,
        blocks: bodyBlocks,
        content: memoContentFromTitleAndBlocks(title, bodyBlocks),
        folderId,
        boardId: folderId,
        sector: folderId,
        schedule,
        scheduleEnabled: schedule.enabled,
        scheduleDate: schedule.date,
        scheduleTime: schedule.time
      };
    }));
  };

  const addFolder = (parentId = null) => {
    const targetParentId = normalizeMemoFolderId(parentId || activeFolderId || 'personal');
    const siblings = memoFolderChildren(folders, targetParentId);
    const createdAt = memoTimestamp();
    const nextFolder = {
      id: `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      parentId: targetParentId,
      name: '새 폴더',
      title: '새 폴더',
      sortOrder: siblings.length,
      createdAt,
      updatedAt: createdAt
    };
    setFolders((current) => [...current, nextFolder]);
    setActiveFolderId(nextFolder.id);
    setActiveId('');
    setMobileExplorerMenuId('');
    setMobileView('folders');
    replaceNotesRoute(nextFolder.id);
    setStatusText('새 폴더를 만들었습니다.');
  };

  const renameFolder = (id, name) => {
    setFolders((current) => current.map((folder) => (folder.id === id ? { ...folder, name, title: name, updatedAt: memoTimestamp() } : folder)));
  };

  const performDeleteFolder = (id) => {
    const target = folders.find((folder) => folder.id === id);
    if (!canDeleteMemoBoard(target)) {
      setStatusText('기본 폴더는 삭제하지 않습니다.');
      return;
    }
    const deleteIds = memoFolderDescendantIds(folders, id);
    const fallbackFolder = (target?.parentId && folders.find((folder) => folder.id === target.parentId))
      || folders.find((folder) => folder.id === 'personal' && !deleteIds.has(folder.id))
      || folders.find((folder) => !deleteIds.has(folder.id))
      || null;
    setFolders((current) => current.filter((folder) => !deleteIds.has(folder.id)));
    setNotes((current) => current.filter((note) => !deleteIds.has(memoFolderIdForNote(note))));
    setActiveFolderId(fallbackFolder?.id || '');
    setActiveId('');
    setMobileExplorerMenuId('');
    setMobileView('folders');
    replaceNotesRoute(fallbackFolder?.id || '');
    setStatusText('폴더를 삭제했습니다.');
  };

  const deleteFolder = (id) => {
    const target = folders.find((folder) => folder.id === id);
    if (!canDeleteMemoBoard(target)) {
      setStatusText('기본 폴더는 삭제하지 않습니다.');
      return;
    }
    setNotesDialog({
      type: 'delete-folder',
      folderId: id,
      title: '폴더 삭제',
      message: `${memoFolderName(target)} 폴더와 안의 메모를 삭제할까요?`
    });
  };

  const createNote = (folderId = activeFolderId) => {
    folderId = normalizeMemoFolderId(folderId || 'personal');
    const title = '새 메모';
    const bodyBlocks = [newMemoEditorBlock('paragraph')];
    const nextNote = normalizeNoteBlock({
      id: `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'text',
      title,
      blocks: bodyBlocks,
      content: memoContentFromTitleAndBlocks(title, bodyBlocks),
      folderId,
      sector: folderId,
      boardId: folderId,
      status: 'todo',
      parentId: '',
      filePath: `memo-files/${folderId}/note-${Date.now()}.md`,
      createdAt: memoTimestamp(),
      updatedAt: memoTimestamp()
    });
    setNotes((current) => [nextNote, ...current]);
    setActiveFolderId(folderId);
    setActiveId(nextNote.id);
    setMobileExplorerMenuId('');
    setMobileView('detail');
    replaceNotesRoute(folderId, nextNote.id);
    setStatusText('새 메모를 만들었습니다.');
  };

  const performDeleteNote = (id = activeNote?.id) => {
    if (!id) return;
    const target = notes.find((note) => note.id === id);
    const folderId = target ? memoFolderIdForNote(target) : activeFolderId;
    setNotes((current) => current.filter((note) => note.id !== id));
    setActiveId('');
    setMobileExplorerMenuId('');
    setMobileView('folders');
    replaceNotesRoute(folderId);
    setStatusText('메모를 삭제했습니다.');
  };

  const deleteNote = (id = activeNote?.id) => {
    if (!id) return;
    const target = notes.find((note) => note.id === id);
    setNotesDialog({
      type: 'delete-note',
      noteId: id,
      title: '메모 삭제',
      message: `${noteBlockTitle(target)} 메모를 삭제할까요?`
    });
  };

  const updateSchedule = (patch) => {
    if (!activeNote) return;
    const current = normalizeNoteSchedule(activeNote.schedule, activeNote);
    updateNote(activeNote.id, {
      schedule: {
        ...current,
        ...patch,
        enabled: Object.prototype.hasOwnProperty.call(patch, 'enabled') ? Boolean(patch.enabled) : current.enabled,
        date: isDateKey(patch.date) ? patch.date : current.date,
        time: isTimeKey(patch.time) ? patch.time : current.time
      }
    });
  };

  const selectFolder = (folderId) => {
    folderId = normalizeMemoFolderId(folderId || 'personal');
    setActiveFolderId(folderId);
    setActiveId('');
    setMobileExplorerMenuId('');
    setMobileView('folders');
    replaceNotesRoute(folderId);
  };

  const selectNote = (noteId) => {
    setActiveId(noteId);
    setMobileExplorerMenuId('');
    setMobileView('detail');
    const targetNote = notes.find((note) => note.id === noteId);
    replaceNotesRoute(targetNote ? memoFolderIdForNote(targetNote) : activeFolderId, noteId);
  };

  const openMobileFolder = (folderId) => {
    folderId = normalizeMemoFolderId(folderId || 'personal');
    setActiveFolderId(folderId);
    setActiveId('');
    setMobileExplorerMenuId('');
    setMobileView('folders');
    replaceNotesRoute(folderId);
  };

  const renameFolderFromMenu = (folder) => {
    setMobileExplorerMenuId('');
    setNotesDialog({
      type: 'rename-folder',
      folderId: folder.id,
      title: '폴더 이름 변경',
      label: '폴더 이름',
      value: memoFolderName(folder)
    });
  };

  const renameNoteFromTree = (note) => {
    setMobileExplorerMenuId('');
    setNotesDialog({
      type: 'rename-note',
      noteId: note.id,
      title: '메모 이름 변경',
      label: '메모 이름',
      value: noteBlockTitle(note)
    });
  };

  const deleteNoteFromTree = (note) => {
    if (!note) return;
    setMobileExplorerMenuId('');
    deleteNote(note.id);
  };

  const toggleMobileExplorerMenu = (menuId) => {
    setMobileExplorerMenuId((current) => (current === menuId ? '' : menuId));
  };

  const renderMobileExplorerFolder = (folder) => {
    const menuId = `folder:${folder.id}`;
    const menuOpen = mobileExplorerMenuId === menuId;
    return (
      <div className={`notesMobileExplorerRow folder ${menuOpen ? 'menuOpen' : ''}`} key={folder.id}>
        <button type="button" className="notesMobileExplorerOpen" onClick={() => openMobileFolder(folder.id)}>
          <MemoNavIcon type="folder" />
          <span>
            <strong>{memoFolderName(folder)}</strong>
            <small>{noteCounts[folder.id] || 0}개 메모</small>
          </span>
          <MemoNavIcon type="chevronRight" />
        </button>
        {canDeleteMemoBoard(folder) ? (
          <button
            type="button"
            className="notesMobileExplorerGear"
            onClick={() => toggleMobileExplorerMenu(menuId)}
            aria-label={`${memoFolderName(folder)} 설정`}
            aria-expanded={menuOpen}
          >
            <MemoNavIcon type="settings" />
          </button>
        ) : null}
        {menuOpen ? (
          <div className="notesMobileExplorerMenu" aria-label={`${memoFolderName(folder)} 폴더 작업`}>
            <button type="button" onClick={() => renameFolderFromMenu(folder)}><MemoNavIcon type="edit" />이름 변경</button>
            {canDeleteMemoBoard(folder) ? (
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setMobileExplorerMenuId('');
                  deleteFolder(folder.id);
                }}
              >
                <MemoNavIcon type="trash" />삭제
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderMobileExplorerFile = (note) => {
    const menuId = `note:${note.id}`;
    const menuOpen = mobileExplorerMenuId === menuId;
    return (
      <div className={`notesMobileExplorerRow file ${activeId === note.id ? 'active' : ''} ${menuOpen ? 'menuOpen' : ''}`} key={note.id}>
        <button
          type="button"
          className={`notesMobileExplorerOpen file ${activeId === note.id ? 'active' : ''}`}
          onClick={() => {
            setActiveFolderId(memoFolderIdForNote(note));
            selectNote(note.id);
          }}
        >
          <MemoNavIcon type="file" />
          <span>
            <strong>{noteBlockTitle(note)}</strong>
            <small>{memoNoteUpdatedAt(note) || '최근 수정'}</small>
          </span>
          {activeId === note.id ? <b className="notesMobileSelectionBadge file">열림</b> : null}
        </button>
        <button
          type="button"
          className="notesMobileExplorerGear"
          onClick={() => toggleMobileExplorerMenu(menuId)}
          aria-label={`${noteBlockTitle(note)} 설정`}
          aria-expanded={menuOpen}
        >
          <MemoNavIcon type="settings" />
        </button>
        {menuOpen ? (
          <div className="notesMobileExplorerMenu" aria-label={`${noteBlockTitle(note)} 메모 작업`}>
            <button type="button" onClick={() => renameNoteFromTree(note)}><MemoNavIcon type="edit" />이름 변경</button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                setMobileExplorerMenuId('');
                deleteNoteFromTree(note);
              }}
            >
              <MemoNavIcon type="trash" />삭제
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  const renderMobileHeader = () => (
    <header className="notesMobileHeader">
      {mobileView === 'folders' ? (
        <button type="button" onClick={() => navigate('/app')}><MemoNavIcon type="chevronLeft" />홈</button>
      ) : (
        <button type="button" onClick={() => setMobileView('folders')}><MemoNavIcon type="chevronLeft" />뒤로</button>
      )}
      <div>
        <span>{breadcrumb.map(memoFolderName).join(' / ') || '메모'}</span>
        <strong>{mobileView === 'detail' && activeNote ? noteBlockTitle(activeNote) : mobileView === 'list' ? memoFolderName(activeFolder) : '폴더'}</strong>
      </div>
    </header>
  );

  const shareActiveNote = () => {
    if (!activeNote) return;
    const shareUrl = `${window.location.origin}/notes?board=${encodeURIComponent(memoFolderIdForNote(activeNote))}&block=${encodeURIComponent(activeNote.id)}`;
    if (navigator.share) {
      navigator.share({ title: noteBlockTitle(activeNote), url: shareUrl }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(shareUrl);
    setStatusText('메모 링크를 복사했습니다.');
  };

  const submitNotesDialog = (event) => {
    event.preventDefault();
    if (!notesDialog) return;
    if (notesDialog.type === 'rename-folder') {
      const nextName = notesDialog.value.trim();
      if (!nextName) return;
      renameFolder(notesDialog.folderId, nextName);
      setStatusText('폴더 이름을 변경했습니다.');
    } else if (notesDialog.type === 'rename-note') {
      const nextTitle = notesDialog.value.trim();
      if (!nextTitle) return;
      updateNote(notesDialog.noteId, { title: nextTitle });
      setStatusText('메모 이름을 변경했습니다.');
    } else if (notesDialog.type === 'delete-folder') {
      performDeleteFolder(notesDialog.folderId);
    } else if (notesDialog.type === 'delete-note') {
      performDeleteNote(notesDialog.noteId);
    }
    setNotesDialog(null);
  };

  return (
    <MobilePageShell
      activeTab="notes"
      className="aiNoteShell notesShell"
      hideBottomNav={mobileView === 'detail'}
      icon="board"
      navigate={navigate}
      onBack={mobileView === 'detail' ? () => {
        setMobileView('folders');
        setMobileExplorerMenuId('');
      } : undefined}
      profile={{
        name: accountName,
        label: accountLabel,
        onClick: () => {
          if (accountPath.startsWith('http://') || accountPath.startsWith('https://')) {
            window.location.assign(accountPath);
            return;
          }
          navigate(accountPath);
        }
      }}
      subtitle={mobileView === 'detail' && activeNote ? noteBlockTitle(activeNote) : memoFolderName(mobileFolder)}
      title="메모"
    >
      <section className="notesWorkspace" aria-label="메모 작업 화면">
        <div className={`notesDesktopLayout ${notesSidebarCollapsed ? 'sidebarCollapsed' : ''}`}>
          <aside className="notesSidebarRail" aria-label="메모 사이드바">
            <button
              type="button"
              className="notesSidebarToggle"
              onClick={() => setNotesSidebarCollapsed((current) => !current)}
              aria-label={notesSidebarCollapsed ? '폴더 탐색기 펼치기' : '폴더 탐색기 접기'}
              title={notesSidebarCollapsed ? '폴더 탐색기 펼치기' : '폴더 탐색기 접기'}
            >
              <MemoNavIcon type={notesSidebarCollapsed ? 'chevronRight' : 'chevronLeft'} />
            </button>
          </aside>
          {!notesSidebarCollapsed ? (
            <SidebarFolderTree
              folders={folders}
              activeFolderId={activeFolderId}
              noteCounts={noteCounts}
              onSelect={selectFolder}
              onAddFolder={addFolder}
              onCreateNote={createNote}
              onRenameFolder={renameFolder}
              onDeleteFolder={deleteFolder}
              getFolderChildren={memoFolderChildren}
              getFolderName={memoFolderName}
              canDeleteFolder={canDeleteMemoBoard}
            />
          ) : null}
          <MemoList
            folder={activeFolder}
            notes={folderNotes}
            activeId={activeNote?.id || ''}
            onSelect={selectNote}
            onCreate={() => createNote(activeFolderId)}
            onDelete={deleteNote}
            getTitle={noteBlockTitle}
            getExcerpt={memoNoteExcerpt}
            getUpdatedAt={memoNoteUpdatedAt}
            getTag={memoNoteTag}
            getFolderName={memoFolderName}
          />
          <MemoDetail
            note={activeNote}
            folder={activeFolder}
            folderNotes={folderNotes}
            childFolders={memoFolderChildren(folders, activeFolderId)}
            breadcrumb={breadcrumb}
            onTitleChange={(title) => activeNote && updateNote(activeNote.id, { title })}
            onBlocksChange={(bodyBlocks, blockNoteDocument) => activeNote && updateNote(activeNote.id, { blocks: bodyBlocks, blockNoteDocument })}
            onScheduleChange={updateSchedule}
            onDelete={() => deleteNote(activeNote?.id)}
            onCreate={() => createNote(activeFolderId)}
            onAddFolder={() => addFolder(activeFolderId)}
            onSelectFolder={selectFolder}
            onSelectNote={selectNote}
            onShare={shareActiveNote}
          />
        </div>

        <div className={`notesMobileWorkspace view-${mobileView}`}>
          {mobileView === 'folders' ? (
            <section className="notesMobileFolders">
              <section className="notesMobileContentSection notesMobileFileSection" id="notes-mobile-folder-section" aria-label="메모">
                <div className="notesMobileDirectorySwitch" aria-label="메모 탭">
                  {mobileRootFolders.map((folder) => (
                    <button
                      type="button"
                      key={folder.id}
                      className={mobileFolderId === folder.id ? 'active' : ''}
                      onClick={() => openMobileFolder(folder.id)}
                    >
                      <MemoNavIcon type="folder" />
                      {memoFolderName(folder)}
                    </button>
                  ))}
                </div>
                <div className="notesMobileCurrentActions" aria-label={`${mobilePathLabel} 폴더 작업`}>
                  <button type="button" className="primary" onClick={() => createNote(mobileFolderId || primaryMemoFolderId)}><MemoNavIcon type="plus" />새 메모</button>
                  <button type="button" onClick={() => addFolder(mobileFolderId || primaryMemoFolderId)}><MemoNavIcon type="folder" />새 폴더</button>
                </div>
                <div className="notesMobilePathBar" aria-label="현재 경로">
                  {mobileParentFolder ? (
                    <button type="button" className="notesMobilePathBack" onClick={() => openMobileFolder(mobileParentFolder.id)}>
                      <MemoNavIcon type="chevronLeft" />상위
                    </button>
                  ) : null}
                  <span className="notesMobilePathText">{mobilePathLabel}</span>
                </div>
                <div className="notesMobileSectionLabel">
                  <strong>폴더 목록</strong>
                  <small>{mobileChildFolders.length}개</small>
                </div>
                <div className="notesMobileExplorerList">
                  {mobileChildFolders.map(renderMobileExplorerFolder)}
                  {!mobileChildFolders.length ? (
                    <article className="notesMobileEmptyState compact">
                      <strong>하위 폴더가 없습니다.</strong>
                      <span>새 폴더를 만들어 메모를 나눠보세요.</span>
                    </article>
                  ) : null}
                </div>
                <div className="notesMobileSectionLabel">
                  <strong>메모 목록</strong>
                  <small>{mobileFiles.length}개</small>
                </div>
                <div className="notesMobileExplorerList">
                  {mobileFiles.map(renderMobileExplorerFile)}
                  {!mobileFiles.length ? (
                    <article className="notesMobileEmptyState compact">
                      <strong>메모가 없습니다.</strong>
                      <span>+ 새 메모로 바로 작성하세요.</span>
                    </article>
                  ) : null}
                </div>
              </section>
            </section>
          ) : null}
          {mobileView === 'list' ? (
            <section className="notesMobileList">
              <MemoList
                folder={activeFolder}
                notes={folderNotes}
                activeId={activeNote?.id || ''}
                onSelect={selectNote}
                onCreate={() => createNote(activeFolderId)}
                onDelete={deleteNote}
                getTitle={noteBlockTitle}
                getExcerpt={memoNoteExcerpt}
                getUpdatedAt={memoNoteUpdatedAt}
                getTag={memoNoteTag}
                getFolderName={memoFolderName}
              />
            </section>
          ) : null}
          {mobileView === 'detail' ? (
            <section className="notesMobileDetail">
              <MemoDetail
                note={activeNote}
                folder={activeFolder}
                breadcrumb={breadcrumb}
                onTitleChange={(title) => activeNote && updateNote(activeNote.id, { title })}
                onBlocksChange={(bodyBlocks, blockNoteDocument) => activeNote && updateNote(activeNote.id, { blocks: bodyBlocks, blockNoteDocument })}
                onScheduleChange={updateSchedule}
                onDelete={() => deleteNote(activeNote?.id)}
                onCreate={() => createNote(activeFolderId)}
                onShare={shareActiveNote}
              />
            </section>
          ) : null}
        </div>
        {notesDialog ? (
          <div className="appDialogBackdrop" role="presentation" onMouseDown={() => setNotesDialog(null)}>
            <form
              className="appDialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="notes-action-dialog-title"
              onSubmit={submitNotesDialog}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header>
                <strong id="notes-action-dialog-title">{notesDialog.title}</strong>
                <button type="button" onClick={() => setNotesDialog(null)} aria-label="닫기">
                  <MemoNavIcon type="close" />
                </button>
              </header>
              {notesDialog.type?.startsWith('rename') ? (
                <label className="appDialogField">
                  <span>{notesDialog.label}</span>
                  <input
                    value={notesDialog.value}
                    onChange={(event) => setNotesDialog((current) => ({ ...current, value: event.target.value }))}
                    autoFocus
                  />
                </label>
              ) : (
                <p>{notesDialog.message}</p>
              )}
              <div className="appDialogActions">
                <button type="button" className="appDialogSecondary" onClick={() => setNotesDialog(null)}>취소</button>
                <button type="submit" className={notesDialog.type?.startsWith('delete') ? 'appDialogDanger' : 'appDialogPrimary'}>
                  {notesDialog.type?.startsWith('delete') ? '삭제' : '저장'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
        {statusText ? <p className="notesStatusText">{statusText}</p> : null}
      </section>
    </MobilePageShell>
  );
}

function SchedulerPage({ navigate, embedded = false }) {
  const session = readStoredAuth();
  const schedulerTitle = session?.username && session.username !== 'guestuser' ? `${session.username}님의 일정` : '내 일정';
  const schedulerKey = schedulerStorageKey(session);
  const [items, setItems] = useState(() => readCurrentSchedulerItems(session));
  const memberSchedulerSession = Boolean(session?.token && !session.isGuest && session.username !== 'guestuser');
  const [workspaceSchedulerLoaded, setWorkspaceSchedulerLoaded] = useState(!memberSchedulerSession);
  const [filter, setFilter] = useState('전체');
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [calendarMonth, setCalendarMonth] = useState(toDateKey(new Date()).slice(0, 7));
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: '',
    date: toDateKey(new Date()),
    time: '09:00',
    type: '개인',
    recurrence: 'none',
    recurrenceEnd: '',
    memo: ''
  });
  const [schedulerDeleteTarget, setSchedulerDeleteTarget] = useState(null);

  useEffect(() => {
    if (!embedded) {
      document.title = 'AI 개인 스케줄러';
    }
  }, [embedded]);

  useEffect(() => {
    setWorkspaceSchedulerLoaded(!memberSchedulerSession);
    if (!memberSchedulerSession) return undefined;
    let cancelled = false;
    loadWorkspaceSchedulerItems(session.token).then((workspaceItems) => {
      if (cancelled) return;
      if (workspaceItems.length) {
        setItems((current) => mergeSchedulerItems(current, workspaceItems));
      }
      setWorkspaceSchedulerLoaded(true);
    }).catch(() => {
      if (!cancelled) setWorkspaceSchedulerLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [memberSchedulerSession, session?.token, session?.username]);

  useEffect(() => {
    localStorage.setItem(schedulerKey, JSON.stringify(items));
    if (localStorage.getItem(SCHEDULER_KEY)) {
      localStorage.removeItem(SCHEDULER_KEY);
    }
    if (!memberSchedulerSession || !workspaceSchedulerLoaded) return undefined;
    const saveTimer = window.setTimeout(() => {
      saveWorkspaceSchedulerItems(session.token, items).catch(() => {});
    }, 500);
    return () => window.clearTimeout(saveTimer);
  }, [items, schedulerKey, memberSchedulerSession, workspaceSchedulerLoaded, session?.token]);

  useEffect(() => {
    const syncItems = () => setItems(readCurrentSchedulerItems(session));
    const handleStorage = (event) => {
      if (event.key === schedulerKey || event.key === SCHEDULER_KEY) {
        syncItems();
      }
    };
    const handleSchedulerUpdate = (event) => {
      if (!event.detail?.storageKey || event.detail.storageKey === schedulerKey) {
        syncItems();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('codex:scheduler-items-updated', handleSchedulerUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('codex:scheduler-items-updated', handleSchedulerUpdate);
    };
  }, [schedulerKey, session?.username]);

  const today = toDateKey(new Date());
  const monthDays = useMemo(() => buildMonthDays(calendarMonth), [calendarMonth]);
  const currentMonth = today.slice(0, 7);
  const weekDays = useMemo(() => buildWeekDays(today), [today]);
  const weekRangeLabel = `${formatDateLabel(weekDays[0].key)} - ${formatDateLabel(weekDays[6].key)}`;
  const monthScheduleDays = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    const lastDate = new Date(year, month, 0).getDate();
    return Array.from({ length: lastDate }, (_, index) => {
      const date = new Date(year, month - 1, index + 1);
      return {
        key: toDateKey(date),
        dayNumber: index + 1,
        weekday: ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
      };
    });
  }, [currentMonth]);
  const scheduleDateKeys = useMemo(() => [
    selectedDate,
    today,
    ...monthDays.map((day) => day.key),
    ...weekDays.map((day) => day.key),
    ...monthScheduleDays.map((day) => day.key)
  ], [selectedDate, today, monthDays, weekDays, monthScheduleDays]);
  const expandedItems = useMemo(() => expandSchedulerItemsForDates(items, scheduleDateKeys), [items, scheduleDateKeys]);
  const todayItems = expandedItems
    .filter((item) => item.date === today)
    .slice()
    .sort((left, right) => schedulerSortKey(left).localeCompare(schedulerSortKey(right)));
  const pendingItems = expandedItems.filter((item) => !item.done);
  const doneItems = expandedItems.filter((item) => item.done);
  const completionRate = expandedItems.length ? Math.round((doneItems.length / expandedItems.length) * 100) : 0;
  const todayDoneCount = todayItems.filter((item) => item.done).length;
  const todayCompletionRate = todayItems.length ? Math.round((todayDoneCount / todayItems.length) * 100) : 0;
  const itemCountByDate = useMemo(() => expandedItems.reduce((counts, item) => {
    counts[item.date] = (counts[item.date] || 0) + 1;
    return counts;
  }, {}), [expandedItems]);
  const itemsByDate = useMemo(() => expandedItems.reduce((groups, item) => {
    groups[item.date] = [...(groups[item.date] || []), item];
    return groups;
  }, {}), [expandedItems]);
  const todayTimeline = useMemo(() => [
    { key: 'all-day', label: '종일', range: '날짜 기준', items: todayItems.filter((item) => !schedulerTimeValue(item)) },
    { key: 'morning', label: '오전', range: '06:00 - 11:59', items: todayItems.filter((item) => Number(schedulerTimeValue(item).slice(0, 2)) >= 6 && Number(schedulerTimeValue(item).slice(0, 2)) < 12) },
    { key: 'afternoon', label: '오후', range: '12:00 - 17:59', items: todayItems.filter((item) => Number(schedulerTimeValue(item).slice(0, 2)) >= 12 && Number(schedulerTimeValue(item).slice(0, 2)) < 18) },
    { key: 'evening', label: '저녁', range: '18:00 - 23:59', items: todayItems.filter((item) => Number(schedulerTimeValue(item).slice(0, 2)) >= 18) },
    { key: 'early', label: '새벽', range: '00:00 - 05:59', items: todayItems.filter((item) => schedulerTimeValue(item) && Number(schedulerTimeValue(item).slice(0, 2)) < 6) }
  ], [todayItems]);
  const visibleItems = expandedItems
    .filter((item) => item.date === selectedDate)
    .filter((item) => filter === '전체' || schedulerDisplayType(item) === filter || (filter === '완료' && item.done))
    .slice()
    .sort((left, right) => schedulerSortKey(left, true).localeCompare(schedulerSortKey(right, true)));
  const weekItems = weekDays.flatMap((day) => itemsByDate[day.key] || []);
  const weekDoneCount = weekItems.filter((item) => item.done).length;
  const weekCompletionRate = weekItems.length ? Math.round((weekDoneCount / weekItems.length) * 100) : 0;
  const selectedDateItems = expandedItems.filter((item) => item.date === selectedDate);
  const selectedDateDoneCount = selectedDateItems.filter((item) => item.done).length;
  const selectedDateCompletionRate = selectedDateItems.length ? Math.round((selectedDateDoneCount / selectedDateItems.length) * 100) : 0;
  const selectedDateStatusLabel = selectedDateItems.length
    ? `${selectedDate} · ${selectedDateItems.length}개 일정 · 달성률 ${selectedDateCompletionRate}%`
    : selectedDate === today
      ? '오늘 예정된 일정이 없습니다.'
      : `${selectedDate}은 아직 비어 있어요. 천천히 채워보세요.`;

  const moveCalendarMonth = (offset) => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + offset, 1);
    setCalendarMonth(toDateKey(next).slice(0, 7));
  };

  const submitDraft = (event) => {
    event.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    setItems((current) => [
      ...current,
      {
        id: `schedule-${Date.now()}`,
        title,
        date: draft.date,
        time: draft.time,
        type: draft.type,
        recurrence: draft.recurrence,
        recurrenceEnd: draft.recurrence === 'none' ? '' : draft.recurrenceEnd,
        doneOverrides: {},
        memo: draft.memo.trim(),
        done: false
      }
    ]);
    setDraft((current) => ({ ...current, title: '', memo: '' }));
    setSelectedDate(draft.date);
    setCalendarMonth(draft.date.slice(0, 7));
    setQuickAddOpen(false);
  };

  const updateItem = (id, patch) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const deleteItem = (id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const updateVisibleItem = (item, patch) => {
    if (item.recurring && Object.prototype.hasOwnProperty.call(patch, 'done')) {
      const sourceId = item.sourceId || item.id;
      setItems((current) => current.map((source) => {
        if (source.id !== sourceId) return source;
        return {
          ...source,
          doneOverrides: {
            ...(source.doneOverrides || {}),
            [item.date]: patch.done
          }
        };
      }));
      return;
    }
    updateItem(schedulerSourceRecordId(item), patch);
  };

  const deleteVisibleItem = (item) => {
    setSchedulerDeleteTarget(item);
  };

  const confirmDeleteVisibleItem = (event) => {
    event.preventDefault();
    if (!schedulerDeleteTarget) return;
    deleteItem(schedulerSourceRecordId(schedulerDeleteTarget));
    setSchedulerDeleteTarget(null);
  };

  const schedulerDeleteDialog = schedulerDeleteTarget ? (
    <div className="appDialogBackdrop" role="presentation" onMouseDown={() => setSchedulerDeleteTarget(null)}>
      <form
        className="appDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scheduler-delete-dialog-title"
        onSubmit={confirmDeleteVisibleItem}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <strong id="scheduler-delete-dialog-title">일정 삭제</strong>
          <button type="button" onClick={() => setSchedulerDeleteTarget(null)} aria-label="닫기">
            <MemoNavIcon type="close" />
          </button>
        </header>
        <p>{schedulerDeleteTarget.recurring ? '반복 일정 전체를 삭제할까요?' : `${schedulerDeleteTarget.title} 일정을 삭제할까요?`}</p>
        <div className="appDialogActions">
          <button type="button" className="appDialogSecondary" onClick={() => setSchedulerDeleteTarget(null)}>취소</button>
          <button type="submit" className="appDialogDanger">삭제</button>
        </div>
      </form>
    </div>
  ) : null;

  const todayPanel = (
    <aside className="schedulerTodayPanel top">
      <div className="schedulerTodayHeader">
        <div>
          <span>Today</span>
          <h2>오늘 일정</h2>
          <p>{today} · 할 일 {todayItems.length}개</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedDate(today);
            setCalendarMonth(today.slice(0, 7));
            setDraft((current) => ({ ...current, date: today }));
          }}
        >
          보기
        </button>
      </div>
      {todayItems.length ? (
        <div className="schedulerTodayTimeline">
          {todayTimeline
            .filter((slot) => slot.items.length)
            .map((slot) => (
              <section key={slot.key} className="schedulerTodaySlot">
                <div className="schedulerTodayTime">
                  <strong>{slot.label}</strong>
                  <span>{slot.range}</span>
                </div>
                <div className="schedulerTodayEvents">
                  {slot.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={[item.done ? 'done' : '', isWorkoutSchedulerItem(item) ? 'workoutScheduleItem' : ''].filter(Boolean).join(' ')}
                      onClick={() => updateVisibleItem(item, { done: !item.done })}
                    >
                      <time>{schedulerTimeLabel(item)}</time>
                      <strong>{item.title}</strong>
                      <span>{schedulerDisplayType(item)}{item.recurring ? ` · ${item.recurrenceLabel}` : ''}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
        </div>
      ) : (
        <div className="schedulerNoToday">오늘 예정된 일정이 없습니다.</div>
      )}
    </aside>
  );

  const weekPanel = (
    <section className="schedulerLinkedSchedule schedulerWeekPanel">
      <div className="schedulerLinkedHeader">
        <div>
          <h2>이번 주 일정</h2>
          <p>{today} 기준 · {weekRangeLabel}</p>
        </div>
      </div>
      <div className="schedulerWeekSlots">
        {weekDays.filter((day) => (itemsByDate[day.key] || []).length).map((day) => {
          const dayItems = (itemsByDate[day.key] || []).slice().sort((left, right) => schedulerSortKey(left).localeCompare(schedulerSortKey(right)));
          return (
            <button
              key={day.key}
              type="button"
              className={[
                day.key === selectedDate ? 'selected' : '',
                day.key === today ? 'today' : '',
                dayItems.some(isWorkoutSchedulerItem) ? 'workoutScheduleDay' : ''
              ].filter(Boolean).join(' ')}
              onClick={() => {
                setSelectedDate(day.key);
                setCalendarMonth(day.key.slice(0, 7));
                setDraft((current) => ({ ...current, date: day.key }));
              }}
            >
              <strong>{day.weekday}</strong>
              <span>{formatDateLabel(day.key)}</span>
              <small>{dayItems.length}개</small>
              <div>
                {dayItems.slice(0, 3).map((item) => <em key={item.id}>{schedulerTimeLabel(item)} {item.title}{item.recurring ? ' · 반복' : ''}</em>)}
                {dayItems.length > 3 ? <em>+{dayItems.length - 3}개 더</em> : null}
              </div>
            </button>
          );
        })}
        {weekItems.length ? null : <p className="schedulerEmptyInline">이번 주는 아직 여유가 있어요. 천천히 채워보세요.</p>}
      </div>
    </section>
  );

  const schedulerContent = (
      <section className="schedulerPage">
        <header className="schedulerHero mobileSchedulerTitle">
          <div>
            <h1>{schedulerTitle}</h1>
            <p>{today} · 오늘 일정 {todayItems.length}개 · 완료 {todayDoneCount}개</p>
          </div>
        </header>
        <div className="schedulerAddDock">
          <button type="button" className="schedulerCuteAdd" onClick={() => setQuickAddOpen((current) => !current)}>
            <MemoNavIcon type="plus" />
            <span>{quickAddOpen ? '닫기' : '일정 추가'}</span>
          </button>
        </div>
        {quickAddOpen ? <form className="schedulerQuickAdd cute" onSubmit={submitDraft}>
          <label>
            <span>할 일</span>
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="예: 오후 회의 준비" />
          </label>
          <div className="schedulerFormGrid">
            <label>
              <span>날짜</span>
              <input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
            </label>
            <label>
              <span>시간</span>
              <input type="time" value={draft.time} onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))} />
            </label>
          </div>
          <div className="schedulerFormGrid">
            <label>
              <span>반복</span>
              <select value={draft.recurrence} onChange={(event) => setDraft((current) => ({ ...current, recurrence: event.target.value }))}>
                {Object.entries(RECURRENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <span>반복 종료</span>
              <input
                type="date"
                value={draft.recurrenceEnd}
                disabled={draft.recurrence === 'none'}
                min={draft.date}
                onChange={(event) => setDraft((current) => ({ ...current, recurrenceEnd: event.target.value }))}
              />
            </label>
          </div>
          <label>
            <span>분류</span>
            <select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}>
              {SCHEDULER_CATEGORY_OPTIONS.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label>
            <span>메모</span>
            <textarea value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} placeholder="필요한 내용을 짧게 적어주세요." />
          </label>
          <button type="submit"><MemoNavIcon type="plus" /> 저장</button>
        </form> : null}
        {weekPanel}
        <section className="schedulerDatabase">
          <div className="schedulerCalendarPanel">
            <div className="schedulerCalendarHeader">
              <div>
                <h2>달력</h2>
                <p>{selectedDateStatusLabel}</p>
              </div>
              <div className="schedulerCalendarControls">
                <button type="button" onClick={() => moveCalendarMonth(-1)}>{'<'}</button>
                <strong>{calendarMonth}</strong>
                <button type="button" onClick={() => moveCalendarMonth(1)}>{'>'}</button>
                <button type="button" onClick={() => {
                  setSelectedDate(today);
                  setCalendarMonth(today.slice(0, 7));
                }}>Today</button>
              </div>
            </div>
            <div className="schedulerCalendarWeekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="schedulerCalendarGrid">
              {monthDays.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  className={[
                    day.currentMonth ? '' : 'muted',
                    day.key === selectedDate ? 'selected' : '',
                    day.key === today ? 'today' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    setSelectedDate(day.key);
                    setCalendarMonth(day.key.slice(0, 7));
                    setDraft((current) => ({ ...current, date: day.key }));
                  }}
                >
                  <span>{day.dayNumber}</span>
                  {itemCountByDate[day.key] ? <small>{itemCountByDate[day.key]}</small> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="schedulerBoardHeader">
            <div>
              <h2>일정</h2>
              <p>{selectedDate} · {filter} 보기 · {visibleItems.length}개</p>
            </div>
            <div className="schedulerFilters">
              {SCHEDULER_FILTER_OPTIONS.map((item) => (
                <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="schedulerList">
            <div className="schedulerTableHead">
              <span>이름</span>
              <span>분류</span>
              <span>날짜</span>
              <span>메모</span>
              <span />
            </div>
            {visibleItems.map((item) => {
              const sourcePath = schedulerItemSourcePath(item);
              const workoutItem = isWorkoutSchedulerItem(item);
              return (
                <article className={['schedulerItem', item.done ? 'done' : '', workoutItem ? 'workoutScheduleItem' : ''].filter(Boolean).join(' ')} key={item.id}>
                  <div className="schedulerNameCell">
                    <button type="button" className="schedulerCheck" onClick={() => updateVisibleItem(item, { done: !item.done })}>{item.done ? '✓' : ''}</button>
                    {workoutItem ? <span className="schedulerWorkoutIcon" title="운동"><MemoNavIcon type="trophy" /></span> : null}
                    <strong>{item.title}</strong>
                  </div>
                  <span className={`schedulerTypePill ${workoutItem ? 'workout' : ''}`}>{schedulerDisplayType(item)}</span>
                  <time>{item.date} · {schedulerTimeLabel(item)}</time>
                  <small>{[item.memo || '메모 없음', item.recurring ? item.recurrenceLabel : ''].filter(Boolean).join(' · ')}</small>
                  <div className="schedulerActionsCell">
                    {sourcePath ? <button type="button" className="schedulerSourceLink" onClick={() => navigate(sourcePath)}>{schedulerItemSourceLabel(item)}</button> : null}
                    <button type="button" className="schedulerDelete" onClick={() => deleteVisibleItem(item)}>{item.recurring ? '반복삭제' : '삭제'}</button>
                  </div>
                </article>
              );
            })}
            {visibleItems.length ? null : <p className="schedulerEmpty">이 날은 비어 있어요. 하고 싶은 일을 하나 적어보세요.</p>}
          </div>
        </section>
      </section>
  );

  if (embedded) {
    return <section className="schedulerEmbedded">{schedulerContent}{schedulerDeleteDialog}</section>;
  }

  return (
    <MobilePageShell
      activeTab="schedule"
      className="schedulerShell"
      icon="calendar"
      navigate={navigate}
      profile={mobileProfileForRoute(navigate, '/scheduler')}
      subtitle="오늘과 이번 주"
      title="일정"
    >
      {schedulerContent}
      {schedulerDeleteDialog}
    </MobilePageShell>
  );
}

function ConnectionsPage({ navigate }) {
  const session = readStoredAuth();
  return (
    <div className="connectionsWorkspaceShell">
      <WorkspaceNavigator active="connections" navigate={navigate} />
      <ConnectionsApp navigate={navigate} authToken={session?.token || ''} />
    </div>
  );
}

export default function App() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const handlePop = () => setPath(currentPath());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = (nextPath) => {
    if (!nextPath || nextPath === path) {
      return;
    }
    window.history.pushState({}, '', nextPath);
    setPath(currentPath());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const routePath = path.split('?')[0];
  const redirectPath = routePath === '/' || routePath === '/apps'
    ? APP_SHORTCUTS.mainHub.path
    : routePath === '/connections'
      ? APP_SHORTCUTS.dataConnections.path
      : '';
  const activeRoutePath = redirectPath || routePath;

  useEffect(() => {
    if (redirectPath) {
      window.history.replaceState({}, '', redirectPath);
      setPath(currentPath());
    }
  }, [redirectPath]);

  if (activeRoutePath === '/analysis' || activeRoutePath.startsWith('/analysis/')) {
    return <AnalysisFileEditorPage navigate={navigate} />;
  }

  if (activeRoutePath === '/analysisadmin' || activeRoutePath.startsWith('/analysisadmin/')) {
    return <WorkspaceApp navigate={navigate} />;
  }

  if (activeRoutePath === '/scheduler' || activeRoutePath.startsWith('/scheduler/')) {
    return <SchedulerPage navigate={navigate} />;
  }

  if (activeRoutePath === '/connect' || activeRoutePath.startsWith('/connect/')) {
    return <ConnectionsPage navigate={navigate} />;
  }

  if (activeRoutePath === '/notes' || activeRoutePath.startsWith('/notes/')) {
    return <NotionNotesPage navigate={navigate} />;
  }

  if (activeRoutePath === '/portfolio' || activeRoutePath.startsWith('/portfolio/')) {
    return <PortfolioHomePage navigate={navigate} />;
  }

  if (activeRoutePath === '/more' || activeRoutePath.startsWith('/more/')) {
    return <MorePage navigate={navigate} />;
  }

  if (activeRoutePath === '/mypage' || activeRoutePath.startsWith('/mypage/')) {
    return <AccountPage navigate={navigate} />;
  }

  if (activeRoutePath === '/budget' || activeRoutePath.startsWith('/budget/')) {
    return <BudgetPage navigate={navigate} />;
  }

  if (activeRoutePath === '/workout' || activeRoutePath.startsWith('/workout/')) {
    return <WorkoutPage navigate={navigate} />;
  }

  if (activeRoutePath === '/reading' || activeRoutePath.startsWith('/reading/')) {
    return <ReadingPage navigate={navigate} />;
  }

  if (activeRoutePath === '/login') {
    return <AppAuthPage mode="login" navigate={navigate} />;
  }

  if (activeRoutePath === '/signup') {
    return <AppAuthPage mode="signup" navigate={navigate} />;
  }

  if (activeRoutePath === '/app' || activeRoutePath.startsWith('/app/')) {
    return <SpaceHomePage navigate={navigate} />;
  }

  return <LocalTripApp path={path} navigate={navigate} />;
}
