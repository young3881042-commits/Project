import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUTINE_NOTIFICATION_HORIZON_MS,
  nativeRoutineNotifications,
  reminderDateTimeMs,
  reminderOffsetMinutes,
  routineReminderSaveStatus,
  routineReminderTiming,
  scheduleDateTimeMs
} from '../src/components/schedule/routineNotificationModel.js';

function localTime(dayOffset, hour, minute) {
  return new Date(2026, 6, 12 + dayOffset, hour, minute, 0, 0);
}

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function timeKey(date) {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0')
  ].join(':');
}

function reminderAt(date, reminder = 'at_time', overrides = {}) {
  return {
    id: 'schedule-1',
    title: '테스트 일정',
    date: dateKey(date),
    time: timeKey(date),
    reminder,
    ...overrides
  };
}

test('정시와 5·10·30분 전 알림 시각을 로컬 일정 시각에서 계산한다', () => {
  const startsAt = localTime(0, 10, 30);
  const item = reminderAt(startsAt);
  assert.equal(scheduleDateTimeMs(item), startsAt.getTime());
  assert.equal(reminderOffsetMinutes('at_time'), 0);
  assert.equal(reminderOffsetMinutes('5m'), 5);
  assert.equal(reminderOffsetMinutes('10m'), 10);
  assert.equal(reminderOffsetMinutes('30m'), 30);
  assert.equal(reminderDateTimeMs(item), startsAt.getTime());
  assert.equal(reminderDateTimeMs({ ...item, reminder: '5m' }), startsAt.getTime() - 5 * 60000);
  assert.equal(reminderDateTimeMs({ ...item, reminder: '10m' }), startsAt.getTime() - 10 * 60000);
  assert.equal(reminderDateTimeMs({ ...item, reminder: '30m' }), startsAt.getTime() - 30 * 60000);
});

test('이미 지난 시각과 정확히 now는 제외하고 14일 경계까지만 예약한다', () => {
  const now = localTime(0, 10, 0).getTime();
  const atNow = reminderAt(new Date(now));
  const oneMinuteLater = reminderAt(new Date(now + 60000));
  const atHorizon = reminderAt(new Date(now + ROUTINE_NOTIFICATION_HORIZON_MS));
  const afterHorizon = reminderAt(new Date(now + ROUTINE_NOTIFICATION_HORIZON_MS + 60000));
  assert.equal(routineReminderTiming(atNow, now).status, 'past');
  assert.equal(routineReminderTiming(oneMinuteLater, now).status, 'eligible');
  assert.equal(routineReminderTiming(atHorizon, now).status, 'eligible');
  assert.equal(routineReminderTiming(afterHorizon, now).status, 'beyond_horizon');
  assert.equal(routineReminderTiming({ ...oneMinuteLater, time: '' }, now).status, 'invalid');
  assert.equal(routineReminderTiming({ ...oneMinuteLater, reminder: 'none' }, now).status, 'none');
});

test('반복 일정도 빈 시간을 거부하고 실제 다음 발생이 있을 때만 예약 성공으로 본다', () => {
  const now = localTime(0, 10, 0).getTime();
  const repeating = reminderAt(localTime(-7, 10, 30), 'at_time', {
    repeat: 'weekly',
    recurrence: 'weekly'
  });
  assert.equal(
    routineReminderSaveStatus({ ...repeating, time: '' }, 0, now),
    'invalid'
  );
  assert.equal(routineReminderSaveStatus(repeating, 0, now), 'no_upcoming');
  assert.equal(routineReminderSaveStatus(repeating, 1, now), 'eligible');
});

test('완료·과거·14일 밖 일정은 빼고 반복 일정의 원본 id로 알림을 만든다', () => {
  const now = localTime(0, 10, 0).getTime();
  const eligible = reminderAt(localTime(0, 10, 5), 'at_time', {
    id: 'source-1:2026-07-12',
    scheduleId: 'source-1'
  });
  const later = reminderAt(localTime(0, 10, 30), '10m', {
    id: 'source-2',
    title: '운동'
  });
  const rows = nativeRoutineNotifications([
    { ...eligible, done: true },
    reminderAt(localTime(0, 9, 59)),
    reminderAt(localTime(15, 10, 0)),
    later,
    eligible
  ], now);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.triggerAt), [
    localTime(0, 10, 5).getTime(),
    localTime(0, 10, 20).getTime()
  ]);
  assert.equal(rows[0].path, '/schedule?edit=source-1');
  assert.match(rows[0].id, /^lifehub-routine-/);
  assert.equal(rows[1].title, '운동');
});

test('네이티브 제한에 맞춰 가장 이른 알림 128개만 전달한다', () => {
  const now = localTime(0, 0, 0).getTime();
  const items = Array.from({ length: 130 }, (_, index) => {
    const trigger = new Date(now + (index + 1) * 60000);
    return reminderAt(trigger, 'at_time', { id: `schedule-${index}` });
  });
  const rows = nativeRoutineNotifications(items.reverse(), now);
  assert.equal(rows.length, 128);
  assert.equal(rows[0].triggerAt, now + 60000);
  assert.equal(rows[127].triggerAt, now + 128 * 60000);
});
