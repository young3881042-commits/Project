import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeRepeatDays,
  normalizeScheduleRepeat,
  scheduleRecurrenceMatches,
  scheduleRepeatFor,
  toggleRepeatDay,
  weekdayForDate
} from '../src/components/schedule/scheduleRecurrenceModel.js';

test('커스텀 반복과 매주 반복을 구분하고 요일 값을 안전하게 정규화한다', () => {
  assert.equal(normalizeScheduleRepeat('커스텀'), 'custom');
  assert.equal(normalizeScheduleRepeat('사용자 지정'), 'custom');
  assert.equal(normalizeScheduleRepeat('매주'), 'weekly');
  assert.equal(scheduleRepeatFor({ repeat: 'custom', recurrence: 'weekly' }), 'custom');
  assert.deepEqual(normalizeRepeatDays(['금', 1, '3', '월요일', 9, null]), [1, 3, 5]);
  assert.equal(weekdayForDate('2026-07-14'), 2);
  assert.deepEqual(normalizeRepeatDays([], '2026-07-14'), [2]);
});

test('요일 버튼은 중복 없이 선택과 해제를 오름차순으로 반영한다', () => {
  assert.deepEqual(toggleRepeatDay([5, 1], 3), [1, 3, 5]);
  assert.deepEqual(toggleRepeatDay([1, 3, 5], 3), [1, 5]);
  assert.deepEqual(toggleRepeatDay([1], 1), []);
});

test('커스텀 일정은 시작일 이후 선택한 여러 요일에만 반복된다', () => {
  const schedule = {
    date: '2026-07-14',
    repeat: 'custom',
    recurrence: 'custom',
    repeatDays: [1, 3, 5],
    recurrenceEnd: '2026-07-24'
  };
  assert.equal(scheduleRecurrenceMatches(schedule, '2026-07-13'), false);
  assert.equal(scheduleRecurrenceMatches(schedule, '2026-07-14'), false);
  assert.equal(scheduleRecurrenceMatches(schedule, '2026-07-15'), true);
  assert.equal(scheduleRecurrenceMatches(schedule, '2026-07-17'), true);
  assert.equal(scheduleRecurrenceMatches(schedule, '2026-07-20'), true);
  assert.equal(scheduleRecurrenceMatches(schedule, '2026-07-21'), false);
  assert.equal(scheduleRecurrenceMatches(schedule, '2026-07-27'), false);
});

test('요일 정보가 없는 예전 custom 값은 시작일과 같은 요일의 매주 반복을 유지한다', () => {
  const legacy = { date: '2026-07-14', repeat: 'custom' };
  assert.equal(scheduleRecurrenceMatches(legacy, '2026-07-14'), true);
  assert.equal(scheduleRecurrenceMatches(legacy, '2026-07-21'), true);
  assert.equal(scheduleRecurrenceMatches(legacy, '2026-07-15'), false);
});
