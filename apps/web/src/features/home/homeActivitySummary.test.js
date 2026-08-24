import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HOME_ACTIVITY_PERIODS,
  buildHomeActivitySummary,
  dateKeysInRange,
  homeActivityRange
} from './homeActivitySummary.js';

test('활동 요약 기간은 주·월·연·전체 순서로 제공된다', () => {
  assert.deepEqual(HOME_ACTIVITY_PERIODS.map((item) => item.value), ['week', 'month', 'year', 'all']);
  assert.deepEqual(HOME_ACTIVITY_PERIODS.map((item) => item.label), ['주', '월', '연', '전체']);
});

test('주·월·연 범위는 오늘을 끝으로 계산한다', () => {
  assert.deepEqual(homeActivityRange('week', '2026-07-15'), {
    start: '2026-07-13',
    end: '2026-07-15'
  });
  assert.deepEqual(homeActivityRange('month', '2026-07-15'), {
    start: '2026-07-01',
    end: '2026-07-15'
  });
  assert.deepEqual(homeActivityRange('year', '2026-07-15'), {
    start: '2026-01-01',
    end: '2026-07-15'
  });
  assert.deepEqual(dateKeysInRange('2026-07-13', '2026-07-15'), [
    '2026-07-13',
    '2026-07-14',
    '2026-07-15'
  ]);
});

test('전체 범위는 현재 제공하는 일정·가계부 중 가장 이른 날짜부터 시작한다', () => {
  assert.deepEqual(homeActivityRange('all', '2026-07-15', {
    schedules: [{ date: '2026-02-01' }],
    workouts: [{ date: '2025-12-30' }],
    dietEntries: [{ date: '잘못된 날짜' }],
    budgetEntries: [{ date: '2026-01-03' }]
  }), { start: '2026-01-03', end: '2026-07-15' });
  assert.deepEqual(homeActivityRange('all', '2026-07-15'), {
    start: '2026-07-15',
    end: '2026-07-15'
  });
});

test('주간 요약은 반복 일정을 날짜별로 확장하고 일정·지출 합계를 만든다', () => {
  const summary = buildHomeActivitySummary({
    period: 'week',
    today: '2026-07-15',
    schedules: [
      {
        id: 'daily',
        date: '2026-07-13',
        repeat: 'daily',
        doneOverrides: { '2026-07-13': true, '2026-07-15': true }
      },
      { id: 'meeting', date: '2026-07-14', done: true, type: '업무' },
      { id: 'exercise', date: '2026-07-14', done: true, type: '운동' },
      { id: 'old', date: '2026-07-12', done: true, type: '개인' }
    ],
    workouts: [
      { id: 'workout-in', date: '2026-07-14' },
      { id: 'workout-out', date: '2026-07-12' }
    ],
    dietEntries: [
      { id: 'meal-1', date: '2026-07-13', calories: 500 },
      { id: 'meal-2', date: '2026-07-15', calories: 250 },
      { id: 'meal-old', date: '2026-07-12', calories: 900 }
    ],
    budgetEntries: [
      { id: 'expense-1', date: '2026-07-13', type: 'withdraw', amount: 12000 },
      { id: 'income', date: '2026-07-14', type: 'deposit', amount: 50000 },
      { id: 'expense-old', date: '2026-07-12', type: 'withdraw', amount: 3000 }
    ]
  });

  assert.equal(summary.periodMeta.title, '이번 주');
  assert.deepEqual(summary.range, { start: '2026-07-13', end: '2026-07-15' });
  assert.deepEqual(summary.stats.map((item) => item.value), [
    '4/5',
    '12,000원'
  ]);
  assert.deepEqual(summary.stats.map((item) => item.route), ['/schedule', '/finance']);
});

test('전체 요약은 기본 완료와 반복 완료 기록을 합쳐 개수로 표시한다', () => {
  const summary = buildHomeActivitySummary({
    period: 'all',
    today: '2026-07-15',
    schedules: [
      { id: 'done', date: '2026-01-01', done: true },
      {
        id: 'recurring',
        date: '2026-02-01',
        done: false,
        doneOverrides: { '2026-02-02': true, '2026-02-03': false, '2026-02-04': true }
      },
      { id: 'exercise', date: '2025-01-01', done: true, type: '운동' }
    ],
    workouts: [],
    dietEntries: [],
    budgetEntries: []
  });

  assert.equal(summary.stats[0].value, '4개');
  assert.deepEqual(summary.range, { start: '2025-01-01', end: '2026-07-15' });
});
