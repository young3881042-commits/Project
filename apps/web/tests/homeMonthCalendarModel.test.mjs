import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMonthCalendar,
  clampDateToMonth,
  expandSchedulesForCalendar,
  formatCalendarAmount,
  shiftCalendarMonth,
  summarizeHomeCalendar,
  summarizeMonthFinances
} from '../src/components/home/homeMonthCalendarModel.js';

test('월 이동과 말일 선택을 연도 경계·윤년에 맞게 계산한다', () => {
  assert.equal(shiftCalendarMonth('2026-01', -1), '2025-12');
  assert.equal(shiftCalendarMonth('2026-12', 1), '2027-01');
  assert.equal(clampDateToMonth('2026-02', '2026-01-31'), '2026-02-28');
  assert.equal(clampDateToMonth('2028-02', '2028-01-31'), '2028-02-29');
});

test('일요일 시작 6주 달력과 윤년 날짜를 정확히 만든다', () => {
  const august = buildMonthCalendar('2026-08');
  assert.equal(august.cells.length, 42);
  assert.equal(august.startDate, '2026-07-26');
  assert.equal(august.endDate, '2026-09-05');
  assert.equal(august.cells.filter((cell) => cell.inMonth).length, 31);

  const leapFebruary = buildMonthCalendar('2028-02');
  assert.equal(leapFebruary.cells.filter((cell) => cell.inMonth).length, 29);
  assert.equal(leapFebruary.dateKeys.includes('2028-02-29'), true);
  assert.equal(leapFebruary.dateKeys.includes('2028-02-30'), false);
});

test('표시 월 날짜를 기준으로 반복 일정과 날짜별 완료 상태를 확장한다', () => {
  const calendar = buildMonthCalendar('2024-02');
  const schedules = expandSchedulesForCalendar([
    {
      id: 'daily-1',
      title: '매일 물 마시기',
      date: '2024-01-01',
      repeat: 'daily',
      recurrence: 'daily',
      doneOverrides: { '2024-02-10': true }
    },
    {
      id: 'monthly-31',
      title: '매월 말일',
      date: '2024-01-31',
      repeat: 'monthly',
      recurrence: 'monthly',
      doneOverrides: {}
    }
  ], calendar.dateKeys);

  const februaryDaily = schedules.filter((item) => item.id.startsWith('daily-1:') && item.date.startsWith('2024-02'));
  assert.equal(februaryDaily.length, 29);
  assert.equal(februaryDaily.find((item) => item.date === '2024-02-10').done, true);
  assert.equal(schedules.some((item) => item.id.startsWith('monthly-31:') && item.date.startsWith('2024-02')), false);
});

test('주중·주말·매주 반복과 반복 종료일을 표시 범위에서 지킨다', () => {
  const calendar = buildMonthCalendar('2024-02');
  const schedules = expandSchedulesForCalendar([
    { id: 'weekdays', date: '2024-02-01', repeat: 'weekdays', recurrenceEnd: '2024-02-05' },
    { id: 'weekends', date: '2024-02-01', repeat: 'weekends', recurrenceEnd: '2024-02-11' },
    { id: 'weekly', date: '2024-01-03', repeat: 'weekly', recurrenceEnd: '2024-02-15' }
  ], calendar.dateKeys);

  assert.deepEqual(
    schedules.filter((item) => item.scheduleId === 'weekdays').map((item) => item.date),
    ['2024-02-01', '2024-02-02', '2024-02-05']
  );
  assert.deepEqual(
    schedules.filter((item) => item.scheduleId === 'weekends').map((item) => item.date),
    ['2024-02-03', '2024-02-04', '2024-02-10', '2024-02-11']
  );
  assert.deepEqual(
    schedules.filter((item) => item.scheduleId === 'weekly').map((item) => item.date),
    ['2024-01-31', '2024-02-07', '2024-02-14']
  );
});

test('커스텀 반복은 홈 달력에서도 선택한 요일에만 표시한다', () => {
  const schedules = expandSchedulesForCalendar([{
    id: 'custom-days',
    date: '2026-07-14',
    repeat: 'custom',
    recurrence: 'custom',
    repeatDays: [1, 3, 5]
  }], [
    '2026-07-14',
    '2026-07-15',
    '2026-07-16',
    '2026-07-17',
    '2026-07-18',
    '2026-07-19',
    '2026-07-20'
  ]);

  assert.deepEqual(schedules.map((item) => item.date), [
    '2026-07-15',
    '2026-07-17',
    '2026-07-20'
  ]);
});

test('날짜별 수입·지출과 일정 예정/완료를 중복 없이 집계한다', () => {
  const date = '2026-08-03';
  const summaries = summarizeHomeCalendar({
    dateKeys: [date, '2026-08-04'],
    schedules: [
      { id: 'exercise-plan', date, title: '상체 운동', category: 'exercise', type: '운동', done: false },
      { id: 'exercise-done', date, title: '하체 운동', category: 'exercise', type: '운동', done: true },
      { id: 'schedule-plan', date, title: '회의', category: 'work', type: '업무', done: false },
      { id: 'schedule-done', date, title: '병원', category: 'etc', type: '개인', done: true }
    ],
    budgetEntries: [
      { id: 'income-1', date, type: 'deposit', amount: 10000 },
      { id: 'income-2', date, type: 'deposit', amount: 15000 },
      { id: 'income-2', date, type: 'deposit', amount: 15000 },
      { id: 'expense-1', date, type: 'withdraw', amount: 3000 },
      { id: 'expense-2', date, type: 'withdraw', amount: 2000 },
      { id: 'other-day', date: '2026-08-04', type: 'withdraw', amount: 9000 }
    ],
    now: new Date(2026, 7, 3, 12, 0, 0)
  });

  assert.equal(summaries[date].income, 25000);
  assert.equal(summaries[date].expense, 5000);
  assert.equal(summaries[date].incomeCount, 2);
  assert.equal(summaries[date].expenseCount, 2);
  assert.equal(summaries[date].schedulePlanned, 2);
  assert.equal(summaries[date].scheduleIncomplete, 0);
  assert.equal(summaries[date].scheduleDone, 2);
  assert.equal(summaries[date].activities.length, 4);
  assert.equal(Object.hasOwn(summaries[date], 'workoutPlanned'), false);
  assert.equal(Object.hasOwn(summaries[date], 'workoutDone'), false);
  assert.equal(summaries['2026-08-04'].expense, 9000);
});

test('레거시 운동 기록 collection은 홈 달력에 표시하지 않는다', () => {
  const date = '2026-08-03';
  const summaries = summarizeHomeCalendar({
    dateKeys: [date],
    workouts: [{ id: 'workout-legacy', date, title: '완료 운동' }],
    schedules: [],
    budgetEntries: [],
    now: new Date(2026, 7, 3, 12, 0, 0)
  });

  assert.equal(summaries[date].activities.length, 0);
  assert.equal(summaries[date].schedulePlanned, 0);
  assert.equal(summaries[date].scheduleIncomplete, 0);
  assert.equal(summaries[date].scheduleDone, 0);
});

test('홈 달력도 지난 미완료 일정과 오늘 시간이 지난 일정을 구분한다', () => {
  const summaries = summarizeHomeCalendar({
    dateKeys: ['2026-08-22', '2026-08-23'],
    schedules: [
      { id: 'past', date: '2026-08-22', title: '지난 일정', done: false },
      { id: 'due', date: '2026-08-23', time: '09:00', title: '시간 지난 일정', done: false },
      { id: 'future', date: '2026-08-23', time: '18:00', title: '저녁 일정', done: false }
    ],
    budgetEntries: [],
    now: new Date(2026, 7, 23, 14, 30, 0)
  });

  assert.equal(summaries['2026-08-22'].scheduleIncomplete, 1);
  assert.equal(summaries['2026-08-23'].scheduleIncomplete, 1);
  assert.equal(summaries['2026-08-23'].schedulePlanned, 1);
  assert.deepEqual(summaries['2026-08-23'].activities.map((item) => item.status), ['미완료', '예정']);
});

test('선택한 월의 수입과 지출 합계를 다른 달과 분리한다', () => {
  const totals = summarizeMonthFinances('2026-08', [
    { id: 'income-1', date: '2026-08-01', type: 'deposit', amount: 10000 },
    { id: 'income-2', date: '2026-08-31', type: 'deposit', amount: 15000 },
    { id: 'income-2', date: '2026-08-31', type: 'deposit', amount: 15000 },
    { id: 'expense-1', date: '2026-08-15', type: 'withdraw', amount: 5000 },
    { id: 'other-month', date: '2026-09-01', type: 'withdraw', amount: 9000 }
  ]);

  assert.deepEqual(totals, { income: 25000, expense: 5000, incomeCount: 2, expenseCount: 1 });
});

test('달력 셀 금액을 원·만·억 단위로 짧게 표시한다', () => {
  assert.equal(formatCalendarAmount(9900), '9,900');
  assert.equal(formatCalendarAmount(12000), '1.2만');
  assert.equal(formatCalendarAmount(125000), '12.5만');
  assert.equal(formatCalendarAmount(120000000), '1.2억');
});
