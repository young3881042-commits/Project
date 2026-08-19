import { lazy, useEffect, useMemo, useRef, useState } from 'react';
import MemoNavIcon from './components/MemoNavIcon.jsx';
import BodyProfileCard from './components/body/BodyProfileCard.jsx';
import {
  BODY_PROFILE_EVENT,
  LEGACY_WORKOUT_PROFILE_KEY,
  bodyProfileStorageKey,
  bodyProfilesEqual,
  cacheBodyProfileSession,
  legacyBodyProfileStorageKey,
  readBodyProfile,
  saveBodyProfile,
  validateBodyProfile
} from './components/body/bodyProfileModel.js';
import {
  normalizeDietEntry,
  readDietEntries,
  saveDietEntries
} from './components/diet/dietModel.js';
import HomePage from './features/home/HomePage.jsx';
import DailyBriefingSettings from './features/automation/DailyBriefingSettings.jsx';
import LifeHubBackupPanel from './features/backup/LifeHubBackupPanel.jsx';
import { applyLifeHubBackupPlan } from './features/backup/lifeHubBackupRestore.js';
import {
  dailyBriefingNotifications,
  normalizeDailyBriefingSettings,
  readDailyBriefingSettings,
  saveDailyBriefingSettings
} from './features/automation/dailyBriefing.js';
import CardTransactionImportPanel from './features/finance/CardTransactionImportPanel.jsx';
import { useCardTransactionImport } from './features/finance/useCardTransactionImport.js';
import { LIFEHUB_APP_ICON } from './components/lifehub/LifeHubPackIcon.jsx';
import LifeHubShell, { routeTitle } from './components/lifehub/LifeHubShell.jsx';
import {
  ensureDailyMemoBoards,
  normalizeDailyMemo,
  readDailyMemos,
  saveDailyMemos
} from './components/notes/daily/dailyMemoModel.js';
import {
  EmptyState,
  FinanceWalletCard,
  FeedbackToast,
  LifeHubButton,
  MoreSettingsRow,
  QuickChoiceGroup,
  Section,
  ScheduleTimelineItem,
  TravelBoardingPass,
  WorkoutSessionPanel,
  useLifeHubFeedback
} from './components/lifehub/LifeHubUi.jsx';
import {
  WORKOUT_CARDIO_ACTIVITIES,
  WORKOUT_DURATION_OPTIONS,
  WORKOUT_TEMPLATES,
  cardioActivityForId,
  createCardioExercise,
  estimateWorkoutCalories,
  workoutDurationMinutes,
  workoutKindForTemplate
} from './components/workout/workoutMetrics.js';
import {
  addDays,
  compareDateTime,
  compactDateLabel,
  dDayLabel,
  formatNumber,
  fullDateLabel,
  isDateKey,
  isTimeKey,
  money,
  monthKey,
  progressPercent,
  todayKey
} from './utils/lifeHubFormatters.js';
import { safeParse, safeRemoveItem, safeSetItem } from './utils/lifeHubStorage.js';
import {
  nativeRoutineNotifications,
  routineReminderSaveStatus
} from './components/schedule/routineNotificationModel.js';
import {
  CUSTOM_REPEAT_WEEKDAYS,
  normalizeRepeatDays,
  normalizeScheduleRepeat,
  recurrenceForRepeat,
  repeatDaysForSchedule,
  scheduleRecurrenceMatches,
  scheduleRepeatFor,
  toggleRepeatDay
} from './components/schedule/scheduleRecurrenceModel.js';
import {
  hasNativeNotificationApi,
  nativeExactAlarmPermissionState,
  nativeNotificationPermissionState,
  replaceNativeScheduledNotifications,
  requestNativeExactAlarmPermission,
  requestNativeNotificationPermission
} from './features/lifehub-ai/nativeNotifications.js';

const DailyMemoPage = lazy(() => import('./components/notes/daily/DailyMemoPage.jsx'));
const DietPage = lazy(() => import('./components/diet/DietPage.jsx'));

const AUTH_KEY = 'codex-workspace-auth';
const LIFEHUB_OWNER_KEY = 'ai-assistant-lifehub-local-owner';
const SCHEDULER_KEY = 'codex-personal-scheduler-items';
const SCHEDULE_DRAFT_KEY = 'lifehub-schedule-draft:v1';
const BUDGET_KEY = 'ai-assistant-budget-entries';
const WORKOUT_LOGS_KEY = 'ai-assistant-workout-logs';
const TRIPS_KEY = 'ai-assistant-lifehub-trips';
const LIFEHUB_EVENT = 'lifehub:data-updated';

const ROUTE_ALIASES = {
  '/': 'home',
  '/app': 'home',
  '/home': 'home',
  '/memo': 'memo',
  '/schedule': 'schedule',
  '/workout': 'workout',
  '/diet': 'diet',
  '/finance': 'finance',
  '/more': 'more'
};

const SCHEDULE_FILTERS = [
  { value: 'date', label: '오늘' },
  { value: 'upcoming', label: '예정' },
  { value: 'missed', label: '놓친 일정' },
  { value: 'done', label: '완료' }
];
const ROUTINE_CATEGORY_OPTIONS = [
  { value: 'exercise', label: '운동', icon: 'trophy', type: '운동' },
  { value: 'budget', label: '가계부', icon: 'chart', type: '가계부' },
  { value: 'memo', label: '메모', icon: 'edit', type: '메모' },
  { value: 'work', label: '업무', icon: 'briefcase', type: '업무' },
  { value: 'travel', label: '여행', icon: 'trip', type: '여행' },
  { value: 'etc', label: '기타', icon: 'calendar', type: '개인' }
];
const ROUTINE_REPEAT_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'daily', label: '매일' },
  { value: 'weekdays', label: '주중' },
  { value: 'weekends', label: '주말' },
  { value: 'weekly', label: '매주' },
  { value: 'custom', label: '커스텀' },
  { value: 'monthly', label: '매월' }
];
const ROUTINE_REMINDER_OPTIONS = [
  { value: 'none', label: '없음' },
  { value: 'at_time', label: '정시' },
  { value: '5m', label: '5분 전' },
  { value: '10m', label: '10분 전' },
  { value: '30m', label: '30분 전' }
];
const SCHEDULE_PRIORITY_OPTIONS = [
  { value: '보통', label: '보통' },
  { value: '높음', label: '급함' },
  { value: '낮음', label: '가벼움' }
];
const BUDGET_CATEGORY_OPTIONS = ['식비', '교통', '카페', '쇼핑', '기타'];
function readStoredAuth() {
  const session = safeParse(localStorage.getItem(AUTH_KEY), null);
  if (!session) return null;
  return session.username === 'guestuser' && !session.isGuest ? { ...session, isGuest: true } : session;
}

function storageUsername(session = readStoredAuth()) {
  const username = typeof session === 'string' ? session : session?.username;
  return String(username || 'guestuser').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'guestuser';
}

function readLifeHubOwner() {
  const storedOwner = localStorage.getItem(LIFEHUB_OWNER_KEY);
  const username = storageUsername(storedOwner || readStoredAuth());
  if (storedOwner !== username) safeSetItem(LIFEHUB_OWNER_KEY, username);
  return {
    username,
    isGuest: username === 'guestuser',
    localOnly: true
  };
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

function normalizeScheduleType(value) {
  const raw = String(value || '').trim();
  if (['업무', 'work', 'WORK', '회의', '작업'].includes(raw)) return '업무';
  if (['독서', 'reading', 'book'].includes(raw)) return '개인';
  if (['메모', 'AI Note', 'note'].includes(raw)) return '메모';
  if (['운동', 'fitness', 'workout'].includes(raw)) return '운동';
  if (['가계부', 'budget', 'finance', 'money'].includes(raw)) return '가계부';
  if (['여행', 'travel', 'trip'].includes(raw)) return '여행';
  return raw || '개인';
}

function routineCategoryFor(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['reading', '독서', 'book'].includes(raw)) return 'etc';
  if (['exercise', '운동', 'fitness', 'workout'].includes(raw)) return 'exercise';
  if (['budget', '가계부', 'finance', 'money'].includes(raw)) return 'budget';
  if (['memo', '메모', 'note', 'ai note'].includes(raw)) return 'memo';
  if (['work', '업무', '회의', '작업', 'briefcase'].includes(raw)) return 'work';
  if (['travel', '여행', 'trip'].includes(raw)) return 'travel';
  return 'etc';
}

function routineCategoryMeta(category) {
  return ROUTINE_CATEGORY_OPTIONS.find((item) => item.value === category) || ROUTINE_CATEGORY_OPTIONS[ROUTINE_CATEGORY_OPTIONS.length - 1];
}

function routineCategoryLabel(category, fallbackType = '') {
  const fallback = normalizeScheduleType(fallbackType);
  if (fallback && fallback !== '개인') return fallback;
  return routineCategoryMeta(category).label;
}

function normalizeReminder(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['at_time', '정시', 'now'].includes(raw)) return 'at_time';
  if (['5m', '5', '5분 전'].includes(raw)) return '5m';
  if (['10m', '10', '10분 전'].includes(raw)) return '10m';
  if (['30m', '30', '30분 전'].includes(raw)) return '30m';
  return 'none';
}

function routineStatusFor(item) {
  return item?.status === 'done' || item?.done ? 'done' : 'scheduled';
}

function normalizeSchedule(item, index = 0) {
  const title = String(item?.title || item?.name || '').trim();
  if (!title) return null;
  const date = isDateKey(item?.date) ? item.date : todayKey();
  const explicitCategory = routineCategoryFor(item?.category);
  const typeCategory = routineCategoryFor(item?.type);
  const category = explicitCategory === 'etc' && typeCategory !== 'etc' ? typeCategory : explicitCategory;
  const repeat = scheduleRepeatFor(item);
  const recurrence = recurrenceForRepeat(repeat);
  const repeatDays = repeat === 'custom' ? repeatDaysForSchedule({ ...item, date, repeat }) : [];
  const status = routineStatusFor(item);
  const type = normalizeScheduleType(item?.type || routineCategoryMeta(category).type);
  const note = String(item?.note || item?.memo || '').trim();
  return {
    ...item,
    id: String(item?.id || `schedule-${Date.now()}-${index}`),
    title,
    category,
    date,
    time: isTimeKey(item?.time) ? item.time : '',
    type,
    priority: ['높음', '보통', '낮음'].includes(item?.priority) ? item.priority : '보통',
    memo: note,
    note,
    repeat,
    repeatDays,
    reminder: normalizeReminder(item?.reminder),
    recurrence,
    recurrenceEnd: isDateKey(item?.recurrenceEnd) ? item.recurrenceEnd : '',
    status,
    done: status === 'done',
    doneOverrides: item?.doneOverrides && typeof item.doneOverrides === 'object' ? item.doneOverrides : {},
    source: item?.source || ''
  };
}

function readSchedules(session) {
  return readScopedArray(SCHEDULER_KEY, session, normalizeSchedule).sort(compareDateTime);
}

function saveSchedules(session, items) {
  const key = scopedKey(SCHEDULER_KEY, session);
  const normalized = items.map(normalizeSchedule).filter(Boolean).sort(compareDateTime);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  if (saved) {
    safeRemoveItem(SCHEDULER_KEY);
    window.dispatchEvent(new CustomEvent('codex:scheduler-items-updated', { detail: { items: normalized, storageKey: key } }));
    emitDataChanged({ key });
  }
  return { items: normalized, saved };
}

function recurrenceMatches(item, targetDate) {
  return scheduleRecurrenceMatches(item, targetDate);
}

function buildScheduleWindow() {
  const today = todayKey();
  return Array.from({ length: 75 }, (_, index) => addDays(today, index - 14));
}

function expandSchedules(items) {
  const dates = buildScheduleWindow();
  return items.flatMap((item) => {
    const repeat = normalizeScheduleRepeat(item.repeat || item.recurrence);
    if (repeat === 'none' && item.recurrence === 'none') return [{ ...item, scheduleId: item.id, recurring: false, status: item.done ? 'done' : 'scheduled' }];
    return dates.filter((date) => recurrenceMatches(item, date)).map((date) => ({
      ...item,
      id: `${item.id}:${date}`,
      scheduleId: item.id,
      sourceId: item.id,
      date,
      recurring: true,
      done: Boolean(item.doneOverrides?.[date]),
      status: item.doneOverrides?.[date] ? 'done' : 'scheduled'
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
    return { ...item, done: Boolean(done), status: done ? 'done' : 'scheduled' };
  });
  return saveSchedules(session, next);
}

const routineReminderTimers = new Map();

function notificationPermissionState() {
  const nativePermission = nativeNotificationPermissionState();
  if (nativePermission) return nativePermission;
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission || 'default';
}

function clearRoutineNotificationTimers() {
  routineReminderTimers.forEach((timer) => window.clearTimeout(timer));
  routineReminderTimers.clear();
}

async function showPlannedNotification(notification) {
  const options = {
    body: notification.body,
    tag: notification.id,
    data: { path: notification.path },
    icon: LIFEHUB_APP_ICON,
    badge: LIFEHUB_APP_ICON
  };
  try {
    if (navigator.serviceWorker?.ready) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(notification.title, options);
      return;
    }
  } catch (error) {
    // Fall through to the window notification path.
  }
  if ('Notification' in window && window.Notification.permission === 'granted') {
    const browserNotification = new window.Notification(notification.title, options);
    browserNotification.onclick = () => {
      window.focus();
      window.history.pushState({}, '', options.data.path);
      window.dispatchEvent(new PopStateEvent('popstate'));
      browserNotification.close();
    };
  }
}

function scheduleRoutineNotifications(items, now = Date.now(), additionalNotifications = []) {
  clearRoutineNotificationTimers();
  const routineNotifications = nativeRoutineNotifications(items, now);
  const extras = (Array.isArray(additionalNotifications) ? additionalNotifications : [])
    .filter((item) => item?.id && item?.title && item?.path && Number(item?.triggerAt) > now);
  const planned = [...routineNotifications, ...extras]
    .sort((left, right) => left.triggerAt - right.triggerAt)
    .slice(0, 128);
  if (hasNativeNotificationApi()) {
    const accepted = replaceNativeScheduledNotifications(planned);
    return {
      accepted,
      eligible: planned.length,
      mode: 'native',
      scheduled: accepted ? planned.length : 0
    };
  }
  if (notificationPermissionState() !== 'granted') {
    return { accepted: false, eligible: planned.length, mode: 'browser', scheduled: 0 };
  }
  let scheduled = 0;
  planned.forEach((notification) => {
    const key = notification.id;
    if (routineReminderTimers.has(key)) return;
    const timer = window.setTimeout(() => {
      routineReminderTimers.delete(key);
      showPlannedNotification(notification);
    }, notification.triggerAt - now);
    routineReminderTimers.set(key, timer);
    scheduled += 1;
  });
  return { accepted: true, eligible: planned.length, mode: 'browser', scheduled };
}

async function requestRoutineNotificationPermission() {
  if (hasNativeNotificationApi()) {
    return await requestNativeNotificationPermission();
  }
  if (notificationPermissionState() === 'unsupported') return 'unsupported';
  if (window.Notification.permission === 'granted') return 'granted';
  if (window.Notification.permission === 'denied') return 'denied';
  try {
    return await window.Notification.requestPermission();
  } catch (error) {
    return notificationPermissionState() === 'granted' ? 'granted' : 'unsupported';
  }
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
    .sort((left, right) => `${right.date || ''}${right.createdAt || ''}`.localeCompare(`${left.date || ''}${left.createdAt || ''}`));
}

function saveBudget(session, entries) {
  const key = scopedKey(BUDGET_KEY, session);
  const normalized = entries.map(normalizeBudget).filter(Boolean);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  if (saved) {
    safeRemoveItem(BUDGET_KEY);
    emitDataChanged({ key });
  }
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
    .sort((left, right) => `${right.date || ''}${right.createdAt || ''}`.localeCompare(`${left.date || ''}${left.createdAt || ''}`));
}

function saveWorkouts(session, logs) {
  const key = scopedKey(WORKOUT_LOGS_KEY, session);
  const normalized = logs.map(normalizeWorkout).filter(Boolean);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  if (saved) {
    safeRemoveItem(WORKOUT_LOGS_KEY);
    emitDataChanged({ key });
  }
  return { items: normalized, saved };
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
    .sort((left, right) => (left.startDate || '9999-99-99').localeCompare(right.startDate || '9999-99-99'));
}

function saveTrips(session, trips) {
  const key = scopedKey(TRIPS_KEY, session);
  const normalized = trips.map(normalizeTrip).filter(Boolean);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  if (saved) emitDataChanged({ key });
  return { items: normalized, saved };
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
  ensureDailyMemoBoards(session);
  const today = todayKey();
  const schedules = readSchedules(session);
  const expandedSchedules = expandSchedules(schedules);
  const todaySchedules = expandedSchedules.filter((item) => item.date === today).sort(compareDateTime);
  const missedSchedules = expandedSchedules.filter((item) => item.date < today && !item.done).sort(compareDateTime).slice(0, 8);
  const upcomingSchedules = expandedSchedules.filter((item) => item.date > today && !item.done).sort(compareDateTime).slice(0, 8);
  const notes = readDailyMemos(session);
  const workouts = readWorkouts(session);
  const dietEntries = readDietEntries(session);
  const budgetEntries = readBudget(session);
  const trips = readTrips(session);
  const budget = monthlyBudgetSummary(budgetEntries);
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
    workouts,
    dietEntries,
    budgetEntries,
    budget,
    trips,
    todayWorkout,
    nextTrip
  };
}

function routeForPath(path) {
  const routePath = (path || window.location.pathname || '/home').split('?')[0].replace(/\/$/, '') || '/';
  return ROUTE_ALIASES[routePath] || 'home';
}

const SCHEDULE_EDITOR_HISTORY_KEY = 'lifehubScheduleEditor';

function currentHistoryState() {
  return window.history.state && typeof window.history.state === 'object'
    ? window.history.state
    : {};
}

function replaceLifeHubPath(nextPath) {
  const current = window.location.pathname + window.location.search;
  if (current === nextPath) return;
  window.history.replaceState({}, '', nextPath);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function ensureLifeHubEditorHistory() {
  const current = window.location.pathname + window.location.search;
  const state = currentHistoryState();
  if (window.location.pathname !== '/schedule' || state[SCHEDULE_EDITOR_HISTORY_KEY] === true) return;
  const baseState = { ...state };
  delete baseState[SCHEDULE_EDITOR_HISTORY_KEY];
  window.history.replaceState(baseState, '', '/schedule');
  window.history.pushState({ ...baseState, [SCHEDULE_EDITOR_HISTORY_KEY]: true }, '', current);
}

function pushLifeHubEditorPath(nextPath) {
  const current = window.location.pathname + window.location.search;
  const state = currentHistoryState();
  if (current === nextPath) {
    ensureLifeHubEditorHistory();
    return;
  }
  if (state[SCHEDULE_EDITOR_HISTORY_KEY] === true && window.location.pathname === '/schedule') {
    window.history.replaceState(state, '', nextPath);
  } else {
    window.history.pushState({ ...state, [SCHEDULE_EDITOR_HISTORY_KEY]: true }, '', nextPath);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function closeLifeHubEditorPath() {
  if (currentHistoryState()[SCHEDULE_EDITOR_HISTORY_KEY] === true) {
    window.history.back();
    return;
  }
  replaceLifeHubPath('/schedule');
}

function ScheduleTimeline({ items, empty, emptyText, emptyActionLabel, onEmptyAction, onToggle, onDelete, onOpen }) {
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
    <div className="lifeHubScheduleTimeline schedule-timeline">
      {items.map((item) => (
        <ScheduleTimelineItem
          key={item.id}
          item={item}
          timeLabel={item.time || '종일'}
          meta={`${compactDateLabel(item.date)} · ${routineCategoryLabel(item.category, item.type)}${item.note ? ` · ${item.note}` : ''}`}
          statusLabel={item.done ? '완료' : '예정'}
          onToggle={onToggle}
          onDelete={onDelete}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}

function scheduleParamsForPath(path) {
  const raw = String(path || window.location.search || '');
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : raw.replace(/^\?/, '');
  return new URLSearchParams(query);
}

function createScheduleDraft(today, item = null) {
  const normalized = item ? normalizeSchedule(item) : null;
  return {
    title: normalized?.title || '',
    date: normalized?.date || today,
    time: normalized?.time || '09:00',
    category: normalized?.category || 'etc',
    repeat: normalized?.repeat || 'none',
    repeatDays: normalized?.repeat === 'custom' ? normalized.repeatDays : [],
    reminder: normalized?.reminder || 'none',
    priority: normalized?.priority || '보통',
    note: normalized?.note || normalized?.memo || ''
  };
}

function scheduleDraftStorageKey(session, editingId = '') {
  const scope = editingId ? `edit:${editingId}` : 'new';
  return `${scopedKey(SCHEDULE_DRAFT_KEY, session)}:${scope}`;
}

function readScheduleDraft(session, editingId, fallback) {
  let stored = null;
  try {
    stored = safeParse(sessionStorage.getItem(scheduleDraftStorageKey(session, editingId)), null);
  } catch {
    return fallback;
  }
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return fallback;
  const restored = Object.fromEntries(Object.entries(fallback).map(([key, value]) => (
    [key, Array.isArray(value)
      ? (Array.isArray(stored[key]) ? stored[key] : value)
      : (typeof stored[key] === 'string' ? stored[key] : value)]
  )));
  restored.repeat = normalizeScheduleRepeat(restored.repeat);
  restored.repeatDays = restored.repeat === 'custom'
    ? normalizeRepeatDays(restored.repeatDays, restored.date)
    : normalizeRepeatDays(restored.repeatDays);
  return restored;
}

function saveScheduleDraft(session, editingId, draft) {
  try {
    sessionStorage.setItem(scheduleDraftStorageKey(session, editingId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function clearScheduleDraft(session, editingId) {
  try {
    sessionStorage.removeItem(scheduleDraftStorageKey(session, editingId));
  } catch {
    // A blocked session store must not prevent closing or saving a schedule.
  }
}

function notificationNoticeFor(status, nativeDelivery = false, exactAlarmStatus = null) {
  if (status === 'unsupported') return '이 환경에서는 알림 예약을 지원하지 않아요. 일정 목록에서 시간을 확인해주세요.';
  if (status === 'denied') return nativeDelivery
    ? '휴대폰 설정에서 Orbit 알림 권한을 허용해야 합니다.'
    : '브라우저 알림 권한이 차단되어 있어요. 브라우저 설정에서 LifeHub 알림을 허용해야 합니다.';
  if (status === 'granted' && nativeDelivery && exactAlarmStatus === 'granted') {
    return '정시 알림이 켜져 있어요. 앱을 닫아도 예약한 시각에 알려드릴게요.';
  }
  if (status === 'granted' && nativeDelivery && exactAlarmStatus === null) {
    return '휴대폰 알림이 켜져 있어요. 현재 앱 버전에서는 Android 절전 상태에 따라 조금 늦을 수 있어요.';
  }
  if (status === 'granted' && nativeDelivery) {
    return '알림은 예약되지만 Android 절전 상태에서는 늦을 수 있어요. 정시 알림 권한을 켜면 정확해집니다.';
  }
  if (status === 'granted') {
    return '알림 권한이 켜져 있어요. 앱이 열려 있는 동안 예정된 일정 시간에 알려드릴게요.';
  }
  return nativeDelivery
    ? '휴대폰 알림을 켜면 앱을 닫아도 설정한 일정 시간에 알려드려요.'
    : '알림 권한을 켜면 설정한 일정 시간에 브라우저 알림을 보낼게요.';
}

function SchedulePage({ model, session, refresh, path }) {
  const [filter, setFilter] = useState('date');
  const initialParams = scheduleParamsForPath(path);
  const initialEditId = initialParams.get('edit') || '';
  const initialEditItem = initialEditId ? readSchedules(session).find((item) => item.id === initialEditId) || null : null;
  const initialNewForm = ['routine', 'schedule'].includes(initialParams.get('new'));
  const initialRequestedDate = isDateKey(initialParams.get('date')) ? initialParams.get('date') : model.today;
  const [focusedDate, setFocusedDate] = useState(initialEditItem?.date || initialRequestedDate);
  const [showForm, setShowForm] = useState(() => Boolean(initialEditItem) || initialNewForm);
  const [editingId, setEditingId] = useState(() => initialEditItem?.id || '');
  const [titleError, setTitleError] = useState(false);
  const [repeatDaysError, setRepeatDaysError] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState(() => notificationPermissionState());
  const [exactAlarmStatus, setExactAlarmStatus] = useState(
    () => nativeExactAlarmPermissionState()
  );
  const nativeNotificationDelivery = hasNativeNotificationApi();
  const formRef = useRef(null);
  const titleInputRef = useRef(null);
  const historyClosePendingRef = useRef(false);
  const discardScheduleDraftRef = useRef(false);
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();
  const [draft, setDraft] = useState(() => {
    const fallback = createScheduleDraft(initialEditItem?.date || initialRequestedDate, initialEditItem);
    return initialEditItem || initialNewForm
      ? readScheduleDraft(session, initialEditItem?.id || '', fallback)
      : fallback;
  });
  const focusedDateSchedules = model.expandedSchedules.filter((item) => item.date === focusedDate).sort(compareDateTime);
  const source = filter === 'date'
    ? focusedDateSchedules
    : filter === 'upcoming'
      ? model.upcomingSchedules
      : filter === 'missed'
        ? model.missedSchedules
        : model.expandedSchedules.filter((item) => item.done).sort(compareDateTime).slice(0, 20);
  const filterOptions = SCHEDULE_FILTERS.map((item) => (
    item.value === 'date'
      ? { ...item, label: focusedDate === model.today ? '오늘' : compactDateLabel(focusedDate) }
      : item
  ));
  const focusedDateEmptyTitle = focusedDate === model.today ? '오늘 일정이 비어 있어요' : `${compactDateLabel(focusedDate)} 일정이 비어 있어요`;
  const focusedDateEmptyText = focusedDate === model.today ? '필요한 할 일을 등록하면 시간순으로 정리해둘게요.' : '선택한 요일에 일정이 생기면 여기에 보여드릴게요.';
  const completedCount = model.expandedSchedules.filter((item) => item.done).length;
  const activeReminderCount = nativeRoutineNotifications(model.expandedSchedules).length;
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(model.today, index - 2);
    const [year, month, day] = date.split('-').map(Number);
    return {
      date,
      day,
      weekday: ['일', '월', '화', '수', '목', '금', '토'][new Date(year, month - 1, day).getDay()]
    };
  });

  useEffect(() => {
    if (!showForm || discardScheduleDraftRef.current) return;
    saveScheduleDraft(session, editingId, draft);
  }, [draft, editingId, showForm, session?.username, session?.isGuest]);

  useEffect(() => {
    const params = scheduleParamsForPath(path);
    const target = params.get('edit');
    if (!target && !['routine', 'schedule'].includes(params.get('new'))) {
      if (showForm && !discardScheduleDraftRef.current) {
        saveScheduleDraft(session, editingId, draft);
      }
      historyClosePendingRef.current = false;
      discardScheduleDraftRef.current = false;
    }
    if (historyClosePendingRef.current) return;
    if (target) {
      const sourceItem = readSchedules(session).find((item) => item.id === target);
      if (!sourceItem) {
        setDraft(createScheduleDraft(model.today));
        setEditingId('');
        setTitleError(false);
        setRepeatDaysError(false);
        setShowForm(false);
        if (window.location.pathname === '/schedule') replaceLifeHubPath('/schedule');
        return;
      }
      ensureLifeHubEditorHistory();
      const normalized = normalizeSchedule(sourceItem) || { date: model.today };
      setDraft(readScheduleDraft(session, target, createScheduleDraft(model.today, sourceItem)));
      setFocusedDate(normalized.date);
      setFilter('date');
      setEditingId(target);
      setTitleError(false);
      setRepeatDaysError(false);
      setShowForm(true);
      return;
    }
    if (['routine', 'schedule'].includes(params.get('new'))) {
      ensureLifeHubEditorHistory();
      const requestedDate = isDateKey(params.get('date')) ? params.get('date') : model.today;
      setDraft(readScheduleDraft(session, '', createScheduleDraft(requestedDate)));
      setFocusedDate(requestedDate);
      setFilter('date');
      setEditingId('');
      setTitleError(false);
      setRepeatDaysError(false);
      setShowForm(true);
      return;
    }
    setDraft(createScheduleDraft(model.today));
    setEditingId('');
    setTitleError(false);
    setRepeatDaysError(false);
    setShowForm(false);
    if ((params.has('edit') || params.has('new')) && window.location.pathname === '/schedule') replaceLifeHubPath('/schedule');
  }, [path, session?.username, session?.isGuest, model.today]);

  useEffect(() => {
    const refreshNotificationState = () => {
      if (document.visibilityState === 'hidden') return;
      setNotificationStatus(notificationPermissionState());
      setExactAlarmStatus(nativeExactAlarmPermissionState());
    };
    document.addEventListener('visibilitychange', refreshNotificationState);
    window.addEventListener('focus', refreshNotificationState);
    return () => {
      document.removeEventListener('visibilitychange', refreshNotificationState);
      window.removeEventListener('focus', refreshNotificationState);
    };
  }, [model.expandedSchedules]);

  const openScheduleEditor = (item) => {
    const sourceId = item.sourceId || item.scheduleId || item.id;
    const sourceItem = readSchedules(session).find((schedule) => schedule.id === sourceId) || item;
    setDraft(readScheduleDraft(session, sourceId, createScheduleDraft(model.today, sourceItem)));
    setFocusedDate(item.date || model.today);
    setFilter('date');
    setEditingId(sourceId);
    setTitleError(false);
    setRepeatDaysError(false);
    setShowForm(true);
    historyClosePendingRef.current = false;
    pushLifeHubEditorPath(`/schedule?edit=${encodeURIComponent(sourceId)}`);
  };

  const startAddSchedule = (date = focusedDate) => {
    const requestedDate = isDateKey(date) ? date : model.today;
    setDraft(readScheduleDraft(session, '', createScheduleDraft(requestedDate)));
    setEditingId('');
    setTitleError(false);
    setRepeatDaysError(false);
    setShowForm(true);
    setFocusedDate(requestedDate);
    setFilter('date');
    historyClosePendingRef.current = false;
    pushLifeHubEditorPath(`/schedule?new=schedule&date=${encodeURIComponent(requestedDate)}`);
  };

  const closeForm = ({ discardDraft = false } = {}) => {
    if (historyClosePendingRef.current) return;
    if (discardDraft) clearScheduleDraft(session, editingId);
    else saveScheduleDraft(session, editingId, draft);
    discardScheduleDraftRef.current = discardDraft;
    setShowForm(false);
    setEditingId('');
    setTitleError(false);
    setRepeatDaysError(false);
    historyClosePendingRef.current = true;
    closeLifeHubEditorPath();
  };

  useEffect(() => {
    if (!showForm) return undefined;
    const frame = window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      titleInputRef.current?.focus({ preventScroll: true });
    });
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeForm();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showForm, editingId]);

  const enableNotifications = async () => {
    const permission = await requestRoutineNotificationPermission();
    setNotificationStatus(permission);
    if (permission === 'granted') {
      let nextExactStatus = nativeExactAlarmPermissionState();
      if (nativeNotificationDelivery && nextExactStatus === 'default') {
        nextExactStatus = await requestNativeExactAlarmPermission();
        setExactAlarmStatus(nextExactStatus);
      }
      const scheduling = scheduleRoutineNotifications(model.expandedSchedules);
      if (scheduling.accepted === false) {
        notify('알림 권한은 켰지만 일정 예약을 휴대폰에 저장하지 못했어요.', 'error');
      } else {
        notify(nativeNotificationDelivery && nextExactStatus !== 'granted'
          ? '휴대폰 알림을 켰어요. 정시 권한이 없으면 조금 늦을 수 있어요.'
          : nativeNotificationDelivery
            ? '휴대폰 정시 알림을 켰어요.'
            : '일정 알림을 켰어요.');
      }
    } else if (permission === 'denied') {
      notify(nativeNotificationDelivery
        ? '휴대폰 설정에서 Orbit 알림을 허용해야 해요.'
        : '브라우저 설정에서 알림 권한을 허용해야 해요.', 'error');
    } else {
      notify('이 환경에서는 알림을 사용할 수 없어요.', 'error');
    }
  };

  const enableExactNotifications = async () => {
    const permission = await requestNativeExactAlarmPermission();
    setExactAlarmStatus(permission);
    const scheduling = scheduleRoutineNotifications(model.expandedSchedules);
    if (permission === 'granted' && scheduling.accepted !== false) {
      notify('휴대폰 정시 알림을 켰어요.');
    } else if (permission === 'denied') {
      notify('정시 알림 권한이 꺼져 있어요. Android 설정에서 허용해주세요.', 'error');
    } else {
      notify('정시 알림 설정을 열 수 없어요.', 'error');
    }
  };

  const submitSchedule = async (event) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      setTitleError(true);
      notify('일정 제목을 입력해주세요.', 'error');
      titleInputRef.current?.focus();
      return;
    }
    setTitleError(false);
    const repeatDays = draft.repeat === 'custom' ? normalizeRepeatDays(draft.repeatDays) : [];
    if (draft.repeat === 'custom' && repeatDays.length === 0) {
      setRepeatDaysError(true);
      notify('반복할 요일을 하나 이상 선택해주세요.', 'error');
      return;
    }
    setRepeatDaysError(false);
    const schedules = readSchedules(session);
    const existing = editingId ? schedules.find((item) => item.id === editingId) : null;
    if (editingId && !existing) {
      notify('수정할 일정을 찾을 수 없어 입력창을 닫았어요.', 'error');
      closeForm();
      refresh();
      return;
    }
    const categoryMeta = routineCategoryMeta(draft.category);
    const next = normalizeSchedule({
      ...existing,
      id: editingId || `schedule-${Date.now()}`,
      title: draft.title,
      category: draft.category,
      type: categoryMeta.type,
      date: draft.date,
      time: draft.time,
      repeat: draft.repeat,
      repeatDays,
      recurrence: recurrenceForRepeat(draft.repeat),
      recurrenceEnd: draft.repeat === 'none' ? '' : existing?.recurrenceEnd || '',
      reminder: draft.reminder,
      priority: draft.priority,
      note: draft.note,
      memo: draft.note,
      status: existing?.status || 'scheduled',
      done: existing?.done || false
    });
    let permission = notificationStatus;
    if (next.reminder !== 'none') {
      permission = await requestRoutineNotificationPermission();
      setNotificationStatus(permission);
    }
    const nextSchedules = editingId
      ? schedules.map((item) => (item.id === editingId ? next : item))
      : [...schedules, next];
    const result = saveSchedules(session, nextSchedules);
    if (!result.saved) {
      notify('일정 저장에 실패했어요. 입력 내용은 그대로 두었어요.', 'error');
      return;
    }
    const schedulingNow = Date.now();
    const expandedNextSchedules = expandSchedules(nextSchedules);
    const nextReminderEligibleCount = nativeRoutineNotifications(
      expandSchedules([next]),
      schedulingNow
    ).length;
    let scheduling = scheduleRoutineNotifications(expandedNextSchedules, schedulingNow);
    let nextExactStatus = nativeExactAlarmPermissionState();
    if (next.reminder !== 'none'
        && permission === 'granted'
        && nativeNotificationDelivery
        && nextExactStatus === 'default'
        && nextReminderEligibleCount > 0) {
      nextExactStatus = await requestNativeExactAlarmPermission();
      setExactAlarmStatus(nextExactStatus);
      if (nextExactStatus === 'granted') {
        scheduling = scheduleRoutineNotifications(expandedNextSchedules);
      }
    }
    const reminderSaveStatus = routineReminderSaveStatus(
      next,
      nextReminderEligibleCount,
      schedulingNow
    );
    clearScheduleDraft(session, editingId);
    setDraft(createScheduleDraft(model.today));
    setFocusedDate(next.date);
    setFilter('date');
    closeForm({ discardDraft: true });
    if (next.reminder !== 'none' && permission !== 'granted') {
      notify(nativeNotificationDelivery
        ? '일정과 예약 시각은 저장했지만 휴대폰 알림 표시 권한이 꺼져 있어요.'
        : '일정은 저장했지만 알림은 권한 문제로 예약하지 못했어요.', 'error');
    } else if (reminderSaveStatus === 'past') {
      notify('일정은 저장했지만 선택한 알림 시각이 이미 지나 예약하지 않았어요.', 'error');
    } else if (reminderSaveStatus === 'invalid') {
      notify('일정은 저장했지만 날짜나 시간이 올바르지 않아 알림을 예약하지 못했어요.', 'error');
    } else if (reminderSaveStatus === 'beyond_horizon') {
      notify('일정은 저장했어요. 알림은 예정일 14일 안에 앱을 열면 자동 예약됩니다.', 'success');
    } else if (reminderSaveStatus === 'no_upcoming') {
      notify('일정은 저장했어요. 앞으로 14일 안에 발생할 반복 알림이 없어 아직 예약하지 않았어요.', 'success');
    } else if (next.reminder !== 'none' && scheduling?.accepted === false) {
      notify('일정은 저장했지만 알림 예약을 휴대폰에 반영하지 못했어요.', 'error');
    } else if (next.reminder !== 'none'
        && nativeNotificationDelivery
        && nextExactStatus
        && nextExactStatus !== 'granted') {
      notify('일정 알림을 예약했어요. 정시 권한이 없으면 Android에서 조금 늦을 수 있어요.', 'success');
    } else {
      notify(editingId ? '일정을 수정했어요.' : '일정을 저장했어요.', 'success');
    }
    refresh();
  };

  const deleteSchedule = (item) => {
    if (!window.confirm('이 일정을 삭제할까요?')) return;
    const sourceId = item.sourceId || item.scheduleId || item.id;
    const result = saveSchedules(session, readSchedules(session).filter((schedule) => schedule.id !== sourceId));
    notify(result.saved ? '일정을 삭제했어요.' : '일정 삭제를 저장하지 못했어요.', result.saved ? 'success' : 'error');
    if (result.saved) {
      if (editingId === sourceId) closeForm({ discardDraft: true });
      refresh();
    }
  };

  return (
    <div className="lifeHubPage lifeHubSchedulePage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />
      <section className="lifeHubAgendaHero">
        <div>
          <span>{fullDateLabel(model.today)}</span>
          <h2>{focusedDate === model.today ? (model.todaySchedules.length ? '오늘 일정을 확인하세요' : '오늘 일정이 비어 있어요') : `${compactDateLabel(focusedDate)} 일정을 확인하세요`}</h2>
          <p>요일을 누르면 해당 날짜 일정으로 바로 이동합니다.</p>
        </div>
        <div className="lifeHubAgendaCounts">
          <article><strong>{model.todaySchedules.length}</strong><span>오늘</span></article>
          <article><strong>{model.upcomingSchedules.length}</strong><span>예정</span></article>
          <article><strong>{completedCount}</strong><span>완료</span></article>
        </div>
      </section>

      <div className="lifeHubCalendarStrip" aria-label="이번 주">
        {weekDays.map((item) => (
          <button
            type="button"
            key={item.date}
            className={[item.date === focusedDate ? 'active' : '', item.date === model.today ? 'today' : ''].filter(Boolean).join(' ')}
            aria-pressed={item.date === focusedDate}
            onClick={() => {
              setFocusedDate(item.date);
              setDraft((current) => ({ ...current, date: item.date }));
              setFilter('date');
            }}
          >
            <span>{item.weekday}</span>
            <strong>{item.day}</strong>
          </button>
        ))}
      </div>

      <div className="lifeHubChipRow sticky" aria-label="일정 필터">
        {filterOptions.map((item) => (
          <button type="button" key={item.value} className={filter === item.value ? 'active' : ''} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>
            {item.label}
          </button>
        ))}
      </div>

      <section className={`lifeHubNotificationNotice ${notificationStatus}`}>
        <MemoNavIcon type="bell" />
        <div>
          <strong>{notificationStatus === 'granted' ? `알림 예약 ${activeReminderCount}개` : '일정 알림'}</strong>
          <span>{notificationNoticeFor(notificationStatus, nativeNotificationDelivery, exactAlarmStatus)}</span>
        </div>
        {notificationStatus === 'default' ? (
          <button type="button" onClick={enableNotifications}>알림 켜기</button>
        ) : notificationStatus === 'granted'
            && nativeNotificationDelivery
            && exactAlarmStatus
            && !['granted', 'unsupported'].includes(exactAlarmStatus) ? (
          <button type="button" onClick={enableExactNotifications}>정시 알림 켜기</button>
        ) : null}
      </section>

      <ScheduleTimeline
        items={source}
        empty={filter === 'date' ? focusedDateEmptyTitle : `${filterOptions.find((item) => item.value === filter)?.label || '일정'}이 비어 있어요`}
        emptyText={filter === 'date' ? focusedDateEmptyText : '조건에 맞는 일정이 생기면 여기에 보여드릴게요.'}
        emptyActionLabel="일정 추가"
        onEmptyAction={() => {
          setFilter('date');
          startAddSchedule(focusedDate);
        }}
        onToggle={(item) => {
          const result = updateScheduleDone(session, item, !item.done);
          notify(result.saved ? (item.done ? '일정을 다시 대기로 돌렸어요.' : '완료한 일정으로 정리했어요.') : '상태를 저장하지 못했어요.', result.saved ? 'success' : 'error');
          refresh();
        }}
        onDelete={deleteSchedule}
        onOpen={openScheduleEditor}
      />

      {showForm ? (
      <form
        ref={formRef}
        className="lifeHubFormCard lifeHubFastForm schedule-compact-panel"
        onSubmit={submitSchedule}
        role="dialog"
        aria-labelledby="lifehub-schedule-form-title"
        aria-describedby="lifehub-schedule-form-description"
      >
        <header>
          <div>
            <strong id="lifehub-schedule-form-title">{editingId ? '일정 수정' : '일정 추가'}</strong>
            <small id="lifehub-schedule-form-description">시간, 반복, 알림까지 일정에 함께 저장합니다. Esc 키로 닫을 수 있어요.</small>
          </div>
          <button type="button" className="lifeHubFormClose" onClick={closeForm} aria-label="일정 입력 닫기">닫기</button>
        </header>
        <label>
          <span>제목</span>
            <input
              ref={titleInputRef}
              value={draft.title}
              onChange={(event) => {
                setDraft((current) => ({ ...current, title: event.target.value }));
                if (event.target.value.trim()) setTitleError(false);
              }}
              placeholder="예: 아침 산책 30분"
              required
              aria-invalid={titleError}
              aria-describedby={titleError ? 'lifehub-schedule-title-error' : undefined}
            />
            {titleError ? <small id="lifehub-schedule-title-error" className="lifeHubFieldError" role="alert">일정 제목을 입력해주세요.</small> : null}
        </label>
        <label>
          <span>카테고리</span>
          <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>
            {ROUTINE_CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
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
        <div className="lifeHubTwoCol">
          <label>
            <span>반복</span>
            <select
              value={draft.repeat}
              onChange={(event) => {
                const repeat = event.target.value;
                setDraft((current) => ({
                  ...current,
                  repeat,
                  repeatDays: repeat === 'custom'
                    ? normalizeRepeatDays(current.repeatDays, current.date)
                    : current.repeatDays
                }));
                setRepeatDaysError(false);
              }}
            >
              {ROUTINE_REPEAT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span>알림</span>
            <select value={draft.reminder} onChange={(event) => setDraft((current) => ({ ...current, reminder: event.target.value }))}>
              {ROUTINE_REMINDER_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
        </div>
        {draft.repeat === 'custom' ? (
          <fieldset
            className={`schedule-custom-weekdays${repeatDaysError ? ' invalid' : ''}`}
            aria-describedby={repeatDaysError ? 'schedule-custom-weekdays-error' : 'schedule-custom-weekdays-help'}
          >
            <legend>반복 요일</legend>
            <div role="group" aria-label="반복할 요일 선택">
              {CUSTOM_REPEAT_WEEKDAYS.map((item) => {
                const selected = draft.repeatDays.includes(item.value);
                return (
                  <button
                    type="button"
                    key={item.value}
                    className={selected ? 'active' : ''}
                    aria-label={`${item.label}요일 반복`}
                    aria-pressed={selected}
                    onClick={() => {
                      setDraft((current) => ({
                        ...current,
                        repeatDays: toggleRepeatDay(current.repeatDays, item.value)
                      }));
                      setRepeatDaysError(selected && draft.repeatDays.length === 1);
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            {repeatDaysError ? (
              <small id="schedule-custom-weekdays-error" className="lifeHubFieldError" role="alert">요일을 하나 이상 선택해주세요.</small>
            ) : (
              <small id="schedule-custom-weekdays-help">선택한 요일마다 반복됩니다.</small>
            )}
          </fieldset>
        ) : null}
        <details className="lifeHubInlineDetails">
          <summary>메모/중요도 더하기</summary>
          <label>
            <span>메모</span>
            <textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="선택 입력" rows={2} />
          </label>
          <QuickChoiceGroup
            label="중요도"
            options={SCHEDULE_PRIORITY_OPTIONS}
            value={draft.priority}
            onChange={(priority) => setDraft((current) => ({ ...current, priority }))}
          />
        </details>
        <LifeHubButton type="submit" className="primary" icon="plus">{editingId ? '수정 저장' : '일정 저장'}</LifeHubButton>
      </form>
      ) : (
        <button type="button" className="lifeHubFloatingAdd" onClick={() => startAddSchedule(focusedDate)}>
          <MemoNavIcon type="plus" />
          <span>일정 추가</span>
        </button>
      )}
    </div>
  );
}

function WorkoutPage({ model, onBodyProfileChange, onSaveBodyProfile, path, session, refresh }) {
  const profile = model.bodyProfile;
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();
  const requestedWorkoutDate = scheduleParamsForPath(path).get('date');
  const focusedWorkoutDate = isDateKey(requestedWorkoutDate) ? requestedWorkoutDate : '';
  const focusedWorkoutLogs = focusedWorkoutDate ? model.workouts.filter((log) => log.date === focusedWorkoutDate) : [];
  const [draft, setDraft] = useState(() => ({
    templateId: 'cardio',
    date: focusedWorkoutDate || model.today,
    durationMinutes: '15',
    memo: '',
    addToSchedule: true,
    exercises: [createCardioExercise(cardioActivityForId('brisk-walk') || WORKOUT_CARDIO_ACTIVITIES[0])]
  }));
  const template = WORKOUT_TEMPLATES.find((item) => item.id === draft.templateId) || WORKOUT_TEMPLATES[0];
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
    if (templateId === 'cardio') {
      const activity = cardioActivityForId('brisk-walk') || WORKOUT_CARDIO_ACTIVITIES[0];
      setDraft((current) => ({
        ...current,
        templateId: 'cardio',
        exercises: [createCardioExercise(activity)]
      }));
      return;
    }
    setDraft((current) => ({ ...current, templateId, exercises: exercisesForTemplate(templateId) }));
  };
  const selectedWorkoutChoice = draft.templateId;
  const workoutChoiceLabel = template.title;

  const submitWorkout = (event) => {
    event.preventDefault();
    const duration = workoutDurationMinutes({ templateId: draft.templateId, durationMinutes: draft.durationMinutes, exercises: draft.exercises });
    if (!duration) {
      notify('운동 시간을 선택하거나 입력해주세요.', 'error');
      return;
    }
    const profileValidation = validateBodyProfile(profile);
    const profileResult = profileValidation.valid
      ? onSaveBodyProfile(profile)
      : { saved: true };
    const log = normalizeWorkout({
      id: `workout-${Date.now()}`,
      templateId: draft.templateId,
      title: workoutChoiceLabel,
      date: draft.date,
      durationMinutes: duration,
      caloriesBurned: estimatedCalories,
      memo: draft.memo,
      exercises: draft.exercises,
      createdAt: new Date().toISOString()
    });
    const workoutResult = saveWorkouts(session, [log, ...readWorkouts(session)]);
    if (!workoutResult.saved) {
      notify('운동 기록을 저장하지 못했어요. 입력 내용은 그대로 두었어요.', 'error');
      return;
    }
    let scheduleSaved = true;
    if (draft.addToSchedule) {
      const schedule = normalizeSchedule({
        id: `workout-schedule-${log.id}`,
        title: `${log.title} 운동`,
        date: log.date,
        time: '',
        type: '운동',
        memo: `${log.durationMinutes}분 · ${log.caloriesBurned}kcal`,
        source: 'workout',
        origin: { kind: 'workout', workoutLogId: log.id },
        done: true
      });
      scheduleSaved = saveSchedules(
        session,
        [...readSchedules(session).filter((item) => item.id !== schedule.id), schedule]
      ).saved;
    }
    setDraft((current) => ({ ...current, memo: '' }));
    if (!profileResult?.saved && !scheduleSaved) {
      notify('운동은 저장했지만 신체정보와 일정 등록을 저장하지 못했어요.', 'error');
    } else if (!profileResult?.saved) {
      notify('운동은 저장했지만 신체정보는 저장하지 못했어요.', 'error');
    } else if (!scheduleSaved) {
      notify('운동은 저장했지만 일정에는 등록하지 못했어요.', 'error');
    } else {
      notify('오늘 운동 완료로 기록했어요.', 'success');
    }
    refresh();
  };

  return (
    <div className="lifeHubPage lifeHubWorkoutPage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />
      <WorkoutSessionPanel
        done={Boolean(model.todayWorkout)}
        badge={`오늘 브리핑 · ${model.todayWorkout ? '오늘 운동 완료' : '운동 리마인더'}`}
        title={model.todayWorkout ? `${model.todayWorkout.title} · ${model.todayWorkout.durationMinutes}분` : '오늘 아직 운동 기록이 없어요'}
        text={model.todayWorkout ? '오늘 기록은 완료됐어요. 필요하면 아래에서 추가 기록을 남길 수 있어요.' : '15분만 기록해도 오늘 운동 흐름을 이어갈 수 있어요.'}
      />

      <section className="lifeHubWorkoutQuickDock workout-duration-grid" aria-label="빠른 운동 시간">
        <div>
          <span>바로 기록</span>
          <strong>{workoutChoiceLabel}</strong>
        </div>
        {WORKOUT_DURATION_OPTIONS.map((minutes) => (
          <button
            type="button"
            key={minutes}
            className={String(draft.durationMinutes) === String(minutes) ? 'active' : ''}
            onClick={() => setDraft((current) => ({ ...current, durationMinutes: String(minutes) }))}
          >
            {minutes}분
          </button>
        ))}
      </section>

      <section className="workout-metric-grid" aria-label="운동 통계">
        <article className="workout-metric-tile"><span>이번 달 운동일</span><strong>{new Set(monthLogs.map((log) => log.date)).size}일</strong></article>
        <article className="workout-metric-tile"><span>총 운동시간</span><strong>{totalMinutes}분</strong></article>
        <article className="workout-metric-tile"><span>소모 kcal</span><strong>{formatNumber(totalCalories)}kcal</strong></article>
      </section>

      <BodyProfileCard
        id="shared-body-profile-workout"
        className="workout-coach-card"
        profile={profile}
        onChange={onBodyProfileChange}
        onSave={(nextProfile) => {
          const result = onSaveBodyProfile(nextProfile);
          notify(
            result.saved ? `공용 신체정보를 저장했어요. BMI ${result.bmi.toFixed(1)}` : result.message,
            result.saved ? 'success' : 'error'
          );
          return result;
        }}
      />

      {focusedWorkoutDate ? (
        <Section title={`${compactDateLabel(focusedWorkoutDate)} 운동 기록`} eyebrow={`${focusedWorkoutLogs.length}개`}>
          {focusedWorkoutLogs.length ? (
            <div className="lifeHubWorkoutDateList">
              {focusedWorkoutLogs.map((log) => (
                <article key={log.id}>
                  <span><MemoNavIcon type="trophy" /></span>
                  <div><strong>{log.title || '운동'}</strong><small>{log.durationMinutes || 0}분</small></div>
                  <em>{formatNumber(log.caloriesBurned || 0)}kcal</em>
                </article>
              ))}
            </div>
          ) : <EmptyState title="이 날짜의 완료 운동이 없어요" text="아래 입력창에서 운동을 바로 기록할 수 있어요." icon="trophy" />}
        </Section>
      ) : null}

      <form className="lifeHubFormCard lifeHubFastForm workout-coach-card" onSubmit={submitWorkout}>
        <header><strong>운동 기록</strong><small>종류와 시간만 고르면 바로 저장됩니다.</small></header>
        <QuickChoiceGroup
          label="운동 종류"
          options={[
            { value: 'cardio', label: '유산소' },
            { value: 'upper', label: '상체' },
            { value: 'lower', label: '하체' },
            { value: 'other', label: '기타' }
          ]}
          value={selectedWorkoutChoice}
          onChange={selectTemplate}
          className="workout-type-chip"
        />
        <QuickChoiceGroup
          label="운동 시간"
          options={WORKOUT_DURATION_OPTIONS.map((minutes) => ({ value: String(minutes), label: `${minutes}분` }))}
          value={String(draft.durationMinutes)}
          onChange={(durationMinutes) => setDraft((current) => ({ ...current, durationMinutes }))}
        />
        <label><span>날짜</span><input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label>
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
        <LifeHubButton type="submit" className="primary" icon="trophy">운동 저장 · 예상 {formatNumber(estimatedCalories)}kcal</LifeHubButton>
      </form>
    </div>
  );
}

function FinancePage({ model, path, session, refresh, cardImport }) {
  const requestedFinanceDate = scheduleParamsForPath(path).get('date');
  const focusedFinanceDate = isDateKey(requestedFinanceDate) ? requestedFinanceDate : '';
  const [draft, setDraft] = useState({ type: 'withdraw', amount: '', category: '식비', memo: '', date: focusedFinanceDate || model.today });
  const formRef = useRef(null);
  const amountInputRef = useRef(null);
  const { feedback, notify, clearFeedback } = useLifeHubFeedback();
  const categories = Object.entries(model.budget.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const visibleBudgetEntries = focusedFinanceDate
    ? model.budgetEntries.filter((entry) => entry.date === focusedFinanceDate)
    : model.budgetEntries;

  const selectEntryType = (type, { focusAmount = false } = {}) => {
    setDraft((current) => ({
      ...current,
      type,
      category: type === 'deposit' ? '수입' : current.category === '수입' ? '식비' : current.category
    }));
    if (focusAmount) {
      window.requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        amountInputRef.current?.focus({ preventScroll: true });
      });
    }
  };

  const submitEntry = (event) => {
    event.preventDefault();
    const entry = normalizeBudget({ id: `budget-${Date.now()}`, ...draft, createdAt: new Date().toISOString() });
    if (!entry) {
      notify('금액을 입력해주세요.', 'error');
      return;
    }
    const result = saveBudget(session, [entry, ...readBudget(session)]);
    if (!result.saved) {
      notify('거래를 저장하지 못했어요. 입력 내용은 그대로 두었어요.', 'error');
      return;
    }
    setDraft((current) => ({ ...current, amount: '', memo: '' }));
    notify('거래를 저장했어요.', 'success');
    refresh();
  };

  const deleteEntry = (entry) => {
    if (!window.confirm('이 거래를 삭제할까요?')) return;
    const result = saveBudget(session, readBudget(session).filter((item) => item.id !== entry.id));
    notify(result.saved ? '거래를 삭제했어요.' : '거래 삭제를 저장하지 못했어요.', result.saved ? 'success' : 'error');
    if (result.saved) {
      refresh();
    }
  };

  return (
    <div className="lifeHubPage lifeHubFinancePage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />
      <FinanceWalletCard
        balance={money(model.budget.balance)}
        income={money(model.budget.income)}
        expense={money(model.budget.expense)}
        usage={progressPercent(model.budget.usage)}
        message={model.budget.usage >= 80 ? '이번 달 지출이 비교 기준보다 빠르게 늘고 있어요.' : '이번 달 지출 흐름은 안정적이에요.'}
      />
      <CardTransactionImportPanel
        cardImport={cardImport}
        onManualEntry={() => selectEntryType('withdraw', { focusAmount: true })}
      />
      {model.budget.usage >= 80 ? (
        <article className="lifeHubInsightCard finance-insight-card">
          <strong>지출 속도가 빨라요</strong>
          <p>이번 달 지출이 월 비교 기준의 {model.budget.usage}%입니다. 최근 거래를 한 번 확인해 보세요.</p>
        </article>
      ) : null}
      <section className="lifeHubProgressCard finance-budget-bar">
        <header><strong>월 지출 기준 사용률</strong><span>{model.budget.usage}%</span></header>
        <div className="lifeHubProgress"><span style={{ width: `${progressPercent(model.budget.usage)}%` }} /></div>
        <small>수입이 있으면 수입액, 없으면 100만원을 비교 기준으로 사용합니다.</small>
      </section>
      <Section title="카테고리별 지출" eyebrow="이번 달">
        <div className="lifeHubCategoryBars">
          {categories.map(([category, amount]) => (
            <article key={category} className="finance-category-bar">
              <div><strong>{category}</strong><span>{money(amount)}</span></div>
              <div><span style={{ width: `${progressPercent((amount / Math.max(1, model.budget.expense)) * 100)}%` }} /></div>
            </article>
          ))}
          {categories.length ? null : <EmptyState title="이번 달 지출은 아직 없어요" text="오늘 사용한 금액을 남기면 카테고리 흐름을 보여드릴게요." actionLabel="지출 기록하기" icon="chart" onAction={() => selectEntryType('withdraw', { focusAmount: true })} />}
        </div>
      </Section>
      <form ref={formRef} className="lifeHubFormCard lifeHubFastForm" onSubmit={submitEntry}>
        <header><strong>빠른 수입/지출 입력</strong><small>오늘 기록할 지출이 있나요?</small></header>
        <QuickChoiceGroup
          label="유형"
          options={[{ value: 'withdraw', label: '지출' }, { value: 'deposit', label: '수입' }]}
          value={draft.type}
          onChange={selectEntryType}
        />
        <div className="lifeHubTwoCol">
          <label><span>금액</span><input ref={amountInputRef} type="number" inputMode="numeric" min="0" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} placeholder="0" /></label>
          <label><span>날짜</span><input type="date" value={draft.date} onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))} /></label>
        </div>
        {draft.type === 'withdraw' ? (
          <>
            <QuickChoiceGroup
              label="카테고리"
              options={BUDGET_CATEGORY_OPTIONS}
              value={draft.category}
              onChange={(category) => setDraft((current) => ({ ...current, category }))}
            />
            <details className="lifeHubInlineDetails">
              <summary>다른 카테고리 직접 입력</summary>
              <label><span>카테고리 이름</span><input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} placeholder="예: 의료, 구독" /></label>
            </details>
          </>
        ) : null}
        <label><span>메모</span><input value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} placeholder="간단한 메모" /></label>
        <LifeHubButton type="submit" className="primary" icon="plus">거래 저장</LifeHubButton>
      </form>
      <Section title={focusedFinanceDate ? `${compactDateLabel(focusedFinanceDate)} 거래` : '최근 거래'} eyebrow={`${visibleBudgetEntries.length}개`}>
        <div className="lifeHubTransactionList">
          {visibleBudgetEntries.slice(0, 8).map((entry) => (
            <article key={entry.id} className="finance-ledger-row">
              <span className={entry.type}>{entry.type === 'deposit' ? '수입' : '지출'}</span>
              <div>
                <strong>{entry.source === 'card-notification' ? entry.memo : entry.category}</strong>
                <small>{entry.date} · {entry.source === 'card-notification' ? `카드 자동 · ${entry.category}` : entry.memo || '메모 미입력'}</small>
              </div>
              <em>{entry.type === 'deposit' ? '+' : '-'}{money(entry.amount)}</em>
              <button type="button" className="lifeHubInlineDelete" onClick={() => deleteEntry(entry)} aria-label={`${entry.source === 'card-notification' ? entry.memo : entry.category} 거래 삭제`}>
                삭제
              </button>
            </article>
          ))}
          {visibleBudgetEntries.length ? null : <EmptyState title={focusedFinanceDate ? '이 날짜의 거래가 없어요' : '아직 기록한 거래가 없어요'} text="금액만 입력해도 이번 달 흐름에 바로 반영돼요." actionLabel="지출 기록하기" icon="chart" onAction={() => selectEntryType('withdraw', { focusAmount: true })} />}
        </div>
      </Section>
    </div>
  );
}

function TravelPage({ model, session, refresh, navigate }) {
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
    if (!result.saved) {
      notify('여행 계획을 저장하지 못했어요. 입력 내용은 그대로 두었어요.', 'error');
      return;
    }
    setDraft({ title: '', startDate: '', endDate: '', memo: '' });
    notify('여행 계획을 추가했어요.', 'success');
    refresh();
  };

  const toggleChecklist = (trip, checkId) => {
    const result = saveTrips(session, readTrips(session).map((item) => (
      item.id === trip.id
        ? { ...item, checklist: item.checklist.map((check) => check.id === checkId ? { ...check, done: !check.done } : check) }
        : item
    )));
    notify(result.saved ? '준비 상태를 업데이트했어요.' : '준비 상태 저장에 실패했어요.', result.saved ? 'success' : 'error');
    if (result.saved) refresh();
  };

  const deleteTrip = (trip) => {
    if (!window.confirm('이 여행 계획을 삭제할까요?')) return;
    const result = saveTrips(session, readTrips(session).filter((item) => item.id !== trip.id));
    notify(result.saved ? '여행 계획을 삭제했어요.' : '여행 삭제를 저장하지 못했어요.', result.saved ? 'success' : 'error');
    if (result.saved) refresh();
  };

  return (
    <div className="lifeHubPage lifeHubTravelPage">
      <FeedbackToast feedback={feedback} onClose={clearFeedback} />
      <TravelBoardingPass
        className="travel-dday-hero"
        eyebrow={nextTrip?.startDate ? dDayLabel(nextTrip.startDate) : 'AI TRIP'}
        title={nextTrip ? nextTrip.title : 'AI로 여행 코스를 만들어보세요'}
        meta={nextTrip ? [nextTrip.startDate, nextTrip.endDate].filter(Boolean).join(' - ') || '날짜 미정' : '지역과 날짜를 넣으면 기존 AI 여행 플래너가 코스를 생성합니다.'}
        badge={nextTrip ? `${nextTrip.checklist.filter((item) => item.done).length}/${nextTrip.checklist.length}` : 'AI'}
      >
        <div className="lifeHubTravelActions">
          <button type="button" className="primary" onClick={() => navigate('/planner')}>AI 여행 만들기</button>
          <button type="button" onClick={() => navigate('/plans')}>저장 코스</button>
        </div>
      </TravelBoardingPass>

      {nextTrip ? (
        <article className="lifeHubTripFocus travel-boarding-pass">
          <div>
            <span>{nextTrip.startDate ? dDayLabel(nextTrip.startDate) : '날짜 미정'}</span>
            <strong>{nextTrip.title}</strong>
            <p>{nextTrip.checklist.filter((item) => !item.done).length}개 준비 항목이 남았어요.</p>
          </div>
          <div className="lifeHubProgress"><span style={{ width: `${progressPercent((nextTrip.checklist.filter((item) => item.done).length / Math.max(1, nextTrip.checklist.length)) * 100)}%` }} /></div>
        </article>
      ) : null}

      <div className="lifeHubTripList">
        {model.trips.map((trip) => (
          <article key={trip.id} className="travel-boarding-pass travel-itinerary-row">
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
            <div className="lifeHubTripChecks travel-checklist-strip">
              {trip.checklist.map((check) => (
                <button type="button" key={check.id} className={check.done ? 'done' : ''} onClick={() => toggleChecklist(trip, check.id)}>
                  {check.done ? '완료' : '대기'} · {check.text}
                </button>
              ))}
            </div>
          </article>
        ))}
        {model.trips.length ? null : <div className="travel-empty-state"><EmptyState title="예정된 여행이 아직 없어요" text="여행을 추가하면 예약, 교통, 숙소 체크리스트가 함께 만들어져요." actionLabel="여행 계획 추가" icon="trip" onAction={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })} /></div>}
      </div>

      <form className="lifeHubFormCard lifeHubFastForm" onSubmit={submitTrip}>
        <header><strong>여행 체크리스트 추가</strong><small>AI 코스와 별개로 예약, 교통, 숙소 준비를 관리합니다.</small></header>
        <label><span>여행 이름</span><input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="예: 제주 주말 여행" /></label>
        <div className="lifeHubTwoCol">
          <label><span>출발</span><input type="date" value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label><span>도착</span><input type="date" value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} /></label>
        </div>
        <details className="lifeHubInlineDetails">
          <summary>예약/교통/숙소 메모 더하기</summary>
          <label><span>메모</span><input value={draft.memo} onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))} placeholder="예약 번호, 교통편, 일정 메모" /></label>
        </details>
        <LifeHubButton type="submit" className="primary" icon="plus">체크리스트 저장</LifeHubButton>
      </form>
    </div>
  );
}

function backupDataForModel(model, dailyBriefingSettings) {
  return {
    schedules: model.schedules,
    notes: model.notes,
    workouts: model.workouts,
    dietEntries: model.dietEntries,
    budgetEntries: model.budgetEntries,
    trips: model.trips,
    bodyProfile: model.bodyProfile,
    dailyBriefingSettings
  };
}

function MorePage({ model, session, refresh, onRestoreBackup }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [standalone, setStandalone] = useState(() => (
    window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true
    || Boolean(window.AiAssistantNative)
  ));
  useEffect(() => {
    const captureInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const markInstalled = () => {
      setStandalone(true);
      setInstallPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    window.addEventListener('appinstalled', markInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
      window.removeEventListener('appinstalled', markInstalled);
    };
  }, []);

  const requestInstall = async () => {
    if (standalone) {
      window.alert('이미 앱으로 설치되어 있어요.');
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result?.outcome === 'accepted') setStandalone(true);
      setInstallPrompt(null);
      return;
    }
    window.alert('Android Chrome 메뉴에서 “홈 화면에 추가” 또는 “앱 설치”를 선택해주세요.');
  };

  return (
    <div className="lifeHubPage lifeHubMorePage">
      <section className="lifeHubLocalStorageCard more-control-section" aria-label="저장 방식">
        <span><MemoNavIcon type="file" /></span>
        <div>
          <strong>이 기기에 저장</strong>
          <p>기록을 임의로 잘라내지 않으며, 저장공간이 부족하면 기존 데이터를 유지한 채 알려드려요.</p>
        </div>
      </section>

      <DailyBriefingSettings
        session={session}
        notificationStatus={notificationPermissionState()}
        onRequestNotifications={requestRoutineNotificationPermission}
        onSaved={refresh}
      />

      <LifeHubBackupPanel
        currentData={backupDataForModel(model, readDailyBriefingSettings(session))}
        owner={session?.username || 'guestuser'}
        onRestore={onRestoreBackup}
      />

      <Section title="더보기 메뉴" className="more-control-section more-settings-section">
        <div className="more-settings-list">
          <MoreSettingsRow
            icon="home"
            label="앱 설치"
            detail={standalone ? '설치됨' : installPrompt ? '설치 가능' : '홈 화면에서 앱처럼 실행'}
            onClick={requestInstall}
          />
          <MoreSettingsRow icon="shield" label="도움말" detail="기록은 이 기기에 저장" onClick={() => window.alert('Orbit 기록은 현재 기기에 저장됩니다. 기기 변경이나 앱 삭제 전에는 위의 백업 파일 저장을 실행해주세요. 복원할 때는 합치기 또는 전체 교체를 미리 확인할 수 있어요.')} />
        </div>
      </Section>
    </div>
  );
}

export default function LifeHubApp({ path, navigate }) {
  const [session] = useState(() => readLifeHubOwner());
  const [bodyProfile, setBodyProfile] = useState(() => readBodyProfile(session));
  const [bodyProfileDirty, setBodyProfileDirty] = useState(false);
  const bodyProfileRef = useRef(bodyProfile);
  const bodyProfileDirtyRef = useRef(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const route = routeForPath(path);
  const storedModel = useMemo(
    () => readLifeHubData(session),
    [session?.username, session?.isGuest, refreshSeed]
  );
  const model = useMemo(() => ({
    ...storedModel,
    bodyProfile,
    workoutProfile: bodyProfile
  }), [storedModel, bodyProfile]);

  const refresh = () => setRefreshSeed((current) => current + 1);
  const cardImport = useCardTransactionImport({
    owner: session?.username,
    budgetEntries: model.budgetEntries,
    today: model.today,
    readBudget: () => readBudget(session),
    normalizeBudget,
    saveBudget: (items) => saveBudget(session, items),
    onSaved: refresh
  });
  const restoreLifeHubBackup = (plan) => {
    return applyLifeHubBackupPlan(plan, {
      readCurrent: () => ({
        schedules: readSchedules(session),
        notes: readDailyMemos(session),
        workouts: readWorkouts(session),
        dietEntries: readDietEntries(session),
        budgetEntries: readBudget(session),
        trips: readTrips(session),
        bodyProfile: readBodyProfile(session, { preferSession: false }),
        dailyBriefingSettings: readDailyBriefingSettings(session)
      }),
      normalizers: {
        schedules: normalizeSchedule,
        notes: normalizeDailyMemo,
        workouts: normalizeWorkout,
        dietEntries: normalizeDietEntry,
        budgetEntries: normalizeBudget,
        trips: normalizeTrip,
        dailyBriefingSettings: normalizeDailyBriefingSettings
      },
      validateBodyProfile,
      writers: {
        schedules: (items) => saveSchedules(session, items),
        notes: (items) => saveDailyMemos(session, items),
        workouts: (items) => saveWorkouts(session, items),
        dietEntries: (items) => saveDietEntries(session, items),
        budgetEntries: (items) => saveBudget(session, items),
        trips: (items) => saveTrips(session, items),
        bodyProfile: (profile) => saveBodyProfile(session, profile),
        dailyBriefingSettings: (settings) => saveDailyBriefingSettings(session, settings)
      },
      onProfile: (profile) => {
        bodyProfileRef.current = profile;
        bodyProfileDirtyRef.current = false;
        setBodyProfileDirty(false);
        setBodyProfile(profile);
      },
      onRefresh: refresh
    });
  };
  const updateBodyProfile = (nextProfile) => {
    const candidate = typeof nextProfile === 'function'
      ? nextProfile(bodyProfile)
      : nextProfile;
    const result = cacheBodyProfileSession(session, candidate);
    bodyProfileRef.current = result.profile;
    bodyProfileDirtyRef.current = true;
    setBodyProfileDirty(true);
    setBodyProfile(result.profile);
    return result;
  };
  const persistBodyProfile = (nextProfile = bodyProfile) => {
    const result = saveBodyProfile(session, nextProfile);
    if (result.saved) {
      bodyProfileRef.current = result.profile;
      bodyProfileDirtyRef.current = false;
      setBodyProfileDirty(false);
      setBodyProfile((current) => bodyProfilesEqual(current, result.profile) ? current : result.profile);
    }
    return result;
  };
  const go = (nextPath) => {
    if (navigate) navigate(nextPath);
    else {
      window.history.pushState({}, '', nextPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  useEffect(() => {
    document.title = `Orbit · ${routeTitle(route)}`;
  }, [route]);

  useEffect(() => {
    const syncNotifications = () => {
      const settings = readDailyBriefingSettings(session);
      const briefings = dailyBriefingNotifications(settings, { now: new Date() });
      scheduleRoutineNotifications(model.expandedSchedules, Date.now(), briefings);
    };
    syncNotifications();
    const resyncNotifications = () => {
      if (document.visibilityState === 'hidden') return;
      syncNotifications();
    };
    document.addEventListener('visibilitychange', resyncNotifications);
    window.addEventListener('focus', resyncNotifications);
    return () => {
      document.removeEventListener('visibilitychange', resyncNotifications);
      window.removeEventListener('focus', resyncNotifications);
      clearRoutineNotificationTimers();
    };
  }, [model.expandedSchedules, session?.username]);

  useEffect(() => {
    bodyProfileRef.current = bodyProfile;
  }, [bodyProfile]);

  useEffect(() => {
    if (!bodyProfileDirty || !validateBodyProfile(bodyProfile).valid) return undefined;
    const autosaveTimer = window.setTimeout(() => {
      const result = saveBodyProfile(session, bodyProfile, { emit: false });
      if (!result.saved) return;
      bodyProfileDirtyRef.current = false;
      setBodyProfileDirty(false);
    }, 500);
    return () => window.clearTimeout(autosaveTimer);
  }, [session?.username, bodyProfile, bodyProfileDirty]);

  useEffect(() => {
    const flushBodyProfile = (updateMountedState = false) => {
      const latestProfile = bodyProfileRef.current;
      if (!bodyProfileDirtyRef.current || !validateBodyProfile(latestProfile).valid) return;
      const result = saveBodyProfile(session, latestProfile, { emit: false });
      if (!result.saved) return;
      bodyProfileDirtyRef.current = false;
      if (updateMountedState) setBodyProfileDirty(false);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushBodyProfile(true);
    };
    const handlePageHide = () => flushBodyProfile(false);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      flushBodyProfile(false);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.username]);

  useEffect(() => {
    const durableProfileKey = bodyProfileStorageKey(session);
    const legacyProfileKey = legacyBodyProfileStorageKey(session);
    const sync = (event) => {
      if (
        event.type === BODY_PROFILE_EVENT
        && event.detail?.owner === storageUsername(session)
        && event.detail?.profile
        && !bodyProfileDirtyRef.current
      ) {
        bodyProfileRef.current = event.detail.profile;
        setBodyProfile((current) => (
          bodyProfilesEqual(current, event.detail.profile) ? current : event.detail.profile
        ));
      } else if (
        event.type === 'storage'
        && (
          event.key === durableProfileKey
          || event.key === legacyProfileKey
          || (session.isGuest && event.key === LEGACY_WORKOUT_PROFILE_KEY)
        )
        && !bodyProfileDirtyRef.current
      ) {
        const nextProfile = readBodyProfile(session, { preferSession: false });
        cacheBodyProfileSession(session, nextProfile);
        bodyProfileRef.current = nextProfile;
        setBodyProfile((current) => bodyProfilesEqual(current, nextProfile) ? current : nextProfile);
      }
      refresh();
    };
    window.addEventListener('storage', sync);
    window.addEventListener(LIFEHUB_EVENT, sync);
    window.addEventListener(BODY_PROFILE_EVENT, sync);
    window.addEventListener('codex:scheduler-items-updated', sync);
    window.addEventListener('codex:notes-updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(LIFEHUB_EVENT, sync);
      window.removeEventListener(BODY_PROFILE_EVENT, sync);
      window.removeEventListener('codex:scheduler-items-updated', sync);
      window.removeEventListener('codex:notes-updated', sync);
    };
  }, [session?.username]);

  let content = null;
  if (route === 'memo') content = (
    <DailyMemoPage
      key={storageUsername(session)}
      navigate={go}
      notes={model.notes}
      path={path}
      refresh={refresh}
      session={session}
    />
  );
  else if (route === 'schedule') content = <SchedulePage model={model} session={session} refresh={refresh} path={path} />;
  else if (route === 'workout') content = (
    <WorkoutPage
      model={model}
      onBodyProfileChange={updateBodyProfile}
      onSaveBodyProfile={persistBodyProfile}
      path={path}
      session={session}
      refresh={refresh}
    />
  );
  else if (route === 'diet') content = (
    <DietPage
      model={model}
      onBodyProfileChange={updateBodyProfile}
      onSaveBodyProfile={persistBodyProfile}
      refresh={refresh}
      session={session}
    />
  );
  else if (route === 'finance') content = (
    <FinancePage
      model={model}
      path={path}
      session={session}
      refresh={refresh}
      cardImport={cardImport}
    />
  );
  else if (route === 'more') content = (
    <MorePage
      model={model}
      session={session}
      refresh={refresh}
      onRestoreBackup={restoreLifeHubBackup}
    />
  );
  else content = <HomePage model={model} navigate={go} />;

  return (
    <LifeHubShell
      route={route}
      path={path}
      model={model}
      navigate={go}
    >
      {content}
    </LifeHubShell>
  );
}
