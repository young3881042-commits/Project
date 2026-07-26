import { stableNativeNotificationId } from '../../features/lifehub-ai/nativeNotifications.js';
import { isDateKey, isTimeKey } from '../../utils/lifeHubFormatters.js';

export const ROUTINE_NOTIFICATION_HORIZON_MS = 14 * 86400000;

export function reminderOffsetMinutes(reminder) {
  if (reminder === '5m') return 5;
  if (reminder === '10m') return 10;
  if (reminder === '30m') return 30;
  return 0;
}

export function scheduleDateTimeMs(item) {
  if (!isDateKey(item?.date) || !isTimeKey(item?.time)) return null;
  const [year, month, day] = item.date.split('-').map(Number);
  const [hour, minute] = item.time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

export function reminderDateTimeMs(item) {
  if (!item || !item.reminder || item.reminder === 'none') return null;
  const startsAt = scheduleDateTimeMs(item);
  if (startsAt === null) return null;
  return startsAt - reminderOffsetMinutes(item.reminder) * 60000;
}

export function routineReminderTiming(item, now = Date.now()) {
  if (!item?.reminder || item.reminder === 'none') {
    return { status: 'none', triggerAt: null };
  }
  const triggerAt = reminderDateTimeMs(item);
  if (triggerAt === null) return { status: 'invalid', triggerAt: null };
  if (triggerAt <= now) return { status: 'past', triggerAt };
  if (triggerAt > now + ROUTINE_NOTIFICATION_HORIZON_MS) {
    return { status: 'beyond_horizon', triggerAt };
  }
  return { status: 'eligible', triggerAt };
}

export function routineReminderSaveStatus(item, eligibleCount, now = Date.now()) {
  const timing = routineReminderTiming(item, now);
  if (timing.status === 'none' || timing.status === 'invalid') return timing.status;
  const repeating = item?.repeat && item.repeat !== 'none'
    || item?.recurrence && item.recurrence !== 'none';
  if (!repeating) return timing.status;
  return eligibleCount > 0 ? 'eligible' : 'no_upcoming';
}

export function nativeRoutineNotifications(items, now = Date.now()) {
  return items
    .filter((item) => !item.done && item.reminder && item.reminder !== 'none')
    .map((item) => {
      const timing = routineReminderTiming(item, now);
      const scheduleId = item.scheduleId || item.sourceId || item.id;
      if (timing.status !== 'eligible' || !scheduleId) return null;
      const key = `${scheduleId}:${item.date}:${item.time}:${item.reminder}`;
      return {
        id: stableNativeNotificationId('lifehub-routine', key),
        title: String(item.title || 'LifeHub 일정').trim().slice(0, 100),
        body: '지금 시작할 시간이에요!',
        path: `/schedule?edit=${encodeURIComponent(scheduleId)}`,
        triggerAt: timing.triggerAt
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.triggerAt - right.triggerAt)
    .slice(0, 128);
}
