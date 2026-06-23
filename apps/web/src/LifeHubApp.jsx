import { useEffect, useMemo, useState } from 'react';
import MemoNavIcon from './components/MemoNavIcon.jsx';
import {
  EmptyState,
  FeedbackToast,
  LifeHubButton,
  QuickChoiceGroup,
  Section,
  useLifeHubFeedback
} from './components/lifehub/LifeHubUi.jsx';
import {
  DEFAULT_WORKOUT_PROFILE,
  WORKOUT_CARDIO_ACTIVITIES,
  WORKOUT_TEMPLATES,
  calculateWorkoutBmr,
  cardioActivityForId,
  createCardioExercise,
  estimateWorkoutCalories,
  normalizeWorkoutProfile,
  workoutDurationMinutes,
  workoutKindForTemplate
} from './components/workout/workoutMetrics.js';
import { safeParse, safeRemoveItem, safeSetItem } from './utils/lifeHubStorage.js';

const AUTH_KEY = 'codex-workspace-auth';
const SCHEDULER_KEY = 'codex-personal-scheduler-items';
const NOTE_BLOCKS_KEY = 'codex-ai-note-blocks';
const NOTE_BOARDS_KEY = 'codex-ai-note-boards';
const READING_KEY = 'ai-assistant-reading-library';
const BUDGET_KEY = 'ai-assistant-budget-entries';
const WORKOUT_LOGS_KEY = 'ai-assistant-workout-logs';
const WORKOUT_PROFILE_KEY = 'ai-assistant-workout-profile';
const TRIPS_KEY = 'ai-assistant-lifehub-trips';
const DISMISSED_ACTIONS_KEY = 'ai-assistant-lifehub-dismissed-actions';
const LIFEHUB_EVENT = 'lifehub:data-updated';

const ROUTE_ALIASES = {
  '/': 'home',
  '/app': 'home',
  '/home': 'home',
  '/assistant': 'assistant',
  '/memo': 'memo',
  '/schedule': 'schedule',
  '/more': 'more',
  '/reading': 'reading',
  '/workout': 'workout',
  '/travel': 'travel',
  '/finance': 'finance'
};

const ROUTE_META = {
  home: { title: '홈', path: '/home', icon: 'home' },
  assistant: { title: '비서', path: '/assistant', icon: 'spark' },
  memo: { title: '메모', path: '/memo', icon: 'edit' },
  schedule: { title: '일정', path: '/schedule', icon: 'calendar' },
  more: { title: '더보기', path: '/more', icon: 'menu' },
  reading: { title: '독서', path: '/reading', icon: 'book' },
  workout: { title: '운동', path: '/workout', icon: 'trophy' },
  travel: { title: '여행', path: '/travel', icon: 'trip' },
  finance: { title: '가계부', path: '/finance', icon: 'chart' }
};

const PRIMARY_TABS = ['home', 'assistant', 'memo', 'schedule', 'more'];
const SCHEDULE_TYPES = ['개인', '업무', '메모', '운동', '여행'];
const SCHEDULE_FILTERS = ['오늘', '예정', '놓친 일정', '완료'];
const SCHEDULE_PRIORITY_OPTIONS = [
  { value: '보통', label: '보통' },
  { value: '높음', label: '급함' },
  { value: '낮음', label: '가벼움' }
];
const NOTE_FILTER_ALL = '전체';
const BUDGET_CATEGORY_OPTIONS = ['식비', '교통', '카페', '쇼핑', '기타'];
const READING_STATUSES = [
  { id: 'interested', label: '관심', empty: '관심 책을 아직 넣지 않았어요.' },
  { id: 'reading', label: '읽는 중', empty: '읽는 중인 책을 골라두세요.' },
  { id: 'finished', label: '완독', empty: '완독 기록이 쌓이면 여기에서 보여드릴게요.' }
];
const MONEY = new Intl.NumberFormat('ko-KR');
const DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'long'
});

function readStoredAuth() {
  const session = safeParse(localStorage.getItem(AUTH_KEY), null);
  if (!session) return null;
  return session.username === 'guestuser' && !session.isGuest ? { ...session, isGuest: true } : session;
}

function storageUsername(session = readStoredAuth()) {
  const username = typeof session === 'string' ? session : session?.username;
  return String(username || 'guestuser').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'guestuser';
}

function scopedKey(baseKey, session = readStoredAuth()) {
  return `${baseKey}:${storageUsername(session)}`;
}

function readScopedArray(baseKey, session, normalize) {
  const key = scopedKey(baseKey, session);
  const legacyAllowed = !session || session.isGuest || session.username === 'guestuser';
  const scoped = safeParse(localStorage.getItem(key), null);
  const legacy = legacyAllowed ? safeParse(localStorage.getItem(baseKey), null) : null;
  const source = Array.isArray(scoped) ? scoped : Array.isArray(legacy) ? legacy : [];
  const items = source.map(normalize).filter(Boolean);
  if (!Array.isArray(scoped) && items.length) {
    safeSetItem(key, JSON.stringify(items));
  }
  return items;
}

function emitDataChanged(detail = {}) {
  window.dispatchEvent(new CustomEvent(LIFEHUB_EVENT, { detail }));
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const [year, month, day] = String(value).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isTimeKey(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

function addDays(dateKey, offset) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day + offset);
  return todayKey(date);
}

function monthKey(dateKey = todayKey()) {
  return dateKey.slice(0, 7);
}

function compareDateTime(left, right) {
  return `${left?.date || ''} ${left?.time || '99:99'} ${left?.title || ''}`.localeCompare(`${right?.date || ''} ${right?.time || '99:99'} ${right?.title || ''}`);
}

function compactDateLabel(dateKey) {
  if (!dateKey) return '날짜 없음';
  const today = todayKey();
  if (dateKey === today) return '오늘';
  if (dateKey === addDays(today, 1)) return '내일';
  if (dateKey === addDays(today, -1)) return '어제';
  return dateKey.slice(5).replace('-', '.');
}

function fullDateLabel(dateKey = todayKey()) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return DATE_FORMATTER.format(new Date(year, month - 1, day));
}

function money(value) {
  const amount = Number(value) || 0;
  const sign = amount < 0 ? '-' : '';
  return `${sign}${MONEY.format(Math.abs(Math.round(amount)))}원`;
}

function normalizeScheduleType(value) {
  const raw = String(value || '').trim();
  if (['업무', 'work', 'WORK', '회의', '작업'].includes(raw)) return '업무';
  if (['메모', 'AI Note', 'note'].includes(raw)) return '메모';
  if (['운동', 'fitness', 'workout'].includes(raw)) return '운동';
  if (['여행', 'travel', 'trip'].includes(raw)) return '여행';
  return raw || '개인';
}

function normalizeSchedule(item, index = 0) {
  const title = String(item?.title || item?.name || '').trim();
  if (!title) return null;
  const date = isDateKey(item?.date) ? item.date : todayKey();
  const recurrence = ['none', 'daily', 'weekly', 'monthly'].includes(item?.recurrence) ? item.recurrence : 'none';
  return {
    ...item,
    id: String(item?.id || `schedule-${Date.now()}-${index}`),
    title,
    date,
    time: isTimeKey(item?.time) ? item.time : '',
    type: normalizeScheduleType(item?.type || item?.category),
    priority: ['높음', '보통', '낮음'].includes(item?.priority) ? item.priority : '보통',
    memo: String(item?.memo || item?.note || '').trim(),
    recurrence,
    recurrenceEnd: isDateKey(item?.recurrenceEnd) ? item.recurrenceEnd : '',
    done: Boolean(item?.done),
    doneOverrides: item?.doneOverrides && typeof item.doneOverrides === 'object' ? item.doneOverrides : {},
    source: item?.source || ''
  };
}

function readSchedules(session) {
  return readScopedArray(SCHEDULER_KEY, session, normalizeSchedule).sort(compareDateTime);
}

function saveSchedules(session, items) {
  const key = scopedKey(SCHEDULER_KEY, session);
  const normalized = items.map(normalizeSchedule).filter(Boolean).sort(compareDateTime).slice(0, 300);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  safeRemoveItem(SCHEDULER_KEY);
  window.dispatchEvent(new CustomEvent('codex:scheduler-items-updated', { detail: { items: normalized, storageKey: key } }));
  emitDataChanged({ key });
  return { items: normalized, saved };
}

function recurrenceMatches(item, targetDate) {
  if (item.recurrence === 'none') return item.date === targetDate;
  if (targetDate < item.date) return false;
  if (item.recurrenceEnd && targetDate > item.recurrenceEnd) return false;
  const start = new Date(`${item.date}T00:00:00`);
  const target = new Date(`${targetDate}T00:00:00`);
  const diffDays = Math.round((target - start) / 86400000);
  if (item.recurrence === 'daily') return diffDays >= 0;
  if (item.recurrence === 'weekly') return diffDays >= 0 && diffDays % 7 === 0;
  if (item.recurrence === 'monthly') return item.date.slice(8) === targetDate.slice(8);
  return false;
}

function buildScheduleWindow() {
  const today = todayKey();
  return Array.from({ length: 75 }, (_, index) => addDays(today, index - 14));
}

function expandSchedules(items) {
  const dates = buildScheduleWindow();
  return items.flatMap((item) => {
    if (item.recurrence === 'none') return [{ ...item, scheduleId: item.id, recurring: false }];
    return dates.filter((date) => recurrenceMatches(item, date)).map((date) => ({
      ...item,
      id: `${item.id}:${date}`,
      scheduleId: item.id,
      sourceId: item.id,
      date,
      recurring: true,
      done: Boolean(item.doneOverrides?.[date])
    }));
  }).sort(compareDateTime);
}

function updateScheduleDone(session, schedule, done) {
  const items = readSchedules(session);
  const sourceId = schedule.sourceId || schedule.scheduleId || schedule.id;
  const next = items.map((item) => {
    if (item.id !== sourceId) return item;
    if (schedule.recurring) {
      return { ...item, doneOverrides: { ...(item.doneOverrides || {}), [schedule.date]: Boolean(done) } };
    }
    return { ...item, done: Boolean(done) };
  });
  return saveSchedules(session, next);
}

function noteTitle(note) {
  if (String(note?.title || '').trim()) return String(note.title).trim();
  const firstLine = String(note?.content || '').split('\n').find((line) => line.trim()) || '';
  return firstLine.replace(/^#+\s*/, '').trim() || '새 메모';
}

function noteBody(note) {
  const lines = String(note?.content || '').split('\n');
  const first = lines.findIndex((line) => line.trim());
  if (first < 0) return '';
  return lines.slice(first + 1).join('\n').trim();
}

function noteTags(note) {
  const explicit = [...(Array.isArray(note?.tags) ? note.tags : []), ...(Array.isArray(note?.labels) ? note.labels : [])]
    .map((tag) => String(tag || '').trim())
    .filter(Boolean);
  const derived = [...String(note?.content || '').matchAll(/#([가-힣A-Za-z0-9_-]+)/g)].map((match) => match[1]);
  return [...new Set([...explicit, ...derived])].slice(0, 6);
}

function normalizeNote(note, index = 0) {
  const title = noteTitle(note);
  const createdAt = note?.createdAt || note?.updatedAt || new Date().toISOString();
  return {
    ...note,
    id: String(note?.id || `note-${Date.now()}-${index}`),
    type: note?.type || 'text',
    title,
    content: String(note?.content || `# ${title}`),
    boardId: note?.boardId || note?.folderId || note?.sector || 'personal',
    folderId: note?.folderId || note?.boardId || note?.sector || 'personal',
    status: note?.status || 'todo',
    pinned: Boolean(note?.pinned),
    tags: noteTags(note),
    createdAt,
    updatedAt: note?.updatedAt || createdAt
  };
}

function readNotes(session) {
  return readScopedArray(NOTE_BLOCKS_KEY, session, normalizeNote)
    .sort((left, right) => `${right.pinned ? 1 : 0}${right.updatedAt || ''}`.localeCompare(`${left.pinned ? 1 : 0}${left.updatedAt || ''}`))
    .slice(0, 200);
}

function saveNotes(session, notes) {
  const key = scopedKey(NOTE_BLOCKS_KEY, session);
  const normalized = notes.map(normalizeNote).filter(Boolean).slice(0, 200);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  safeRemoveItem(NOTE_BLOCKS_KEY);
  window.dispatchEvent(new CustomEvent('codex:notes-updated', { detail: { storageKey: key } }));
  emitDataChanged({ key });
  return { items: normalized, saved };
}

function ensureNoteBoards(session) {
  const key = scopedKey(NOTE_BOARDS_KEY, session);
  const current = safeParse(localStorage.getItem(key), null);
  if (Array.isArray(current) && current.length) return;
  safeSetItem(key, JSON.stringify([
    { id: 'personal', title: '개인', name: '개인' },
    { id: 'travel', title: '여행', name: '여행' }
  ]));
}

function normalizeReadingStatus(value) {
  const raw = String(value || '').trim().replace(/\s+/g, '').toLowerCase();
  if (['reading', 'progress', 'active', '읽는중', '읽고있는책'].includes(raw)) return 'reading';
  if (['finished', 'done', 'complete', 'read', '완독', '읽은책'].includes(raw)) return 'finished';
  return 'interested';
}

function normalizeBook(book, index = 0) {
  const title = String(book?.title || book?.name || '').trim();
  if (!title) return null;
  const createdAt = book?.createdAt || new Date().toISOString();
  const totalPages = Math.max(0, Math.round(Number(book?.totalPages || book?.pages || 0)));
  const currentPage = Math.min(totalPages || Number.MAX_SAFE_INTEGER, Math.max(0, Math.round(Number(book?.currentPage || book?.page || 0))));
  return {
    ...book,
    id: String(book?.id || `book-${Date.now()}-${index}`),
    title,
    author: String(book?.author || '').trim(),
    status: normalizeReadingStatus(book?.status),
    currentPage,
    totalPages,
    rating: Math.min(5, Math.max(0, Number(book?.rating) || 0)),
    memo: String(book?.memo || book?.note || '').trim(),
    startedAt: isDateKey(book?.startedAt) ? book.startedAt : '',
    finishedAt: isDateKey(book?.finishedAt) ? book.finishedAt : '',
    createdAt,
    updatedAt: book?.updatedAt || createdAt
  };
}

function readBooks(session) {
  return readScopedArray(READING_KEY, session, normalizeBook)
    .sort((left, right) => `${right.updatedAt || right.createdAt || ''}`.localeCompare(`${left.updatedAt || left.createdAt || ''}`))
    .slice(0, 200);
}

function saveBooks(session, books) {
  const key = scopedKey(READING_KEY, session);
  const normalized = books.map(normalizeBook).filter(Boolean).slice(0, 200);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  safeRemoveItem(READING_KEY);
  emitDataChanged({ key });
  return { items: normalized, saved };
}

function normalizeBudget(entry, index = 0) {
  const amount = Math.round(Math.abs(Number(entry?.amount) || 0));
  if (!amount) return null;
  const type = entry?.type === 'deposit' || entry?.type === 'income' ? 'deposit' : 'withdraw';
  return {
    ...entry,
    id: String(entry?.id || `budget-${Date.now()}-${index}`),
    type,
    amount,
    date: isDateKey(entry?.date) ? entry.date : todayKey(),
    category: String(entry?.category || (type === 'deposit' ? '수입' : '생활비')).trim(),
    memo: String(entry?.memo || '').trim(),
    createdAt: entry?.createdAt || new Date().toISOString()
  };
}

function readBudget(session) {
  return readScopedArray(BUDGET_KEY, session, normalizeBudget)
    .sort((left, right) => `${right.date || ''}${right.createdAt || ''}`.localeCompare(`${left.date || ''}${left.createdAt || ''}`))
    .slice(0, 240);
}

function saveBudget(session, entries) {
  const key = scopedKey(BUDGET_KEY, session);
  const normalized = entries.map(normalizeBudget).filter(Boolean).slice(0, 240);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  safeRemoveItem(BUDGET_KEY);
  emitDataChanged({ key });
  return { items: normalized, saved };
}

function normalizeExercise(exercise, index = 0) {
  const name = String(exercise?.name || '').trim();
  if (!name) return null;
  return {
    id: String(exercise?.id || `exercise-${Date.now()}-${index}`),
    mode: exercise?.mode || '',
    name,
    sets: String(exercise?.sets || '').trim(),
    reps: String(exercise?.reps || '').trim(),
    weight: String(exercise?.weight || '').trim(),
    durationMinutes: String(exercise?.durationMinutes || '').trim(),
    met: String(exercise?.met || '').trim()
  };
}

function exercisesForTemplate(templateId) {
  const template = WORKOUT_TEMPLATES.find((item) => item.id === templateId) || WORKOUT_TEMPLATES[0];
  if (template.id === 'cardio') return [createCardioExercise(WORKOUT_CARDIO_ACTIVITIES[0])];
  return template.exercises.map((exercise, index) => normalizeExercise(exercise, index)).filter(Boolean);
}

function normalizeWorkout(log, index = 0) {
  const template = WORKOUT_TEMPLATES.find((item) => item.id === log?.templateId) || WORKOUT_TEMPLATES[0];
  const exercises = Array.isArray(log?.exercises) && log.exercises.length
    ? log.exercises.map(normalizeExercise).filter(Boolean)
    : exercisesForTemplate(template.id);
  const duration = Math.round(Number(log?.durationMinutes) || workoutDurationMinutes({ templateId: template.id, exercises }) || 0);
  return {
    ...log,
    id: String(log?.id || `workout-${Date.now()}-${index}`),
    templateId: template.id,
    workoutKind: log?.workoutKind || workoutKindForTemplate(template.id),
    title: log?.title || template.title,
    date: isDateKey(log?.date) ? log.date : todayKey(),
    startTime: isTimeKey(log?.startTime) ? log.startTime : '',
    durationMinutes: duration,
    caloriesBurned: Math.max(0, Math.round(Number(log?.caloriesBurned) || 0)),
    memo: String(log?.memo || '').trim(),
    exercises,
    createdAt: log?.createdAt || new Date().toISOString()
  };
}

function readWorkouts(session) {
  return readScopedArray(WORKOUT_LOGS_KEY, session, normalizeWorkout)
    .sort((left, right) => `${right.date || ''}${right.createdAt || ''}`.localeCompare(`${left.date || ''}${left.createdAt || ''}`))
    .slice(0, 150);
}

function saveWorkouts(session, logs) {
  const key = scopedKey(WORKOUT_LOGS_KEY, session);
  const normalized = logs.map(normalizeWorkout).filter(Boolean).slice(0, 150);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  safeRemoveItem(WORKOUT_LOGS_KEY);
  emitDataChanged({ key });
  return { items: normalized, saved };
}

function readWorkoutProfile(session) {
  const key = scopedKey(WORKOUT_PROFILE_KEY, session);
  const fallback = !session || session.isGuest || session.username === 'guestuser'
    ? safeParse(localStorage.getItem(WORKOUT_PROFILE_KEY), null)
    : null;
  return normalizeWorkoutProfile(safeParse(localStorage.getItem(key), fallback || DEFAULT_WORKOUT_PROFILE));
}

function saveWorkoutProfile(session, profile) {
  const key = scopedKey(WORKOUT_PROFILE_KEY, session);
  const normalized = normalizeWorkoutProfile(profile);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  safeRemoveItem(WORKOUT_PROFILE_KEY);
  emitDataChanged({ key });
  return { profile: normalized, saved };
}

function normalizeTrip(trip, index = 0) {
  const title = String(trip?.title || trip?.destination || trip?.name || '').trim();
  if (!title) return null;
  const checklist = Array.isArray(trip?.checklist) ? trip.checklist : [
    { text: '예약 확인', done: Boolean(trip?.reservationDone) },
    { text: '교통 확인', done: Boolean(trip?.transportDone) },
    { text: '숙소 확인', done: Boolean(trip?.hotelDone) },
    { text: '일정 메모', done: Boolean(trip?.memoDone) }
  ];
  return {
    ...trip,
    id: String(trip?.id || `trip-${Date.now()}-${index}`),
    title,
    startDate: isDateKey(trip?.startDate) ? trip.startDate : '',
    endDate: isDateKey(trip?.endDate) ? trip.endDate : '',
    memo: String(trip?.memo || '').trim(),
    checklist: checklist.map((item, itemIndex) => ({
      id: String(item?.id || `trip-check-${itemIndex}`),
      text: String(item?.text || '').trim() || '준비할 것',
      done: Boolean(item?.done)
    })).slice(0, 12),
    createdAt: trip?.createdAt || new Date().toISOString()
  };
}

function readTrips(session) {
  return readScopedArray(TRIPS_KEY, session, normalizeTrip)
    .sort((left, right) => (left.startDate || '9999-99-99').localeCompare(right.startDate || '9999-99-99'))
    .slice(0, 80);
}

function saveTrips(session, trips) {
  const key = scopedKey(TRIPS_KEY, session);
  const normalized = trips.map(normalizeTrip).filter(Boolean).slice(0, 80);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  emitDataChanged({ key });
  return { items: normalized, saved };
}

function dDayLabel(dateKey) {
  if (!dateKey) return '';
  const today = new Date(`${todayKey()}T00:00:00`);
  const target = new Date(`${dateKey}T00:00:00`);
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return 'D-day';
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
}

function readDismissedActions(session) {
  return safeParse(localStorage.getItem(scopedKey(DISMISSED_ACTIONS_KEY, session)), []);
}

function saveDismissedActions(session, ids) {
  return safeSetItem(scopedKey(DISMISSED_ACTIONS_KEY, session), JSON.stringify([...new Set(ids)]));
}

function monthlyBudgetSummary(entries, baseMonth = monthKey()) {
  const monthEntries = entries.filter((entry) => entry.date.startsWith(baseMonth));
  const income = monthEntries.filter((entry) => entry.type === 'deposit').reduce((sum, entry) => sum + entry.amount, 0);
  const expense = monthEntries.filter((entry) => entry.type !== 'deposit').reduce((sum, entry) => sum + entry.amount, 0);
  const byCategory = monthEntries.filter((entry) => entry.type !== 'deposit').reduce((groups, entry) => {
    groups[entry.category] = (groups[entry.category] || 0) + entry.amount;
    return groups;
  }, {});
  const budgetBase = income || 1000000;
  return {
    income,
    expense,
    balance: income - expense,
    usage: Math.min(999, Math.round((expense / Math.max(1, budgetBase)) * 100)),
    byCategory
  };
}

function readLifeHubData(session) {
  ensureNoteBoards(session);
  const today = todayKey();
  const schedules = readSchedules(session);
  const expandedSchedules = expandSchedules(schedules);
  const todaySchedules = expandedSchedules.filter((item) => item.date === today).sort(compareDateTime);
  const missedSchedules = expandedSchedules.filter((item) => item.date < today && !item.done).sort(compareDateTime).slice(0, 8);
  const upcomingSchedules = expandedSchedules.filter((item) => item.date > today && !item.done).sort(compareDateTime).slice(0, 8);
  const notes = readNotes(session);
  const books = readBooks(session);
  const workouts = readWorkouts(session);
  const profile = readWorkoutProfile(session);
  const budgetEntries = readBudget(session);
  const trips = readTrips(session);
  const budget = monthlyBudgetSummary(budgetEntries);
  const readingBook = books.find((book) => book.status === 'reading') || null;
  const todayWorkout = workouts.find((log) => log.date === today) || null;
  const nextTrip = trips.find((trip) => !trip.startDate || trip.startDate >= today) || trips[0] || null;
  return {
    today,
    session,
    schedules,
    expandedSchedules,
    todaySchedules,
    missedSchedules,
    upcomingSchedules,
    notes,
    books,
    workouts,
    workoutProfile: profile,
    budgetEntries,
    budget,
    trips,
    readingBook,
    todayWorkout,
    nextTrip
  };
}

function buildAssistantActions(data, dismissedIds = []) {
  const dismissed = new Set(dismissedIds);
  const actions = [];
  data.missedSchedules.slice(0, 2).forEach((item) => {
    actions.push({
      id: `missed-${item.id}`,
      tone: 'danger',
      title: `놓친 일정: ${item.title}`,
      description: `${compactDateLabel(item.date)} ${item.time || '종일'} · 먼저 정리해두세요.`,
      route: '/schedule',
      schedule: item
    });
  });
  data.todaySchedules.filter((item) => !item.done).slice(0, 2).forEach((item) => {
    actions.push({
      id: `today-${item.id}`,
      tone: item.priority === '높음' ? 'warning' : 'primary',
      title: item.title,
      description: `${item.time || '종일'} · 오늘 확인할 일`,
      route: '/schedule',
      schedule: item
    });
  });
  if (!data.todayWorkout) {
    actions.push({
      id: 'workout-reminder',
      tone: 'primary',
      title: '오늘 운동 기록 없음',
      description: '15분 운동으로 오늘 기록을 채워보세요.',
      route: '/workout'
    });
  }
  if (data.readingBook) {
    actions.push({
      id: `reading-${data.readingBook.id}`,
      tone: 'calm',
      title: '읽던 책 이어보기',
      description: `${data.readingBook.title} · 오늘 10페이지만 이어볼까요?`,
      route: '/reading'
    });
  }
  if (data.budget.usage >= 80) {
    actions.push({
      id: 'budget-warning',
      tone: 'warning',
      title: '예산 사용률이 높아요',
      description: `이번 달 지출 ${money(data.budget.expense)} · 사용률 ${data.budget.usage}%`,
      route: '/finance'
    });
  }
  if (data.nextTrip?.startDate) {
    const pending = data.nextTrip.checklist.filter((item) => !item.done).length;
    if (pending) {
      actions.push({
        id: `trip-${data.nextTrip.id}`,
        tone: 'calm',
        title: '여행 준비 체크',
        description: `${data.nextTrip.title} ${dDayLabel(data.nextTrip.startDate)} · 준비 ${pending}개 남음`,
        route: '/travel'
      });
    }
  }
  return actions.filter((action) => !dismissed.has(action.id)).slice(0, 8);
}

function routeForPath(path) {
  const routePath = (path || window.location.pathname || '/home').split('?')[0].replace(/\/$/, '') || '/';
  return ROUTE_ALIASES[routePath] || 'home';
}

function routeTitle(route) {
  return ROUTE_META[route]?.title || '홈';
}

function routeIcon(route) {
  return ROUTE_META[route]?.icon || 'home';
}

function AccountChip({ session, navigate }) {
  const isGuest = !session || session.isGuest || session.username === 'guestuser';
  return (
    <div className="lifeHubAccountChip" aria-label="로그인 상태">
      <MemoNavIcon type="user" />
      <div>
        <strong>{isGuest ? 'Guest' : session.username}</strong>
        <span>{isGuest ? '게스트 모드' : '동기화 준비됨'}</span>
      </div>
      <button type="button" onClick={() => navigate(isGuest ? '/login' : '/mypage')}>
        {isGuest ? '로그인' : '계정'}
      </button>
    </div>
  );
}

function AssistantActionCard({ action, onDone, onLater, onOpen }) {
  const openLabel = action.route === '/workout' || action.route === '/finance'
    ? '기록하기'
    : action.route === '/reading'
      ? '이어읽기'
      : action.route === '/travel'
        ? '준비'
        : '열기';
  return (
    <article className={`lifeHubActionCard ${action.tone || 'primary'}`}>
      <div>
        <strong>{action.title}</strong>
        <p>{action.description}</p>
      </div>
      <div className="lifeHubActionButtons">
        {action.schedule ? (
          <button type="button" onClick={() => onDone(action)} aria-label={`${action.title} 완료`}>
            완료
          </button>
        ) : null}
        <button type="button" onClick={() => onLater(action)} aria-label={`${action.title} 나중에 보기`}>
          나중에
        </button>
        <button type="button" className="primary" onClick={() => onOpen(action.route)} aria-label={`${action.title} 열기`}>
          {openLabel}
        </button>
      </div>
    </article>
  );
}

function HomeFocusCard({ action, nextSchedule, onDone, onLater, onOpen }) {
  if (action) {
    const openLabel = action.route === '/workout' || action.route === '/finance'
      ? '기록하기'
      : action.route === '/reading'
        ? '이어읽기'
        : action.route === '/travel'
          ? '준비'
          : '열기';
    return (
      <article className={`lifeHubHomeFocus ${action.tone || 'primary'}`}>
        <MemoNavIcon type={action.schedule ? 'calendar' : 'spark'} />
        <div>
          <span>바로 볼 일</span>
          <strong>{action.title}</strong>
          <p>{action.description}</p>
        </div>
        <div className="lifeHubHomeFocusActions">
          {action.schedule ? (
            <button type="button" onClick={() => onDone(action)} aria-label={`${action.title} 완료`}>
              완료
            </button>
          ) : null}
          <button type="button" onClick={() => onLater(action)} aria-label={`${action.title} 나중에 보기`}>
            나중에
          </button>
          <button type="button" className="primary" onClick={() => onOpen(action.route)} aria-label={`${action.title} 열기`}>
            {openLabel}
          </button>
        </div>
      </article>
    );
  }

  if (nextSchedule) {
    return (
      <article className="lifeHubHomeFocus calm">
        <MemoNavIcon type="calendar" />
        <div>
          <span>다음 일정</span>
          <strong>{nextSchedule.title}</strong>
          <p>{compactDateLabel(nextSchedule.date)} · {nextSchedule.time || '종일'} · {nextSchedule.type}</p>
        </div>
        <div className="lifeHubHomeFocusActions">
          <button type="button" className="primary" onClick={() => onOpen('/schedule')}>
            보기
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="lifeHubHomeFocus idle">
      <MemoNavIcon type="checkSquare" />
      <div>
        <span>오늘 상태</span>
        <strong>바로 처리할 알림은 없어요</strong>
        <p>필요한 일은 빠른 입력에 한 줄로 남겨두세요.</p>
      </div>
    </article>
  );
}

function LifeHubShell({ route, path, session, model, actions, dismissed, setDismissed, navigate, refresh, children }) {
  const activeTab = PRIMARY_TABS.includes(route) ? route : 'more';
  const title = routeTitle(route);
  const icon = routeIcon(route);
  const currentPath = (path || window.location.pathname || '').split('?')[0];

  const go = (nextPath) => {
    if (navigate) navigate(nextPath);
    else {
      window.history.pushState({}, '', nextPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className="lifeHubRoot">
      <main className="lifeHubApp" aria-label="LifeHub 개인비서 앱">
        <header className="lifeHubTopBar">
          <div className="lifeHubTopTitle">
            <span className="lifeHubTopIcon"><MemoNavIcon type={icon} /></span>
            <div>
              <span>개인비서 브리핑 · {fullDateLabel(model.today)}</span>
              <h1>{title}</h1>
            </div>
          </div>
          <AccountChip session={session} navigate={go} />
        </header>
        {children}
      </main>
      <nav className="lifeHubBottomNav" aria-label="LifeHub 하단 메뉴">
        {PRIMARY_TABS.map((tab) => {
          const meta = ROUTE_META[tab];
          const active = activeTab === tab || currentPath === meta.path;
          return (
            <button
              type="button"
              key={tab}
              className={active ? 'active' : ''}
              onClick={() => go(meta.path)}
              aria-current={active ? 'page' : undefined}
            >
              <MemoNavIcon type={meta.icon} />
              <span>{meta.title}</span>
            </button>
          );
        })}
      </nav>
      <div className="lifeHubLiveRegion" aria-live="polite">
        {actions.length ? `${actions.length}개 추천 액션이 있습니다.` : '지금은 급한 일이 없어요.'}
      </div>
    </div>
  );
}

function HomePage({ model, actions, session, navigate, refresh, dismissed, setDismissed }) {
  const [quickMemo, setQuickMemo] = useState('');
  const [status, setStatus] = useState('');
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();
  const pendingToday = model.todaySchedules.filter((item) => !item.done).length;
  const nextSchedule = model.todaySchedules.find((item) => !item.done) || model.upcomingSchedules[0] || null;
  const firstAction = actions[0] || null;
  const secondaryActions = actions.slice(firstAction ? 1 : 0, firstAction ? 3 : 2);
  const readingCount = model.books.filter((book) => book.status === 'reading').length;
  const budgetTone = model.budget.usage >= 80 ? '이번 달 지출이 평소보다 높아요' : `사용률 ${model.budget.usage}%`;
  const briefTitle = pendingToday
    ? '오늘 먼저 확인할 일이 있어요'
    : actions.length
      ? '기록할 일이 하나 있어요'
      : '급한 일은 없어요. 가볍게 기록해볼까요?';
  const briefText = firstAction
    ? firstAction.description
    : nextSchedule
      ? `${compactDateLabel(nextSchedule.date)} ${nextSchedule.time || '종일'} · ${nextSchedule.title}`
      : '메모, 지출, 운동 기록을 필요할 때 바로 남기세요.';
  const tripText = model.nextTrip?.startDate ? `${model.nextTrip.title} ${dDayLabel(model.nextTrip.startDate)}` : '예정된 여행 없음';

  const closeAction = (target, done = false) => {
    if (done && target.schedule) {
      const result = updateScheduleDone(session, target.schedule, true);
      notify(result.saved ? '일정을 완료 처리했어요.' : '저장 공간 문제로 완료 상태를 저장하지 못했어요.', result.saved ? 'success' : 'error');
    } else {
      notify('나중에 다시 볼게요.', 'success');
    }
    const next = [...dismissed, target.id];
    saveDismissedActions(session, next);
    setDismissed(next);
    refresh();
  };

  const submitQuickMemo = (event) => {
    event.preventDefault();
    const text = quickMemo.trim();
    if (!text) {
      setStatus('메모 내용을 입력하세요.');
      return;
    }
    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const title = lines[0].slice(0, 48);
    const note = normalizeNote({
      id: `note-${Date.now()}`,
      title,
      content: `# ${title}\n\n${lines.slice(1).join('\n')}`,
      boardId: 'personal',
      folderId: 'personal',
      tags: ['빠른메모'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const result = saveNotes(session, [note, ...readNotes(session)]);
    setQuickMemo('');
    setStatus(result.saved ? '빠른 메모로 저장했어요.' : '저장 공간 문제로 메모를 저장하지 못했어요.');
    notify(result.saved ? '빠른 메모를 저장했어요.' : '메모 저장에 실패했어요.', result.saved ? 'success' : 'error');
    refresh();
  };

  return (
    <div className="lifeHubPage lifeHubHomePage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />
      <section className="lifeHubHero">
        <div>
          <span>개인비서 브리핑</span>
          <h2>{briefTitle}</h2>
          <p>{briefText}</p>
        </div>
        <strong>{compactDateLabel(model.today)}</strong>
      </section>

      <section className="lifeHubBriefGrid lifeHubHomeBriefGrid five" aria-label="오늘 브리핑">
        <article>
          <span>오늘</span>
          <strong>{model.todaySchedules.length}개</strong>
          <small>등록 일정</small>
        </article>
        <article>
          <span>미완료</span>
          <strong>{pendingToday}개</strong>
          <small>{pendingToday ? '처리 필요' : '정리됨'}</small>
        </article>
        <article>
          <span>운동</span>
          <strong>{model.todayWorkout ? '완료' : '기록 전'}</strong>
          <small>{model.todayWorkout ? `${model.todayWorkout.durationMinutes || 0}분` : '오늘 기록 없음'}</small>
        </article>
        <article>
          <span>독서</span>
          <strong>{readingCount ? `${readingCount}권` : '대기'}</strong>
          <small>{model.readingBook ? model.readingBook.title : '읽던 책 없음'}</small>
        </article>
        <article>
          <span>지출</span>
          <strong>{model.budget.usage}%</strong>
          <small>{budgetTone}</small>
        </article>
      </section>

      <HomeFocusCard
        action={firstAction}
        nextSchedule={nextSchedule}
        onDone={(target) => closeAction(target, true)}
        onLater={(target) => closeAction(target)}
        onOpen={navigate}
      />

      {model.nextTrip ? (
        <article className="lifeHubTravelNotice">
          <MemoNavIcon type="trip" />
          <div>
            <strong>여행 준비</strong>
            <p>{tripText} · 준비 {model.nextTrip.checklist.filter((item) => !item.done).length}개 남음</p>
          </div>
          <button type="button" onClick={() => navigate('/travel')}>확인</button>
        </article>
      ) : null}

      <Section title="다음 액션" eyebrow="개인비서 추천">
        <div className="lifeHubActionList">
          {secondaryActions.length ? secondaryActions.map((action) => (
            <AssistantActionCard
              key={action.id}
              action={action}
              onDone={(target) => closeAction(target, true)}
              onLater={(target) => closeAction(target)}
              onOpen={navigate}
            />
          )) : (
            <EmptyState
              title="추가로 챙길 일은 없어요"
              text="새 알림이 생기면 여기에서 바로 보여드릴게요."
              actionLabel="오늘 일정 추가"
              icon="checkSquare"
              onAction={() => navigate('/schedule')}
            />
          )}
        </div>
      </Section>

      <Section title="빠른 입력" eyebrow="바로 남기기" className="lifeHubHomeQuickSection">
        <form className="lifeHubQuickMemo" onSubmit={submitQuickMemo}>
          <label>
            <span>빠른 메모</span>
            <textarea value={quickMemo} onChange={(event) => setQuickMemo(event.target.value)} placeholder="생각난 일 한 줄 입력" rows={2} />
          </label>
          <div className="lifeHubQuickActions">
            <LifeHubButton type="submit" className="primary" icon="edit">저장</LifeHubButton>
            <LifeHubButton icon="calendar" onClick={() => navigate('/schedule')}>일정 추가</LifeHubButton>
            <LifeHubButton icon="trophy" onClick={() => navigate('/workout')}>운동 기록</LifeHubButton>
            <LifeHubButton icon="chart" onClick={() => navigate('/finance')}>지출 기록</LifeHubButton>
          </div>
          {status ? <p className="lifeHubStatus">{status}</p> : null}
        </form>
      </Section>

      <ModuleSummary model={model} navigate={navigate} />
    </div>
  );
}

function ModuleSummary({ model, navigate }) {
  const modules = [
    { key: 'memo', title: '메모', path: '/memo', icon: 'edit', status: `${model.notes.length}개`, text: model.notes[0] ? `최근: ${noteTitle(model.notes[0])}` : '한 줄 메모를 바로 남겨보세요.' },
    { key: 'schedule', title: '일정', path: '/schedule', icon: 'calendar', status: `${model.todaySchedules.length}개`, text: model.missedSchedules.length ? `놓친 일정 ${model.missedSchedules.length}개` : '오늘 해야 할 일을 먼저 보여줘요.' },
    { key: 'reading', title: '독서', path: '/reading', icon: 'book', status: `${model.books.filter((book) => book.status === 'reading').length}권`, text: model.readingBook ? `${model.readingBook.title} 이어보기` : '다음 책을 후보로 넣어두세요.' },
    { key: 'workout', title: '운동', path: '/workout', icon: 'trophy', status: model.todayWorkout ? '완료' : '대기', text: model.todayWorkout ? `${model.todayWorkout.durationMinutes || 0}분 기록` : '15분 운동 기록하기' },
    { key: 'finance', title: '가계부', path: '/finance', icon: 'chart', status: `${model.budget.usage}%`, text: `이번 달 지출 ${money(model.budget.expense)}` },
    { key: 'travel', title: '여행', path: '/travel', icon: 'trip', status: model.nextTrip?.startDate ? dDayLabel(model.nextTrip.startDate) : '준비', text: model.nextTrip?.title || '여행 준비 체크리스트' }
  ];
  return (
    <Section title="모듈 요약" eyebrow="생활 흐름">
      <div className="lifeHubModuleGrid">
        {modules.map((module) => (
          <button type="button" key={module.key} onClick={() => navigate(module.path)}>
            <span><MemoNavIcon type={module.icon} /></span>
            <strong>{module.title}</strong>
            <em>{module.status}</em>
            <small>{module.text}</small>
          </button>
        ))}
      </div>
    </Section>
  );
}

function AssistantPage({ model, actions, session, navigate, refresh, dismissed, setDismissed }) {
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();
  const activeBook = model.readingBook;
  const handleActionDone = (target) => {
    if (target.schedule) {
      const result = updateScheduleDone(session, target.schedule, true);
      notify(result.saved ? '일정을 완료 처리했어요.' : '완료 상태를 저장하지 못했어요.', result.saved ? 'success' : 'error');
    }
    const next = [...dismissed, target.id];
    saveDismissedActions(session, next);
    setDismissed(next);
    refresh();
  };
  const handleLater = (target) => {
    const next = [...dismissed, target.id];
    saveDismissedActions(session, next);
    setDismissed(next);
    notify('나중에 다시 볼게요.');
  };
  const addReadingPages = (pages = 10) => {
    if (!activeBook) {
      navigate('/reading');
      return;
    }
    const currentPage = Math.max(0, Number(activeBook.currentPage) || 0) + pages;
    const finished = activeBook.totalPages && currentPage >= activeBook.totalPages;
    const result = saveBooks(session, readBooks(session).map((book) => (
      book.id === activeBook.id
        ? normalizeBook({
          ...book,
          currentPage: finished ? book.totalPages : currentPage,
          status: finished ? 'finished' : 'reading',
          finishedAt: finished ? model.today : book.finishedAt,
          updatedAt: new Date().toISOString()
        })
        : book
    )));
    notify(result.saved ? `독서 진도를 +${pages}p 업데이트했어요.` : '독서 기록 저장에 실패했어요.', result.saved ? 'success' : 'error');
    refresh();
  };
  const recordQuickWorkout = (minutes = 20) => {
    const template = WORKOUT_TEMPLATES[0];
    const exercises = exercisesForTemplate(template.id);
    const calories = estimateWorkoutCalories({
      templateId: template.id,
      durationMinutes: String(minutes),
      exercises,
      profile: model.workoutProfile
    }) || 0;
    const log = normalizeWorkout({
      id: `workout-${Date.now()}`,
      templateId: template.id,
      title: template.title,
      date: model.today,
      durationMinutes: minutes,
      caloriesBurned: calories,
      exercises,
      memo: '비서 화면 빠른 기록',
      createdAt: new Date().toISOString()
    });
    const workoutResult = saveWorkouts(session, [log, ...readWorkouts(session)]);
    const schedule = normalizeSchedule({
      id: `workout-schedule-${log.id}`,
      title: `${log.title} 운동`,
      date: log.date,
      time: '20:00',
      type: '운동',
      memo: `${log.durationMinutes}분 · ${log.caloriesBurned}kcal`,
      source: 'workout',
      origin: { kind: 'workout', workoutLogId: log.id },
      done: true
    });
    const scheduleResult = saveSchedules(session, [...readSchedules(session), schedule]);
    notify(workoutResult.saved && scheduleResult.saved ? '20분 운동을 바로 기록했어요.' : '운동 기록 저장에 문제가 있었어요.', workoutResult.saved && scheduleResult.saved ? 'success' : 'error');
    refresh();
  };

  return (
    <div className="lifeHubPage lifeHubAssistantPage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />

      <Section title="오늘의 체크리스트" eyebrow="비서 센터">
        <div className="lifeHubChecklist">
          {[
            { text: '오늘 일정 확인', done: model.todaySchedules.length > 0 && model.todaySchedules.every((item) => item.done), route: '/schedule' },
            { text: '빠른 메모 비우기', done: model.notes.length > 0, route: '/memo' },
            { text: '운동 기록 남기기', done: Boolean(model.todayWorkout), route: '/workout' },
            { text: '지출 흐름 확인', done: model.budget.usage < 80, route: '/finance' }
          ].map((item) => (
            <button type="button" key={item.text} onClick={() => navigate(item.route)} className={item.done ? 'done' : ''}>
              <span>{item.done ? '완료' : '확인'}</span>
              <strong>{item.text}</strong>
            </button>
          ))}
        </div>
      </Section>

      {model.missedSchedules.length ? (
        <Section title="놓친 일정이 있어요" eyebrow="먼저 정리">
          <ScheduleMiniList
            items={model.missedSchedules}
            empty="놓친 일정은 없어요"
            tone="danger"
            onToggle={(item) => {
              const result = updateScheduleDone(session, item, !item.done);
              notify(result.saved ? '놓친 일정을 완료 처리했어요.' : '상태를 저장하지 못했어요.', result.saved ? 'success' : 'error');
              refresh();
            }}
          />
        </Section>
      ) : null}

      <section className="lifeHubAssistantHero">
        <span>개인비서 브리핑</span>
        <h2>{actions.length ? '오늘 볼 일을 정리했어요' : '지금은 급한 일이 없어요'}</h2>
        <p>{actions.length ? '필요한 일만 완료, 기록하기, 나중에로 빠르게 처리하세요.' : '일정이나 기록이 생기면 다시 알려드릴게요.'}</p>
      </section>

      <Section title="오늘 일정" eyebrow="시간순">
        <ScheduleMiniList
          items={model.todaySchedules}
          empty="오늘 등록된 일정은 없어요"
          emptyText="필요한 할 일이 생기면 일정에 바로 남겨두세요."
          emptyActionLabel="오늘 일정 추가"
          onEmptyAction={() => navigate('/schedule')}
          onToggle={(item) => {
            const result = updateScheduleDone(session, item, !item.done);
            notify(result.saved ? (item.done ? '일정을 다시 대기로 돌렸어요.' : '일정을 완료 처리했어요.') : '상태를 저장하지 못했어요.', result.saved ? 'success' : 'error');
            refresh();
          }}
        />
      </Section>

      <Section title="추천 액션" eyebrow="생활관리">
        <div className="lifeHubActionList">
          {actions.length ? actions.map((action) => (
            <AssistantActionCard
              key={action.id}
              action={action}
              onDone={handleActionDone}
              onLater={handleLater}
              onOpen={navigate}
            />
          )) : (
            <EmptyState
              title="지금은 급한 일이 없어요"
              text="오늘은 가볍게 기록만 남겨도 충분해요."
              actionLabel="빠른 메모 남기기"
              icon="spark"
              onAction={() => navigate('/memo')}
            />
          )}
        </div>
      </Section>

      <Section title="최근 메모" eyebrow="꺼내볼 것">
        <div className="lifeHubMiniCards">
          {model.notes.slice(0, 3).map((note) => (
            <button type="button" key={note.id} onClick={() => navigate('/memo')}>
              <strong>{noteTitle(note)}</strong>
              <small>{noteBody(note) || '나중에 비서가 다시 꺼내볼 수 있게 정리해둘게요.'}</small>
            </button>
          ))}
          {model.notes.length ? null : <EmptyState title="최근 메모는 아직 없어요" text="생각난 내용을 한 줄만 남겨도 다시 꺼내볼 수 있어요." />}
        </div>
      </Section>

      <section className="lifeHubReminderGrid actionable" aria-label="운동 독서 지출 리마인더">
        <article>
          <span>운동</span>
          <strong>{model.todayWorkout ? '오늘 운동 완료' : '오늘 운동 기록 전'}</strong>
          <div>
            {model.todayWorkout ? (
              <button type="button" onClick={() => navigate('/workout')}>기록 보기</button>
            ) : (
              <button type="button" onClick={() => recordQuickWorkout(20)}>20분 기록</button>
            )}
          </div>
        </article>
        <article>
          <span>독서</span>
          <strong>{model.readingBook ? `${model.readingBook.title} 이어보기` : '읽는 중인 책을 골라두세요'}</strong>
          <div>
            {model.readingBook ? (
              <button type="button" onClick={() => addReadingPages(10)}>+10p</button>
            ) : (
              <button type="button" onClick={() => navigate('/reading')}>책 추가</button>
            )}
          </div>
        </article>
        <article className={model.budget.usage >= 80 ? 'warn' : ''}>
          <span>예산</span>
          <strong>사용률 {model.budget.usage}%</strong>
          <div><button type="button" onClick={() => navigate('/finance')}>지출 기록</button></div>
        </article>
        {model.nextTrip ? (
          <article>
            <span>여행</span>
            <strong>{model.nextTrip.title} {model.nextTrip.startDate ? dDayLabel(model.nextTrip.startDate) : ''}</strong>
            <div><button type="button" onClick={() => navigate('/travel')}>준비 보기</button></div>
          </article>
        ) : null}
      </section>
    </div>
  );
}

function ScheduleMiniList({ items, empty, emptyText, emptyActionLabel, onEmptyAction, onToggle, onDelete, tone = '' }) {
  if (!items.length) {
    return (
      <EmptyState
        title={empty}
        text={emptyText}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
        icon="calendar"
      />
    );
  }
  return (
    <div className={`lifeHubScheduleMiniList ${tone}`.trim()}>
      {items.map((item) => (
        <article key={item.id} className={[item.done ? 'done' : '', item.priority === '높음' ? 'urgent' : ''].filter(Boolean).join(' ')}>
          <button type="button" onClick={() => onToggle(item)} aria-label={`${item.title} 완료 상태 변경`}>
            <span>{item.done ? '완료' : item.date < todayKey() ? '놓침' : '대기'}</span>
          </button>
          <div>
            <strong>{item.title}</strong>
            <small>{item.priority === '높음' ? '급함 · ' : ''}{compactDateLabel(item.date)} · {item.time || '종일'} · {item.type}</small>
          </div>
          {onDelete ? (
            <button type="button" className="lifeHubInlineDelete" onClick={() => onDelete(item)} aria-label={`${item.title} 삭제`}>
              삭제
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function MemoPage({ model, session, refresh }) {
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState(NOTE_FILTER_ALL);
  const [draft, setDraft] = useState({ title: '', body: '', tags: '' });
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();
  const notes = model.notes;
  const tags = [NOTE_FILTER_ALL, ...new Set(notes.flatMap((note) => note.tags || []))].slice(0, 12);
  const visible = notes.filter((note) => {
    const haystack = `${noteTitle(note)} ${noteBody(note)} ${(note.tags || []).join(' ')}`.toLowerCase();
    const matchQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    const matchTag = tag === NOTE_FILTER_ALL || (note.tags || []).includes(tag);
    return matchQuery && matchTag;
  });
  const pinned = visible.filter((note) => note.pinned);
  const recent = visible.filter((note) => !note.pinned);

  const submitMemo = (event) => {
    event.preventDefault();
    if (!draft.title.trim() && !draft.body.trim()) {
      notify('메모할 내용을 한 줄만 입력해주세요.', 'error');
      return;
    }
    const title = draft.title.trim() || draft.body.trim().split('\n')[0]?.slice(0, 48) || '빠른 메모';
    const body = draft.body.trim();
    const nextNote = normalizeNote({
      id: `note-${Date.now()}`,
      title,
      content: `# ${title}${body ? `\n\n${body}` : '\n'}`,
      boardId: 'personal',
      folderId: 'personal',
      tags: draft.tags.split(',').map((item) => item.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    const result = saveNotes(session, [nextNote, ...readNotes(session)]);
    setDraft({ title: '', body: '', tags: '' });
    notify(result.saved ? '메모를 저장했어요.' : '메모 저장에 실패했어요.', result.saved ? 'success' : 'error');
    refresh();
  };

  const togglePinned = (note) => {
    const result = saveNotes(session, readNotes(session).map((item) => (item.id === note.id ? { ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() } : item)));
    notify(result.saved ? (note.pinned ? '고정을 해제했어요.' : '중요 메모로 고정했어요.') : '메모 상태를 저장하지 못했어요.', result.saved ? 'success' : 'error');
    refresh();
  };

  const deleteMemo = (note) => {
    if (!window.confirm('이 메모를 삭제할까요?')) return;
    const result = saveNotes(session, readNotes(session).filter((item) => item.id !== note.id));
    notify(result.saved ? '메모를 삭제했어요.' : '메모 삭제를 저장하지 못했어요.', result.saved ? 'success' : 'error');
    refresh();
  };

  return (
    <div className="lifeHubPage lifeHubMemoPage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />
      <section className="lifeHubCompactHero">
        <span>개인비서 브리핑</span>
        <h2>잊기 전에 남겨두세요</h2>
        <p>중요한 메모는 고정해두고, 나머지는 최근순으로 정리해둘게요.</p>
      </section>

      <form className="lifeHubMemoComposer lifeHubFastForm" onSubmit={submitMemo}>
        <label>
          <span>빠른 메모</span>
          <textarea value={draft.body} onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))} placeholder="예: 내일 병원 예약 확인" rows={2} />
        </label>
        <QuickChoiceGroup
          label="예시"
          options={['장보기', '병원 예약', '아이디어', '나중에 확인']}
          value=""
          onChange={(value) => setDraft((current) => ({ ...current, body: current.body ? `${current.body}\n${value}` : value }))}
        />
        <details className="lifeHubInlineDetails">
          <summary>제목/태그 더하기</summary>
          <label>
            <span>제목</span>
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="비워두면 첫 줄로 저장" />
          </label>
          <label>
            <span>태그</span>
            <input value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="일정, 건강" />
          </label>
        </details>
        <LifeHubButton type="submit" className="primary" icon="plus">메모 저장</LifeHubButton>
      </form>

      <section className="lifeHubFilterCard lifeHubSearchFilter">
        <label>
          <span>검색</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="메모 검색" />
        </label>
        <div className="lifeHubChipRow" aria-label="태그 필터">
          {tags.map((item) => (
            <button type="button" key={item} className={tag === item ? 'active' : ''} onClick={() => setTag(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>

      <Section title="고정 메모" eyebrow="중요">
        <MemoList notes={pinned} onPin={togglePinned} onDelete={deleteMemo} empty="고정한 메모는 아직 없어요" emptyText="중요한 메모는 고정해두면 먼저 볼 수 있어요." />
      </Section>
      <Section title="최근 메모" eyebrow={`${recent.length}개`}>
        <MemoList notes={recent} onPin={togglePinned} onDelete={deleteMemo} empty="아직 메모가 없어요" emptyText="오늘 기억할 일이나 떠오른 생각을 한 줄로 맡겨보세요." actionLabel="예시 메모 넣기" onEmptyAction={() => setDraft({ title: '', body: '오늘 기억할 일', tags: '개인' })} />
      </Section>
    </div>
  );
}

function MemoList({ notes, onPin, onDelete, empty, emptyText, actionLabel, onEmptyAction }) {
  if (!notes.length) {
    return <EmptyState title={empty} text={emptyText || '검색어나 태그를 바꾸면 다른 메모를 볼 수 있어요.'} actionLabel={actionLabel} onAction={onEmptyAction} icon="edit" />;
  }
  return (
    <div className="lifeHubMemoList">
      {notes.map((note) => (
        <article key={note.id} className={note.pinned ? 'pinned' : ''}>
          <header>
            <strong>{noteTitle(note)}</strong>
            <div className="lifeHubCardActions">
              <button type="button" onClick={() => onPin(note)} aria-label={`${noteTitle(note)} 고정 상태 변경`}>
                {note.pinned ? '고정됨' : '고정'}
              </button>
              <button type="button" className="quiet" onClick={() => onDelete(note)} aria-label={`${noteTitle(note)} 삭제`}>
                삭제
              </button>
            </div>
          </header>
          <p>{noteBody(note) || '본문 없이 제목만 저장됐어요.'}</p>
          <footer>
            <span>{(note.updatedAt || note.createdAt || '').slice(0, 10)}</span>
            <div>{(note.tags || []).slice(0, 3).map((tag) => <em key={tag}>{tag}</em>)}</div>
          </footer>
        </article>
      ))}
    </div>
  );
}

function SchedulePage({ model, session, refresh }) {
  const [filter, setFilter] = useState('오늘');
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();
  const [draft, setDraft] = useState({
    title: '',
    date: model.today,
    time: '09:00',
    type: '개인',
    priority: '보통',
    memo: ''
  });
  const source = filter === '오늘'
    ? model.todaySchedules
    : filter === '예정'
      ? model.upcomingSchedules
      : filter === '놓친 일정'
        ? model.missedSchedules
        : model.expandedSchedules.filter((item) => item.done).slice(0, 20);

  const submitSchedule = (event) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      notify('일정 제목을 입력해주세요.', 'error');
      return;
    }
    const next = normalizeSchedule({ ...draft, id: `schedule-${Date.now()}`, done: false });
    const result = saveSchedules(session, [...readSchedules(session), next]);
    setDraft((current) => ({ ...current, title: '', memo: '' }));
    notify(result.saved ? '일정을 저장했어요.' : '일정 저장에 실패했어요.', result.saved ? 'success' : 'error');
    refresh();
  };

  const deleteSchedule = (item) => {
    if (!window.confirm('이 일정을 삭제할까요?')) return;
    const sourceId = item.sourceId || item.scheduleId || item.id;
    const result = saveSchedules(session, readSchedules(session).filter((schedule) => schedule.id !== sourceId));
    notify(result.saved ? '일정을 삭제했어요.' : '일정 삭제를 저장하지 못했어요.', result.saved ? 'success' : 'error');
    refresh();
  };

  return (
    <div className="lifeHubPage lifeHubSchedulePage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />
      <section className="lifeHubCompactHero">
        <span>개인비서 브리핑</span>
        <h2>{model.missedSchedules.length ? '놓친 일정이 있어요' : '오늘 처리할 일정'}</h2>
        <p>놓친 일정과 다음 할 일을 짧게 보고 바로 완료 처리하세요.</p>
      </section>

      <div className="lifeHubChipRow sticky" aria-label="일정 필터">
        {SCHEDULE_FILTERS.map((item) => (
          <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>
            {item}
          </button>
        ))}
      </div>

      <ScheduleMiniList
        items={source}
        empty={filter === '오늘' ? '오늘 일정이 비어 있어요' : `${filter}이 비어 있어요`}
        emptyText={filter === '오늘' ? '필요한 할 일을 등록하면 시간순으로 정리해둘게요.' : '조건에 맞는 일정이 생기면 여기에 보여드릴게요.'}
        emptyActionLabel="오늘 일정 추가"
        onEmptyAction={() => setFilter('오늘')}
        onToggle={(item) => {
          const result = updateScheduleDone(session, item, !item.done);
          notify(result.saved ? (item.done ? '일정을 다시 대기로 돌렸어요.' : '완료한 일정으로 정리했어요.') : '상태를 저장하지 못했어요.', result.saved ? 'success' : 'error');
          refresh();
        }}
        onDelete={deleteSchedule}
      />

      <form className="lifeHubFormCard lifeHubFastForm" onSubmit={submitSchedule}>
        <header>
          <strong>일정 추가</strong>
          <small>제목만 입력해도 저장할 수 있어요.</small>
        </header>
        <label>
          <span>제목</span>
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="예: 오후 회의 준비" />
        </label>
        <QuickChoiceGroup
          label="중요도"
          options={SCHEDULE_PRIORITY_OPTIONS}
          value={draft.priority}
          onChange={(priority) => setDraft((current) => ({ ...current, priority }))}
        />
        <QuickChoiceGroup
          label="빠른 날짜"
          options={[{ value: model.today, label: '오늘' }, { value: addDays(model.today, 1), label: '내일' }]}
          value={draft.date}
          onChange={(date) => setDraft((current) => ({ ...current, date }))}
        />
        <div className="lifeHubTwoCol">
          <label>
            <span>날짜</span>
            <input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} />
          </label>
          <label>
            <span>시간</span>
            <input type="time" value={draft.time} onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))} />
          </label>
        </div>
        <details className="lifeHubInlineDetails">
          <summary>카테고리/메모 더하기</summary>
          <label>
            <span>카테고리</span>
            <select value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}>
              {SCHEDULE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>메모</span>
            <input value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} placeholder="간단한 설명" />
          </label>
        </details>
        <LifeHubButton type="submit" className="primary" icon="plus">일정 저장</LifeHubButton>
      </form>
    </div>
  );
}

function ReadingPage({ model, session, refresh }) {
  const [status, setStatus] = useState('reading');
  const [draft, setDraft] = useState({ title: '', author: '', status: 'reading', totalPages: '', memo: '' });
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();
  const visible = model.books.filter((book) => book.status === status);
  const activeBook = model.books.find((book) => book.status === 'reading') || null;
  const counts = READING_STATUSES.reduce((summary, item) => ({ ...summary, [item.id]: model.books.filter((book) => book.status === item.id).length }), {});

  const submitBook = (event) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      notify('책 제목을 입력해주세요.', 'error');
      return;
    }
    const book = normalizeBook({
      id: `book-${Date.now()}`,
      ...draft,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startedAt: draft.status === 'reading' ? model.today : '',
      finishedAt: draft.status === 'finished' ? model.today : ''
    });
    const result = saveBooks(session, [book, ...readBooks(session)]);
    setDraft({ title: '', author: '', status: 'reading', totalPages: '', memo: '' });
    notify(result.saved ? '책을 추가했어요.' : '책 저장에 실패했어요.', result.saved ? 'success' : 'error');
    refresh();
  };

  const updateBook = (book, patch) => {
    const result = saveBooks(session, readBooks(session).map((item) => (item.id === book.id ? normalizeBook({ ...item, ...patch, updatedAt: new Date().toISOString() }) : item)));
    notify(result.saved ? '독서 기록을 업데이트했어요.' : '독서 기록 저장에 실패했어요.', result.saved ? 'success' : 'error');
    refresh();
  };

  const addPages = (book, pages = 10) => {
    const currentPage = Math.max(0, Number(book.currentPage) || 0) + pages;
    const finished = book.totalPages && currentPage >= book.totalPages;
    updateBook(book, {
      currentPage: finished ? book.totalPages : currentPage,
      status: finished ? 'finished' : 'reading',
      finishedAt: finished ? model.today : book.finishedAt
    });
  };

  return (
    <div className="lifeHubPage lifeHubReadingPage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />
      <section className="lifeHubCompactHero">
        <span>개인비서 브리핑</span>
        <h2>{activeBook ? '오늘 10페이지만 이어볼까요?' : '읽는 중인 책을 골라두세요'}</h2>
        <p>읽던 책을 먼저 보여주고, 관심 책과 완독 기록은 아래에 정리합니다.</p>
      </section>

      {activeBook ? (
        <article className="lifeHubContinueCard lifeHubReadingFocus">
          <div>
            <span>읽는 중인 책</span>
            <strong>{activeBook.title}</strong>
            <p>{activeBook.author || '저자 미입력'} · {readingProgress(activeBook)}%</p>
            <div className="lifeHubProgress"><span style={{ width: `${readingProgress(activeBook)}%` }} /></div>
          </div>
          <div className="lifeHubActionButtons">
            <button type="button" onClick={() => addPages(activeBook, 10)}>+10p</button>
            <button type="button" onClick={() => addPages(activeBook, 20)}>+20p</button>
            <button type="button" className="primary" onClick={() => updateBook(activeBook, { status: 'finished', currentPage: activeBook.totalPages || activeBook.currentPage, finishedAt: model.today })}>완독</button>
          </div>
        </article>
      ) : (
        <EmptyState title="읽는 중인 책이 없어요" text="읽을 책을 추가하면 홈에서 바로 이어볼 수 있어요." actionLabel="읽을 책 추가" icon="book" onAction={() => setStatus('interested')} />
      )}

      <section className="lifeHubBriefGrid three" aria-label="독서 통계">
        {READING_STATUSES.map((item) => (
          <article key={item.id}>
            <span>{item.label}</span>
            <strong>{counts[item.id] || 0}권</strong>
          </article>
        ))}
      </section>

      <div className="lifeHubChipRow" aria-label="책 상태 필터">
        {READING_STATUSES.map((item) => (
          <button type="button" key={item.id} className={status === item.id ? 'active' : ''} onClick={() => setStatus(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="lifeHubBookList">
        {visible.map((book) => (
          <article key={book.id} className={book.status === 'finished' ? 'finished' : ''}>
            <header>
              <div>
                <strong>{book.title}</strong>
                <small>{book.author || '저자 미입력'}</small>
              </div>
              <span>{'★'.repeat(Math.round(book.rating || 0)) || '평점 전'}</span>
            </header>
            <div className="lifeHubProgress"><span style={{ width: `${readingProgress(book)}%` }} /></div>
            <p>{book.memo || READING_STATUSES.find((item) => item.id === book.status)?.empty}</p>
            <div className="lifeHubActionButtons">
              <button type="button" onClick={() => addPages(book, 10)}>+10p</button>
              <button type="button" onClick={() => addPages(book, 20)}>+20p</button>
              <button type="button" onClick={() => updateBook(book, { status: 'reading', startedAt: book.startedAt || model.today })}>읽는 중</button>
              <button type="button" className="primary" onClick={() => updateBook(book, { status: 'finished', finishedAt: model.today })}>완독</button>
            </div>
          </article>
        ))}
        {visible.length ? null : (
          <EmptyState
            title={READING_STATUSES.find((item) => item.id === status)?.empty}
            text="제목만 넣어도 목록에 바로 추가됩니다."
            actionLabel="책 제목 입력"
            icon="book"
            onAction={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
          />
        )}
      </div>

      <form className="lifeHubFormCard lifeHubFastForm" onSubmit={submitBook}>
        <header>
          <strong>책 추가</strong>
          <small>제목만 먼저 넣고, 자세한 정보는 나중에 채워도 됩니다.</small>
        </header>
        <label><span>제목</span><input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="책 제목" /></label>
        <QuickChoiceGroup
          label="상태"
          options={READING_STATUSES.map((item) => ({ value: item.id, label: item.label }))}
          value={draft.status}
          onChange={(nextStatus) => setDraft((current) => ({ ...current, status: nextStatus }))}
        />
        <details className="lifeHubInlineDetails">
          <summary>저자/페이지/메모 더하기</summary>
          <label><span>저자</span><input value={draft.author} onChange={(event) => setDraft((current) => ({ ...current, author: event.target.value }))} placeholder="저자" /></label>
          <label><span>전체 페이지</span><input type="number" min="0" value={draft.totalPages} onChange={(event) => setDraft((current) => ({ ...current, totalPages: event.target.value }))} placeholder="300" /></label>
          <label><span>메모</span><input value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} placeholder="읽고 싶은 이유" /></label>
        </details>
        <LifeHubButton type="submit" className="primary" icon="plus">책 저장</LifeHubButton>
      </form>
    </div>
  );
}

function readingProgress(book) {
  if (!book?.totalPages) return book?.status === 'finished' ? 100 : 0;
  return Math.min(100, Math.round(((Number(book.currentPage) || 0) / book.totalPages) * 100));
}

function WorkoutPage({ model, session, refresh }) {
  const [profile, setProfile] = useState(model.workoutProfile);
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();
  const [draft, setDraft] = useState({
    templateId: 'upper',
    date: model.today,
    startTime: '',
    durationMinutes: '15',
    memo: '',
    addToSchedule: true,
    exercises: exercisesForTemplate('upper')
  });
  const template = WORKOUT_TEMPLATES.find((item) => item.id === draft.templateId) || WORKOUT_TEMPLATES[0];
  const bmr = calculateWorkoutBmr(profile);
  const monthLogs = model.workouts.filter((log) => log.date.startsWith(monthKey(model.today)));
  const totalMinutes = monthLogs.reduce((sum, log) => sum + (Number(log.durationMinutes) || 0), 0);
  const totalCalories = monthLogs.reduce((sum, log) => sum + (Number(log.caloriesBurned) || 0), 0);
  const estimatedCalories = estimateWorkoutCalories({
    templateId: draft.templateId,
    durationMinutes: draft.durationMinutes,
    exercises: draft.exercises,
    profile
  }) || 0;

  const selectTemplate = (templateId) => {
    if (templateId === 'stretching') {
      const activity = cardioActivityForId('stretching') || WORKOUT_CARDIO_ACTIVITIES[0];
      setDraft((current) => ({
        ...current,
        templateId: 'cardio',
        exercises: [createCardioExercise(activity)]
      }));
      return;
    }
    setDraft((current) => ({ ...current, templateId, exercises: exercisesForTemplate(templateId) }));
  };
  const stretchingActivity = cardioActivityForId('stretching');
  const selectedWorkoutChoice = draft.templateId === 'cardio' && draft.exercises.some((exercise) => exercise.name === stretchingActivity?.name)
    ? 'stretching'
    : draft.templateId;

  const submitWorkout = (event) => {
    event.preventDefault();
    const duration = workoutDurationMinutes({ templateId: draft.templateId, durationMinutes: draft.durationMinutes, exercises: draft.exercises });
    if (!duration) {
      notify('운동 시간을 선택하거나 입력해주세요.', 'error');
      return;
    }
    const profileResult = saveWorkoutProfile(session, profile);
    const log = normalizeWorkout({
      id: `workout-${Date.now()}`,
      templateId: draft.templateId,
      title: template.title,
      date: draft.date,
      startTime: draft.startTime,
      durationMinutes: duration,
      caloriesBurned: estimatedCalories,
      memo: draft.memo,
      exercises: draft.exercises,
      createdAt: new Date().toISOString()
    });
    const workoutResult = saveWorkouts(session, [log, ...readWorkouts(session)]);
    if (draft.addToSchedule) {
      const schedule = normalizeSchedule({
        id: `workout-schedule-${log.id}`,
        title: `${log.title} 운동`,
        date: log.date,
        time: log.startTime || '20:00',
        type: '운동',
        memo: `${log.durationMinutes}분 · ${log.caloriesBurned}kcal`,
        source: 'workout',
        origin: { kind: 'workout', workoutLogId: log.id },
        done: true
      });
      saveSchedules(session, [...readSchedules(session).filter((item) => item.id !== schedule.id), schedule]);
    }
    setDraft((current) => ({ ...current, startTime: '', memo: '' }));
    notify(workoutResult.saved && profileResult.saved ? '오늘 운동 완료로 기록했어요.' : '운동 기록 저장에 문제가 있었어요.', workoutResult.saved && profileResult.saved ? 'success' : 'error');
    refresh();
  };

  return (
    <div className="lifeHubPage lifeHubWorkoutPage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />
      <section className={`lifeHubWorkoutStatus ${model.todayWorkout ? 'done' : ''}`}>
        <span>개인비서 브리핑 · {model.todayWorkout ? '오늘 운동 완료' : '운동 리마인더'}</span>
        <h2>{model.todayWorkout ? `${model.todayWorkout.title} · ${model.todayWorkout.durationMinutes}분` : '오늘 아직 운동 기록이 없어요'}</h2>
        <p>{model.todayWorkout ? '오늘 기록은 완료됐어요. 필요하면 아래에서 추가 기록을 남길 수 있어요.' : '15분만 기록해도 오늘 루틴을 이어갈 수 있어요.'}</p>
      </section>

      <section className="lifeHubBriefGrid three" aria-label="운동 통계">
        <article><span>이번 달 운동일</span><strong>{new Set(monthLogs.map((log) => log.date)).size}일</strong></article>
        <article><span>총 운동시간</span><strong>{totalMinutes}분</strong></article>
        <article><span>소모 kcal</span><strong>{MONEY.format(totalCalories)}kcal</strong></article>
      </section>

      <details className="lifeHubDetailsCard lifeHubOptionalFields" open={!bmr}>
        <summary>몸 정보와 BMR {bmr ? `${MONEY.format(bmr)}kcal` : '입력'}</summary>
        <div className="lifeHubTwoCol">
          <label><span>몸무게 kg</span><input inputMode="decimal" value={profile.weightKg} onChange={(event) => setProfile((current) => ({ ...current, weightKg: event.target.value }))} /></label>
          <label><span>키 cm</span><input inputMode="decimal" value={profile.heightCm} onChange={(event) => setProfile((current) => ({ ...current, heightCm: event.target.value }))} /></label>
          <label><span>나이</span><input inputMode="numeric" value={profile.age} onChange={(event) => setProfile((current) => ({ ...current, age: event.target.value }))} /></label>
          <label>
            <span>성별</span>
            <select value={profile.sex} onChange={(event) => setProfile((current) => ({ ...current, sex: event.target.value }))}>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </label>
        </div>
      </details>

      <form className="lifeHubFormCard lifeHubFastForm" onSubmit={submitWorkout}>
        <header><strong>운동 기록</strong><small>종류와 시간만 고르면 바로 저장됩니다.</small></header>
        <QuickChoiceGroup
          label="운동 종류"
          options={[
            { value: 'upper', label: '상체' },
            { value: 'lower', label: '하체' },
            { value: 'cardio', label: '유산소' },
            { value: 'stretching', label: '스트레칭' }
          ]}
          value={selectedWorkoutChoice}
          onChange={selectTemplate}
        />
        <QuickChoiceGroup
          label="운동 시간"
          options={[15, 20, 30, 45].map((minutes) => ({ value: String(minutes), label: `${minutes}분` }))}
          value={String(draft.durationMinutes)}
          onChange={(durationMinutes) => setDraft((current) => ({ ...current, durationMinutes }))}
        />
        <div className="lifeHubTwoCol">
          <label><span>날짜</span><input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label>
          <label><span>시작 시간</span><input type="time" value={draft.startTime} onChange={(event) => setDraft((current) => ({ ...current, startTime: event.target.value }))} /></label>
        </div>
        <details className="lifeHubInlineDetails">
          <summary>세트 기록은 선택 입력</summary>
          <div className="lifeHubExerciseList">
            {draft.exercises.map((exercise, index) => (
              <article key={exercise.id || index}>
                <label>
                  <span>{draft.templateId === 'cardio' ? '운동 선택' : '운동명'}</span>
                  {draft.templateId === 'cardio' ? (
                    <select
                      value={WORKOUT_CARDIO_ACTIVITIES.find((item) => item.name === exercise.name)?.id || WORKOUT_CARDIO_ACTIVITIES[0].id}
                      onChange={(event) => {
                        const activity = cardioActivityForId(event.target.value) || WORKOUT_CARDIO_ACTIVITIES[0];
                        setDraft((current) => ({
                          ...current,
                          exercises: current.exercises.map((item, itemIndex) => (
                            itemIndex === index ? { ...item, mode: 'cardio', name: activity.name, met: String(activity.met), durationMinutes: current.durationMinutes } : item
                          ))
                        }));
                      }}
                    >
                      {WORKOUT_CARDIO_ACTIVITIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  ) : (
                    <input value={exercise.name} onChange={(event) => setDraft((current) => ({ ...current, exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} />
                  )}
                </label>
                {draft.templateId === 'cardio' ? (
                  <label><span>분</span><input inputMode="numeric" value={exercise.durationMinutes || draft.durationMinutes} onChange={(event) => setDraft((current) => ({ ...current, exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, durationMinutes: event.target.value } : item) }))} /></label>
                ) : (
                  <div className="lifeHubThreeCol">
                    <label><span>세트</span><input inputMode="numeric" value={exercise.sets} onChange={(event) => setDraft((current) => ({ ...current, exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, sets: event.target.value } : item) }))} /></label>
                    <label><span>횟수</span><input inputMode="numeric" value={exercise.reps} onChange={(event) => setDraft((current) => ({ ...current, exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, reps: event.target.value } : item) }))} /></label>
                    <label><span>무게</span><input inputMode="decimal" value={exercise.weight} onChange={(event) => setDraft((current) => ({ ...current, exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, weight: event.target.value } : item) }))} /></label>
                  </div>
                )}
              </article>
            ))}
          </div>
        </details>
        <label><span>메모</span><input value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} placeholder="컨디션, 난이도" /></label>
        <label className="lifeHubCheckLine"><input type="checkbox" checked={draft.addToSchedule} onChange={(event) => setDraft((current) => ({ ...current, addToSchedule: event.target.checked }))} /><span>저장 시 일정에도 등록</span></label>
        <LifeHubButton type="submit" className="primary" icon="trophy">운동 저장 · 예상 {MONEY.format(estimatedCalories)}kcal</LifeHubButton>
      </form>
    </div>
  );
}

function FinancePage({ model, session, refresh }) {
  const [draft, setDraft] = useState({ type: 'withdraw', amount: '', category: '식비', memo: '', date: model.today });
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();
  const categories = Object.entries(model.budget.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const submitEntry = (event) => {
    event.preventDefault();
    const entry = normalizeBudget({ id: `budget-${Date.now()}`, ...draft, createdAt: new Date().toISOString() });
    if (!entry) {
      notify('금액을 입력해주세요.', 'error');
      return;
    }
    const result = saveBudget(session, [entry, ...readBudget(session)]);
    setDraft((current) => ({ ...current, amount: '', memo: '' }));
    notify(result.saved ? '거래를 저장했어요.' : '거래 저장에 실패했어요.', result.saved ? 'success' : 'error');
    refresh();
  };

  const deleteEntry = (entry) => {
    if (!window.confirm('이 거래를 삭제할까요?')) return;
    const result = saveBudget(session, readBudget(session).filter((item) => item.id !== entry.id));
    notify(result.saved ? '거래를 삭제했어요.' : '거래 삭제를 저장하지 못했어요.', result.saved ? 'success' : 'error');
    refresh();
  };

  return (
    <div className="lifeHubPage lifeHubFinancePage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />
      <section className="lifeHubCompactHero">
        <span>개인비서 브리핑</span>
        <h2>이번 달 돈 흐름을 짧게 볼게요</h2>
        <p>예산 사용률과 최근 거래만 먼저 보여드립니다.</p>
      </section>
      {model.budget.usage >= 80 ? (
        <article className="lifeHubWarningCard">
          <strong>지출 속도가 빨라요</strong>
          <p>이번 달 예산 대비 사용률이 {model.budget.usage}%입니다. 오늘 기록할 지출이 있나요?</p>
        </article>
      ) : null}
      <section className="lifeHubBriefGrid three" aria-label="가계부 요약">
        <article><span>이번 달 수입</span><strong>{money(model.budget.income)}</strong></article>
        <article><span>이번 달 지출</span><strong>{money(model.budget.expense)}</strong></article>
        <article><span>잔액</span><strong>{money(model.budget.balance)}</strong></article>
      </section>
      <section className="lifeHubProgressCard">
        <header><strong>예산 대비 사용률</strong><span>{model.budget.usage}%</span></header>
        <div className="lifeHubProgress"><span style={{ width: `${Math.min(100, model.budget.usage)}%` }} /></div>
        <small>수입이 없으면 월 기준 100만원으로 계산합니다.</small>
      </section>
      <Section title="카테고리별 지출" eyebrow="이번 달">
        <div className="lifeHubCategoryBars">
          {categories.map(([category, amount]) => (
            <article key={category}>
              <div><strong>{category}</strong><span>{money(amount)}</span></div>
              <div><span style={{ width: `${Math.min(100, Math.round((amount / Math.max(1, model.budget.expense)) * 100))}%` }} /></div>
            </article>
          ))}
          {categories.length ? null : <EmptyState title="이번 달 지출은 아직 없어요" text="오늘 사용한 금액을 남기면 카테고리 흐름을 보여드릴게요." actionLabel="지출 기록하기" icon="chart" onAction={() => setDraft((current) => ({ ...current, type: 'withdraw' }))} />}
        </div>
      </Section>
      <form className="lifeHubFormCard lifeHubFastForm" onSubmit={submitEntry}>
        <header><strong>빠른 수입/지출 입력</strong><small>오늘 기록할 지출이 있나요?</small></header>
        <QuickChoiceGroup
          label="유형"
          options={[{ value: 'withdraw', label: '지출' }, { value: 'deposit', label: '수입' }]}
          value={draft.type}
          onChange={(type) => setDraft((current) => ({ ...current, type, category: type === 'deposit' ? '수입' : current.category === '수입' ? '식비' : current.category }))}
        />
        <div className="lifeHubTwoCol">
          <label><span>금액</span><input type="number" inputMode="numeric" min="0" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0" /></label>
          <label><span>날짜</span><input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label>
        </div>
        {draft.type === 'withdraw' ? (
          <QuickChoiceGroup
            label="카테고리"
            options={BUDGET_CATEGORY_OPTIONS}
            value={draft.category}
            onChange={(category) => setDraft((current) => ({ ...current, category }))}
          />
        ) : null}
        <label><span>카테고리</span><input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} /></label>
        <label><span>메모</span><input value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} placeholder="간단한 메모" /></label>
        <LifeHubButton type="submit" className="primary" icon="plus">거래 저장</LifeHubButton>
      </form>
      <Section title="최근 거래" eyebrow={`${model.budgetEntries.length}개`}>
        <div className="lifeHubTransactionList">
          {model.budgetEntries.slice(0, 8).map((entry) => (
            <article key={entry.id}>
              <span className={entry.type}>{entry.type === 'deposit' ? '수입' : '지출'}</span>
              <div><strong>{entry.category}</strong><small>{entry.date} · {entry.memo || '메모 미입력'}</small></div>
              <em>{entry.type === 'deposit' ? '+' : '-'}{money(entry.amount)}</em>
              <button type="button" className="lifeHubInlineDelete" onClick={() => deleteEntry(entry)} aria-label={`${entry.category} 거래 삭제`}>
                삭제
              </button>
            </article>
          ))}
          {model.budgetEntries.length ? null : <EmptyState title="아직 기록한 거래가 없어요" text="금액만 입력해도 이번 달 흐름에 바로 반영돼요." actionLabel="지출 기록하기" icon="chart" onAction={() => setDraft((current) => ({ ...current, type: 'withdraw' }))} />}
        </div>
      </Section>
    </div>
  );
}

function TravelPage({ model, session, refresh }) {
  const [draft, setDraft] = useState({ title: '', startDate: '', endDate: '', memo: '' });
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();
  const nextTrip = model.trips.find((trip) => !trip.startDate || trip.startDate >= model.today) || model.trips[0] || null;

  const submitTrip = (event) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      notify('여행 이름을 입력해주세요.', 'error');
      return;
    }
    const trip = normalizeTrip({
      id: `trip-${Date.now()}`,
      ...draft,
      checklist: [
        { text: '예약 확인', done: false },
        { text: '교통 확인', done: false },
        { text: '숙소 확인', done: false },
        { text: '일정 메모', done: false }
      ],
      createdAt: new Date().toISOString()
    });
    if (!trip) return;
    const result = saveTrips(session, [trip, ...readTrips(session)]);
    setDraft({ title: '', startDate: '', endDate: '', memo: '' });
    notify(result.saved ? '여행 계획을 추가했어요.' : '여행 저장에 실패했어요.', result.saved ? 'success' : 'error');
    refresh();
  };

  const toggleChecklist = (trip, checkId) => {
    const result = saveTrips(session, readTrips(session).map((item) => (
      item.id === trip.id
        ? { ...item, checklist: item.checklist.map((check) => check.id === checkId ? { ...check, done: !check.done } : check) }
        : item
    )));
    notify(result.saved ? '준비 상태를 업데이트했어요.' : '준비 상태 저장에 실패했어요.', result.saved ? 'success' : 'error');
    refresh();
  };

  const deleteTrip = (trip) => {
    if (!window.confirm('이 여행 계획을 삭제할까요?')) return;
    const result = saveTrips(session, readTrips(session).filter((item) => item.id !== trip.id));
    notify(result.saved ? '여행 계획을 삭제했어요.' : '여행 삭제를 저장하지 못했어요.', result.saved ? 'success' : 'error');
    refresh();
  };

  return (
    <div className="lifeHubPage lifeHubTravelPage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />
      <section className="lifeHubCompactHero">
        <span>개인비서 브리핑</span>
        <h2>{nextTrip ? '다가오는 여행을 챙길게요' : '아직 등록된 여행이 없어요'}</h2>
        <p>예약, 교통, 숙소, 일정 메모만 빠르게 확인하세요.</p>
      </section>

      {nextTrip ? (
        <article className="lifeHubTripFocus">
          <div>
            <span>{nextTrip.startDate ? dDayLabel(nextTrip.startDate) : '날짜 미정'}</span>
            <strong>{nextTrip.title}</strong>
            <p>{nextTrip.checklist.filter((item) => !item.done).length}개 준비 항목이 남았어요.</p>
          </div>
          <div className="lifeHubProgress"><span style={{ width: `${Math.round((nextTrip.checklist.filter((item) => item.done).length / Math.max(1, nextTrip.checklist.length)) * 100)}%` }} /></div>
        </article>
      ) : null}

      <div className="lifeHubTripList">
        {model.trips.map((trip) => (
          <article key={trip.id}>
            <header>
              <div>
                <span>{trip.startDate ? dDayLabel(trip.startDate) : '날짜 미정'}</span>
                <strong>{trip.title}</strong>
                <small>{[trip.startDate, trip.endDate].filter(Boolean).join(' - ') || '일정을 정해보세요.'}</small>
              </div>
              <button type="button" className="lifeHubInlineDelete" onClick={() => deleteTrip(trip)} aria-label={`${trip.title} 삭제`}>
                삭제
              </button>
            </header>
            <p>{trip.memo || '예약/교통/숙소 상태를 확인하세요.'}</p>
            <div className="lifeHubTripChecks">
              {trip.checklist.map((check) => (
                <button type="button" key={check.id} className={check.done ? 'done' : ''} onClick={() => toggleChecklist(trip, check.id)}>
                  {check.done ? '완료' : '대기'} · {check.text}
                </button>
              ))}
            </div>
          </article>
        ))}
        {model.trips.length ? null : <EmptyState title="예정된 여행이 아직 없어요" text="여행을 추가하면 예약, 교통, 숙소 체크리스트가 함께 만들어져요." actionLabel="여행 계획 추가" icon="trip" onAction={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })} />}
      </div>

      <form className="lifeHubFormCard lifeHubFastForm" onSubmit={submitTrip}>
        <header><strong>여행 추가</strong><small>이름만 먼저 저장하고 날짜는 나중에 정해도 됩니다.</small></header>
        <label><span>여행 이름</span><input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="예: 제주 주말 여행" /></label>
        <div className="lifeHubTwoCol">
          <label><span>출발</span><input type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label><span>도착</span><input type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} /></label>
        </div>
        <details className="lifeHubInlineDetails">
          <summary>예약/교통/숙소 메모 더하기</summary>
          <label><span>메모</span><input value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} placeholder="예약 번호, 교통편, 일정 메모" /></label>
        </details>
        <LifeHubButton type="submit" className="primary" icon="plus">여행 저장</LifeHubButton>
      </form>
    </div>
  );
}

function MorePage({ model, session, navigate }) {
  const isGuest = !session || session.isGuest || session.username === 'guestuser';
  const modules = [
    { title: '독서', icon: 'book', path: '/reading', status: `${model.books.length}권`, text: '읽는 중과 다음 후보 관리' },
    { title: '운동', icon: 'trophy', path: '/workout', status: model.todayWorkout ? '오늘 완료' : '기록 대기', text: 'BMR과 운동 기록' },
    { title: '가계부', icon: 'chart', path: '/finance', status: `${model.budget.usage}%`, text: '이번 달 지출 흐름' },
    { title: '여행', icon: 'trip', path: '/travel', status: model.nextTrip?.startDate ? dDayLabel(model.nextTrip.startDate) : '준비', text: '준비물과 예약 체크' },
    { title: '기존 여행 찾기', icon: 'search', path: '/destinations', status: 'AI', text: '장소 추천과 여행 코스' },
    { title: '계정', icon: 'user', path: isGuest ? '/login' : '/mypage', status: isGuest ? 'Guest' : 'Member', text: '로그인과 설정' }
  ];

  return (
    <div className="lifeHubPage lifeHubMorePage">
      <section className="lifeHubCompactHero">
        <span>개인비서 브리핑</span>
        <h2>생활관리 센터</h2>
        <p>자주 쓰는 도구와 계정, 연결, 루틴을 한 곳에서 관리하세요.</p>
      </section>

      <Section title="생활 모듈" eyebrow="현재 상태">
        <div className="lifeHubModuleGrid wide">
          {modules.map((module) => (
            <button type="button" key={module.title} onClick={() => navigate(module.path)}>
              <span><MemoNavIcon type={module.icon} /></span>
              <strong>{module.title}</strong>
              <em>{module.status}</em>
              <small>{module.text}</small>
            </button>
          ))}
        </div>
      </Section>

      <Section title="개인비서 루틴" eyebrow="추천">
        <div className="lifeHubRoutineList">
          <article><strong>아침 루틴</strong><p>오늘 일정, 날씨 대신 준비물, 빠른 메모를 먼저 확인하세요.</p></article>
          <article><strong>저녁 루틴</strong><p>운동 기록, 지출 입력, 읽던 책 10페이지를 마무리하세요.</p></article>
          <article><strong>주간 리뷰</strong><p>완료 일정과 지출 카테고리를 보며 다음 주 우선순위를 정하세요.</p></article>
        </div>
      </Section>
      <section className="lifeHubSettingsCard">
        <strong>계정과 설정</strong>
        <p>{isGuest ? '게스트 모드로 사용 중입니다. 로그인하면 기기 간 동기화를 준비할 수 있어요.' : `${session.username} 계정으로 사용 중입니다.`}</p>
        <button type="button" onClick={() => navigate(isGuest ? '/login' : '/mypage')}>{isGuest ? '로그인' : '계정 보기'}</button>
        <button type="button" onClick={() => navigate('/connect')}>연결 관리</button>
        <button type="button" onClick={() => navigate('/portfolio')}>포트폴리오 보기</button>
      </section>
    </div>
  );
}

export default function LifeHubApp({ path, navigate }) {
  const [session, setSession] = useState(() => readStoredAuth());
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [dismissed, setDismissed] = useState(() => readDismissedActions(readStoredAuth()));
  const route = routeForPath(path);
  const model = useMemo(() => readLifeHubData(session), [session?.username, session?.isGuest, refreshSeed]);
  const actions = useMemo(() => buildAssistantActions(model, dismissed), [model, dismissed]);

  const refresh = () => setRefreshSeed((current) => current + 1);
  const go = (nextPath) => {
    if (navigate) navigate(nextPath);
    else {
      window.history.pushState({}, '', nextPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  useEffect(() => {
    document.title = `LifeHub · ${routeTitle(route)}`;
  }, [route]);

  useEffect(() => {
    const sync = () => {
      const nextSession = readStoredAuth();
      setSession(nextSession);
      setDismissed(readDismissedActions(nextSession));
      refresh();
    };
    window.addEventListener('storage', sync);
    window.addEventListener(LIFEHUB_EVENT, sync);
    window.addEventListener('codex:scheduler-items-updated', sync);
    window.addEventListener('codex:notes-updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(LIFEHUB_EVENT, sync);
      window.removeEventListener('codex:scheduler-items-updated', sync);
      window.removeEventListener('codex:notes-updated', sync);
    };
  }, []);

  let content = null;
  if (route === 'assistant') content = <AssistantPage model={model} actions={actions} session={session} navigate={go} refresh={refresh} dismissed={dismissed} setDismissed={setDismissed} />;
  else if (route === 'memo') content = <MemoPage model={model} session={session} refresh={refresh} />;
  else if (route === 'schedule') content = <SchedulePage model={model} session={session} refresh={refresh} />;
  else if (route === 'reading') content = <ReadingPage model={model} session={session} refresh={refresh} />;
  else if (route === 'workout') content = <WorkoutPage model={model} session={session} refresh={refresh} />;
  else if (route === 'finance') content = <FinancePage model={model} session={session} refresh={refresh} />;
  else if (route === 'travel') content = <TravelPage model={model} session={session} refresh={refresh} />;
  else if (route === 'more') content = <MorePage model={model} session={session} navigate={go} />;
  else content = <HomePage model={model} actions={actions} session={session} navigate={go} refresh={refresh} dismissed={dismissed} setDismissed={setDismissed} />;

  return (
    <LifeHubShell
      route={route}
      path={path}
      session={session}
      model={model}
      actions={actions}
      dismissed={dismissed}
      setDismissed={setDismissed}
      navigate={go}
      refresh={refresh}
    >
      {content}
    </LifeHubShell>
  );
}
