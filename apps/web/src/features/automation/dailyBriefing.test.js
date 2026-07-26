import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDailyBriefing,
  dailyBriefingNotifications,
  normalizeDailyBriefingSettings,
  readDailyBriefingSettings,
  saveDailyBriefingSettings
} from './dailyBriefing.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value))
  };
}

test('브리핑 설정은 잘못된 시각을 기본값으로 복구하고 사용자별로 저장한다', () => {
  const storage = memoryStorage();
  const eventTarget = { dispatchEvent() {} };
  const saved = saveDailyBriefingSettings({ username: 'owner-a' }, {
    morningEnabled: true,
    morningTime: '99:00',
    eveningEnabled: true,
    eveningTime: '22:15'
  }, { storage, eventTarget });
  assert.equal(saved.saved, true);
  assert.deepEqual(readDailyBriefingSettings({ username: 'owner-a' }, storage), {
    morningEnabled: true,
    morningTime: '07:30',
    eveningEnabled: true,
    eveningTime: '22:15'
  });
  assert.deepEqual(readDailyBriefingSettings({ username: 'owner-b' }, storage), normalizeDailyBriefingSettings());
});

test('아침과 저녁 브리핑은 실제 생활 기록을 요약한다', () => {
  const model = {
    today: '2026-07-16',
    expandedSchedules: [
      { id: 'one', date: '2026-07-16', done: false },
      { id: 'two', date: '2026-07-16', done: true }
    ],
    missedSchedules: [{ id: 'missed', done: false }],
    workouts: [{ date: '2026-07-16', durationMinutes: 30 }],
    dietEntries: [{ date: '2026-07-16', calories: 650 }],
    budgetEntries: [{ date: '2026-07-16', type: 'withdraw', amount: 4500 }],
    budget: { expense: 120000 }
  };
  const morning = buildDailyBriefing(model, { period: 'morning' });
  assert.equal(morning.period, 'morning');
  assert.match(morning.summary, /오늘 일정 1개/);
  assert.match(morning.summary, /놓친 일정 1개/);

  const evening = buildDailyBriefing(model, { period: 'evening' });
  assert.equal(evening.period, 'evening');
  assert.match(evening.summary, /일정 1\/2/);
  assert.equal(evening.items.find((item) => item.label === '운동').value, '30분');
  assert.equal(evening.items.find((item) => item.label === '오늘 지출').value, '4,500원');
});

test('켜진 브리핑만 미래 14일 범위에 예약한다', () => {
  const now = new Date(2026, 6, 16, 6, 0, 0, 0);
  const rows = dailyBriefingNotifications({
    morningEnabled: true,
    morningTime: '07:30',
    eveningEnabled: false,
    eveningTime: '21:00'
  }, { now, horizonDays: 14 });
  assert.equal(rows.length, 14);
  assert.equal(rows.every((row) => row.path === '/app?briefing=morning'), true);
  assert.equal(rows.every((row) => row.triggerAt > now.getTime()), true);
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
});
