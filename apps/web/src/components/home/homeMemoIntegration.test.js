import assert from 'node:assert/strict';
import test from 'node:test';
import {
  memoDateKey,
  summarizeHomeCalendar
} from './homeMonthCalendarModel.js';

test('memo timestamps are grouped by their local calendar date', () => {
  assert.equal(memoDateKey({ createdAt: '2026-09-01T23:20:00+09:00' }), '2026-09-01');
  assert.equal(memoDateKey({ recordDate: '2026-08-31' }), '2026-08-31');
  assert.equal(memoDateKey({ createdAt: 'invalid' }), '');
});

test('home calendar includes memos without mixing other dates', () => {
  const summaries = summarizeHomeCalendar({
    dateKeys: ['2026-09-01', '2026-09-02'],
    schedules: [],
    budgetEntries: [],
    notes: [
      { id: 'note-1', title: '첫 메모', createdAt: '2026-09-01T08:00:00+09:00' },
      { id: 'note-2', title: '둘째 메모', createdAt: '2026-09-01T21:00:00+09:00' },
      { id: 'note-3', title: '다른 날', createdAt: '2026-09-02T09:00:00+09:00' },
      { id: 'note-3', title: '중복', createdAt: '2026-09-02T10:00:00+09:00' }
    ]
  });

  assert.equal(summaries['2026-09-01'].memoCount, 2);
  assert.deepEqual(summaries['2026-09-01'].memoItems.map((item) => item.id), ['note-2', 'note-1']);
  assert.equal(summaries['2026-09-02'].memoCount, 1);
});
