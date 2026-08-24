import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isIncompleteSchedule,
  scheduleDisplayStatus,
  scheduleStatusLabel
} from '../src/components/schedule/scheduleStatusModel.js';

const NOW = new Date(2026, 7, 23, 14, 30, 0);

test('완료하지 않은 지난 일정은 미완료로 표시한다', () => {
  const item = { date: '2026-08-22', time: '10:00', done: false };
  assert.equal(isIncompleteSchedule(item, NOW), true);
  assert.equal(scheduleDisplayStatus(item, NOW), 'incomplete');
  assert.equal(scheduleStatusLabel(item, NOW), '미완료');
});

test('오늘 시간이 지난 일정은 미완료, 아직 오지 않은 일정은 예정으로 표시한다', () => {
  assert.equal(scheduleStatusLabel({ date: '2026-08-23', time: '14:29' }, NOW), '미완료');
  assert.equal(scheduleStatusLabel({ date: '2026-08-23', time: '14:30' }, NOW), '예정');
  assert.equal(scheduleStatusLabel({ date: '2026-08-23', time: '18:00' }, NOW), '예정');
});

test('종일 일정은 당일이 끝난 뒤에만 미완료가 된다', () => {
  assert.equal(scheduleStatusLabel({ date: '2026-08-23', time: '' }, NOW), '예정');
  assert.equal(scheduleStatusLabel({ date: '2026-08-22', time: '' }, NOW), '미완료');
});

test('완료 상태는 날짜와 관계없이 미완료보다 우선한다', () => {
  const item = { date: '2026-08-20', time: '09:00', done: true, status: 'done' };
  assert.equal(isIncompleteSchedule(item, NOW), false);
  assert.equal(scheduleDisplayStatus(item, NOW), 'done');
  assert.equal(scheduleStatusLabel(item, NOW), '완료');
});
