import { stableNativeNotificationId } from '../lifehub-ai/nativeNotifications.js';
import { formatNumber, isTimeKey, todayKey } from '../../utils/lifeHubFormatters.js';

export const DAILY_BRIEFING_EVENT = 'lifehub:daily-briefing-settings';
export const DAILY_BRIEFING_STORAGE_KEY = 'orbit.daily-briefing:v1';
export const DEFAULT_DAILY_BRIEFING_SETTINGS = Object.freeze({
  morningEnabled: false,
  morningTime: '07:30',
  eveningEnabled: false,
  eveningTime: '21:00'
});

function ownerName(session) {
  const username = typeof session === 'string' ? session : session?.username;
  return String(username || 'guestuser').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'guestuser';
}

function settingsKey(session) {
  return `${DAILY_BRIEFING_STORAGE_KEY}:${ownerName(session)}`;
}

export function normalizeDailyBriefingSettings(value = {}) {
  return {
    morningEnabled: value?.morningEnabled === true,
    morningTime: isTimeKey(value?.morningTime) ? value.morningTime : DEFAULT_DAILY_BRIEFING_SETTINGS.morningTime,
    eveningEnabled: value?.eveningEnabled === true,
    eveningTime: isTimeKey(value?.eveningTime) ? value.eveningTime : DEFAULT_DAILY_BRIEFING_SETTINGS.eveningTime
  };
}

export function readDailyBriefingSettings(session, storage = globalThis.localStorage) {
  if (!storage) return { ...DEFAULT_DAILY_BRIEFING_SETTINGS };
  try {
    return normalizeDailyBriefingSettings(JSON.parse(storage.getItem(settingsKey(session)) || '{}'));
  } catch {
    return { ...DEFAULT_DAILY_BRIEFING_SETTINGS };
  }
}

export function saveDailyBriefingSettings(session, value, {
  storage = globalThis.localStorage,
  eventTarget = globalThis.window
} = {}) {
  const settings = normalizeDailyBriefingSettings(value);
  try {
    storage?.setItem(settingsKey(session), JSON.stringify(settings));
  } catch {
    return { saved: false, settings };
  }
  eventTarget?.dispatchEvent?.(new CustomEvent(DAILY_BRIEFING_EVENT, { detail: { settings } }));
  return { saved: true, settings };
}

function entryDate(value) {
  return String(value?.date || '');
}

function todaySchedules(model, date) {
  const source = Array.isArray(model?.expandedSchedules) ? model.expandedSchedules : model?.todaySchedules || [];
  return source.filter((item) => entryDate(item) === date);
}

function todayExpenses(model, date) {
  return (Array.isArray(model?.budgetEntries) ? model.budgetEntries : [])
    .filter((entry) => entryDate(entry) === date && entry?.type !== 'deposit')
    .reduce((sum, entry) => sum + Math.max(0, Number(entry?.amount) || 0), 0);
}

export function buildDailyBriefing(model = {}, {
  period = 'auto',
  now = new Date()
} = {}) {
  const date = model.today || todayKey(now);
  const selectedPeriod = period === 'morning' || period === 'evening'
    ? period
    : now.getHours() < 17 ? 'morning' : 'evening';
  const schedules = todaySchedules(model, date);
  const pendingSchedules = schedules.filter((item) => !item.done);
  const completedSchedules = schedules.filter((item) => item.done);
  const missedCount = (Array.isArray(model?.missedSchedules) ? model.missedSchedules : []).filter((item) => !item.done).length;
  const workouts = (Array.isArray(model?.workouts) ? model.workouts : []).filter((item) => entryDate(item) === date);
  const dietEntries = (Array.isArray(model?.dietEntries) ? model.dietEntries : []).filter((item) => entryDate(item) === date);
  const calories = dietEntries.reduce((sum, entry) => sum + Math.max(0, Number(entry?.calories) || 0), 0);
  const expense = todayExpenses(model, date);

  if (selectedPeriod === 'morning') {
    const items = [
      {
        icon: 'calendar',
        label: '오늘 일정',
        value: `${pendingSchedules.length}개`,
        detail: schedules.length ? `전체 ${schedules.length}개 중 준비할 일정` : '오늘 예정된 일정이 없어요',
        route: `/schedule?date=${encodeURIComponent(date)}`
      },
      {
        icon: 'bell',
        label: '놓친 일정',
        value: `${missedCount}개`,
        detail: missedCount ? '먼저 정리하면 하루가 가벼워져요' : '밀린 일정이 없어요',
        route: '/schedule?filter=missed'
      },
      {
        icon: 'chart',
        label: '이번 달 지출',
        value: `${formatNumber(model?.budget?.expense || 0)}원`,
        detail: '오늘 지출은 가계부에서 바로 기록할 수 있어요',
        route: `/finance?date=${encodeURIComponent(date)}`
      }
    ];
    return {
      period: selectedPeriod,
      eyebrow: '아침 자동 브리핑',
      title: pendingSchedules.length ? `오늘 준비할 일정이 ${pendingSchedules.length}개 있어요` : '여유롭게 하루를 시작해보세요',
      summary: `오늘 일정 ${pendingSchedules.length}개${missedCount ? `, 놓친 일정 ${missedCount}개` : ''}`,
      items
    };
  }

  const items = [
    {
      icon: 'checkSquare',
      label: '완료 일정',
      value: `${completedSchedules.length}/${schedules.length}`,
      detail: pendingSchedules.length ? `아직 ${pendingSchedules.length}개 남았어요` : '오늘 일정 확인 완료',
      route: `/schedule?date=${encodeURIComponent(date)}`
    },
    {
      icon: 'trophy',
      label: '운동',
      value: workouts.length ? `${workouts.reduce((sum, item) => sum + Math.max(0, Number(item?.durationMinutes) || 0), 0)}분` : '미기록',
      detail: workouts.length ? `${workouts.length}개 운동 기록` : '오늘 움직임을 짧게 남겨보세요',
      route: `/workout?date=${encodeURIComponent(date)}`
    },
    {
      icon: 'meal',
      label: '식단',
      value: dietEntries.length ? `${formatNumber(calories)}kcal` : '미기록',
      detail: dietEntries.length ? `${dietEntries.length}개 식사 기록` : '기억나는 식사만 기록해도 충분해요',
      route: '/diet'
    },
    {
      icon: 'chart',
      label: '오늘 지출',
      value: `${formatNumber(expense)}원`,
      detail: expense ? '오늘 소비 내역을 확인해보세요' : '오늘 기록된 지출이 없어요',
      route: `/finance?date=${encodeURIComponent(date)}`
    }
  ];
  return {
    period: selectedPeriod,
    eyebrow: '저녁 자동 브리핑',
    title: pendingSchedules.length ? `오늘 할 일이 ${pendingSchedules.length}개 남았어요` : '오늘 하루를 정리했어요',
    summary: `일정 ${completedSchedules.length}/${schedules.length}, 운동 ${workouts.length ? '기록' : '미기록'}, 식단 ${dietEntries.length}건`,
    items
  };
}

function localDateParts(date) {
  return [date.getFullYear(), date.getMonth(), date.getDate()];
}

function triggerFor(date, time) {
  const [year, month, day] = localDateParts(date);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month, day, hour, minute, 0, 0).getTime();
}

export function dailyBriefingNotifications(settingsValue, {
  now = new Date(),
  horizonDays = 14
} = {}) {
  const settings = normalizeDailyBriefingSettings(settingsValue);
  const notifications = [];
  const plans = [
    settings.morningEnabled ? {
      kind: 'morning',
      time: settings.morningTime,
      title: 'Orbit 아침 브리핑',
      body: '오늘 일정과 놓친 일을 확인하고 하루를 시작해보세요.'
    } : null,
    settings.eveningEnabled ? {
      kind: 'evening',
      time: settings.eveningTime,
      title: 'Orbit 저녁 브리핑',
      body: '오늘 일정과 운동·식단·지출 기록을 가볍게 정리해보세요.'
    } : null
  ].filter(Boolean);

  for (let offset = 0; offset < Math.max(1, Math.min(31, horizonDays)); offset += 1) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    for (const plan of plans) {
      const triggerAt = triggerFor(date, plan.time);
      if (triggerAt <= now.getTime()) continue;
      const dateKey = todayKey(date);
      notifications.push({
        id: stableNativeNotificationId('lifehub-briefing', `${plan.kind}:${dateKey}:${plan.time}`),
        title: plan.title,
        body: plan.body,
        path: `/app?briefing=${plan.kind}`,
        triggerAt
      });
    }
  }
  return notifications.sort((left, right) => left.triggerAt - right.triggerAt);
}
