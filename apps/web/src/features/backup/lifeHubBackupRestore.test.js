import assert from 'node:assert/strict';
import test from 'node:test';
import { createLifeHubBackup, planLifeHubBackupImport } from './lifeHubBackupCodec.js';
import { applyLifeHubBackupPlan, prepareLifeHubRestoreData } from './lifeHubBackupRestore.js';

const KEYS = ['schedules', 'notes', 'workouts', 'dietEntries', 'budgetEntries', 'trips'];

function data(prefix = 'old') {
  return {
    ...Object.fromEntries(KEYS.map((key) => [key, [{ id: `${prefix}-${key}` }]])),
    bodyProfile: { weightKg: prefix },
    dailyBriefingSettings: { morningEnabled: prefix === 'new' }
  };
}

const normalizers = Object.fromEntries(KEYS.map((key) => [key, (item) => ({ ...item })]));
normalizers.dailyBriefingSettings = (settings) => ({ ...settings });
const validateBodyProfile = (profile) => ({
  valid: Boolean(profile?.weightKg),
  profile,
  message: '잘못된 신체정보'
});

test('복원 전 모든 collection과 신체정보를 정규화한다', () => {
  const incoming = data('new');
  const restored = prepareLifeHubRestoreData({ data: incoming }, {
    fallbackBodyProfile: { weightKg: 'fallback' },
    fallbackDailyBriefingSettings: { morningEnabled: false },
    normalizers,
    validateBodyProfile
  });
  assert.deepEqual(restored, incoming);

  assert.throws(() => prepareLifeHubRestoreData({
    data: { ...incoming, dietEntries: [{ id: '' }] }
  }, {
    fallbackBodyProfile: incoming.bodyProfile,
    fallbackDailyBriefingSettings: incoming.dailyBriefingSettings,
    normalizers,
    validateBodyProfile
  }), /식단/);
});

test('모든 저장이 성공하면 복원 데이터를 확정한다', () => {
  const current = data('old');
  const incoming = data('new');
  const stored = {};
  let profile = null;
  let refreshes = 0;
  const result = applyLifeHubBackupPlan({ data: incoming }, {
    readCurrent: () => current,
    normalizers,
    validateBodyProfile,
    writers: Object.fromEntries([...KEYS, 'bodyProfile', 'dailyBriefingSettings'].map((key) => [key, (value) => {
      stored[key] = value;
      return { saved: true };
    }])),
    onProfile: (value) => { profile = value; },
    onRefresh: () => { refreshes += 1; }
  });
  assert.equal(result.saved, true);
  assert.deepEqual(stored, incoming);
  assert.deepEqual(profile, incoming.bodyProfile);
  assert.equal(refreshes, 1);
});

test('apply 직전 readCurrent 기준으로 snapshot을 다시 merge해 외부 변경을 보존한다', () => {
  const previewCurrent = data('old');
  const incoming = data('new');
  const snapshot = createLifeHubBackup({
    owner: 'guestuser',
    appVersion: '0.0.1',
    createdAt: '2026-07-16T12:34:56.000Z',
    data: incoming
  });
  const previewPlan = planLifeHubBackupImport(previewCurrent, snapshot, { mode: 'merge' });
  const latest = data('old');
  latest.notes = [...latest.notes, { id: 'external-note' }];
  const stored = {};
  const result = applyLifeHubBackupPlan({ ...previewPlan, backupSnapshot: snapshot }, {
    readCurrent: () => latest,
    normalizers,
    validateBodyProfile,
    writers: Object.fromEntries([...KEYS, 'bodyProfile', 'dailyBriefingSettings'].map((key) => [key, (value) => {
      stored[key] = value;
      return { saved: true };
    }]))
  });
  assert.equal(result.saved, true);
  assert.deepEqual(stored.notes.map((note) => note.id), ['old-notes', 'external-note', 'new-notes']);
  assert.equal(result.plan.counts.result.notes, 3);
});

test('UI 알림 callback 예외는 이미 완료된 저장을 rollback하지 않는다', () => {
  const current = data('old');
  const incoming = data('new');
  const stored = { ...current };
  let writes = 0;
  const result = applyLifeHubBackupPlan({ data: incoming }, {
    readCurrent: () => current,
    normalizers,
    validateBodyProfile,
    writers: Object.fromEntries([...KEYS, 'bodyProfile', 'dailyBriefingSettings'].map((key) => [key, (value) => {
      writes += 1;
      stored[key] = value;
      return { saved: true };
    }])),
    onProfile() { throw new Error('render failed'); },
    onRefresh() { throw new Error('render failed'); }
  });
  assert.equal(result.saved, true);
  assert.equal(writes, KEYS.length + 2);
  assert.deepEqual(stored, incoming);
});

test('writer가 빠지면 쓰기와 UI 상태 변경 전에 중단한다', () => {
  const current = data('old');
  const incoming = data('new');
  let writes = 0;
  let profileChanges = 0;
  let refreshes = 0;
  const writers = Object.fromEntries([...KEYS, 'bodyProfile'].map((key) => [key, () => {
    writes += 1;
    return { saved: true };
  }]));
  const result = applyLifeHubBackupPlan({ data: incoming }, {
    readCurrent: () => current,
    normalizers,
    validateBodyProfile,
    writers,
    onProfile: () => { profileChanges += 1; },
    onRefresh: () => { refreshes += 1; }
  });
  assert.equal(result.saved, false);
  assert.equal(result.rolledBack, true);
  assert.equal(writes, 0);
  assert.equal(profileChanges, 0);
  assert.equal(refreshes, 0);
});

test('중간 저장이 실패하면 모든 기존 collection을 다시 쓰고 실패를 반환한다', () => {
  const current = data('old');
  const incoming = data('new');
  const stored = { ...current };
  let failOnce = true;
  let profileChanges = 0;
  let refreshes = 0;
  const writers = Object.fromEntries([...KEYS, 'bodyProfile', 'dailyBriefingSettings'].map((key) => [key, (value) => {
    if (key === 'dietEntries' && failOnce) {
      failOnce = false;
      return { saved: false };
    }
    stored[key] = value;
    return { saved: true };
  }]));
  const result = applyLifeHubBackupPlan({ data: incoming }, {
    readCurrent: () => current,
    normalizers,
    validateBodyProfile,
    writers,
    onProfile: () => { profileChanges += 1; },
    onRefresh: () => { refreshes += 1; }
  });
  assert.equal(result.saved, false);
  assert.equal(result.rolledBack, true);
  assert.deepEqual(stored, current);
  assert.match(result.message, /기존 데이터는 그대로 유지/);
  assert.equal(profileChanges, 0);
  assert.equal(refreshes, 1);
});

test('rollback writer도 실패하면 원자성 실패를 명확히 반환한다', () => {
  const current = data('old');
  const incoming = data('new');
  const stored = { ...current };
  let dietWrites = 0;
  const writers = Object.fromEntries([...KEYS, 'bodyProfile', 'dailyBriefingSettings'].map((key) => [key, (value) => {
    if (key === 'dietEntries') {
      dietWrites += 1;
      if (dietWrites === 1) stored[key] = value;
      return { saved: false };
    }
    stored[key] = value;
    return { saved: true };
  }]));
  const result = applyLifeHubBackupPlan({ data: incoming }, {
    readCurrent: () => current,
    normalizers,
    validateBodyProfile,
    writers
  });
  assert.equal(result.saved, false);
  assert.equal(result.rolledBack, false);
  assert.deepEqual(stored.dietEntries, incoming.dietEntries);
  assert.match(result.message, /자동 되돌리기에 실패/);
});
