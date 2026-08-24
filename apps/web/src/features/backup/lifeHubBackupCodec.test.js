import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIFEHUB_BACKUP_FORMAT_VERSION,
  LifeHubBackupError,
  countLifeHubBackupData,
  createLifeHubBackup,
  parseLifeHubBackup,
  planLifeHubBackupImport,
  serializeLifeHubBackup
} from './lifeHubBackupCodec.js';

const CREATED_AT = '2026-07-16T12:34:56.000Z';

function emptyData(overrides = {}) {
  return {
    schedules: [],
    notes: [],
    workouts: [],
    dietEntries: [],
    budgetEntries: [],
    trips: [],
    recurringPayments: [],
    bodyProfile: null,
    ...overrides
  };
}

function backup(overrides = {}) {
  return createLifeHubBackup({
    owner: 'guestuser',
    appVersion: '0.5.1',
    createdAt: CREATED_AT,
    data: emptyData(),
    ...overrides
  });
}

function expectBackupError(action, code) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof LifeHubBackupError);
    assert.equal(error.code, code);
    return true;
  });
}

test('버전형 백업은 고정 메타데이터와 실제 collection counts를 만든다', () => {
  const source = emptyData({
    schedules: [{ id: 'schedule-1', title: '병원', date: '2026-07-20' }],
    notes: [{ id: 'note-1', title: '준비물' }],
    bodyProfile: { weightKg: '70' },
    dailyBriefingSettings: { morningEnabled: true, morningTime: '07:30' },
    workoutProfile: { weightKg: '999' },
    expandedSchedules: [{ id: 'derived-record' }]
  });
  const snapshot = backup({ data: source });

  assert.deepEqual(Object.keys(snapshot), [
    'product', 'formatVersion', 'createdAt', 'appVersion', 'owner', 'counts', 'data'
  ]);
  assert.equal(snapshot.formatVersion, LIFEHUB_BACKUP_FORMAT_VERSION);
  assert.equal(snapshot.product, 'LifeHub');
  assert.equal(snapshot.createdAt, CREATED_AT);
  assert.equal(snapshot.appVersion, '0.5.1');
  assert.equal(snapshot.owner, 'guestuser');
  assert.deepEqual(snapshot.counts, {
    schedules: 1,
    notes: 1,
    workouts: 0,
    dietEntries: 0,
    budgetEntries: 0,
    trips: 0,
    recurringPayments: 0
  });
  assert.equal('workoutProfile' in snapshot.data, false);
  assert.equal('expandedSchedules' in snapshot.data, false);
  assert.deepEqual(snapshot.data.bodyProfile, { weightKg: '70' });
  assert.deepEqual(snapshot.data.dailyBriefingSettings, { morningEnabled: true, morningTime: '07:30' });

  source.schedules[0].title = '원본 변경';
  assert.equal(snapshot.data.schedules[0].title, '병원');
});

test('serialize과 parse는 canonical snapshot을 검증하며 왕복한다', () => {
  const snapshot = backup({
    data: emptyData({ dietEntries: [{ id: 'diet-1', calories: 500 }] })
  });
  const serialized = serializeLifeHubBackup(snapshot);
  assert.deepEqual(parseLifeHubBackup(serialized), snapshot);
  assert.deepEqual(countLifeHubBackupData(snapshot.data), snapshot.counts);
  const compact = serializeLifeHubBackup(snapshot, 0);
  assert.equal(compact.includes('\n'), false);
  assert.deepEqual(parseLifeHubBackup(compact), snapshot);
});

test('현재 legacy exportedAt/account/workoutProfile snapshot을 canonical 형식으로 읽는다', () => {
  const legacy = {
    product: 'LifeHub',
    exportedAt: CREATED_AT,
    account: { username: 'legacy-owner', mode: 'member' },
    counts: {
      schedules: 1,
      notes: 0,
      workouts: 0,
      dietEntries: 0,
      budgetEntries: 0,
      trips: 0
    },
    data: {
      schedules: [{ id: 'legacy-schedule', title: '예전 일정' }],
      notes: [],
      workouts: [],
      dietEntries: [],
      bodyProfile: { weightKg: '68' },
      workoutProfile: { weightKg: '68' },
      budgetEntries: [],
      trips: []
    }
  };

  const parsed = parseLifeHubBackup(JSON.stringify(legacy));
  assert.equal(parsed.formatVersion, LIFEHUB_BACKUP_FORMAT_VERSION);
  assert.equal(parsed.createdAt, CREATED_AT);
  assert.equal(parsed.appVersion, 'legacy');
  assert.equal(parsed.owner, 'legacy-owner');
  assert.deepEqual(parsed.data.bodyProfile, { weightKg: '68' });
  assert.equal(parsed.data.dailyBriefingSettings, null);
  assert.equal('workoutProfile' in parsed.data, false);

  delete legacy.data.bodyProfile;
  assert.deepEqual(parseLifeHubBackup(legacy).data.bodyProfile, { weightKg: '68' });

  const current = emptyData({
    dailyBriefingSettings: { morningEnabled: true, morningTime: '07:00' }
  });
  assert.deepEqual(
    planLifeHubBackupImport(current, legacy, { mode: 'replace' }).data.dailyBriefingSettings,
    current.dailyBriefingSettings
  );
});

test('canonical v1 백업은 정기 결제 빈 목록을 보완해 v2로 승격한다', () => {
  const versionOne = backup({
    data: emptyData({ schedules: [{ id: 'old-schedule', title: '예전 일정' }] })
  });
  versionOne.formatVersion = 1;
  delete versionOne.data.recurringPayments;
  delete versionOne.counts.recurringPayments;

  const parsed = parseLifeHubBackup(versionOne);
  assert.equal(parsed.formatVersion, 2);
  assert.deepEqual(parsed.data.recurringPayments, []);
  assert.equal(parsed.counts.recurringPayments, 0);
  assert.equal(parsed.data.schedules[0].id, 'old-schedule');
});

test('미래 formatVersion은 다른 shape 검사보다 먼저 명확히 거부한다', () => {
  const future = {
    formatVersion: LIFEHUB_BACKUP_FORMAT_VERSION + 1,
    product: 'LifeHub',
    unexpected: true
  };
  expectBackupError(() => parseLifeHubBackup(future), 'UNSUPPORTED_FUTURE_VERSION');
});

test('잘못된 JSON과 canonical shape/count 오류를 거부한다', () => {
  expectBackupError(() => parseLifeHubBackup('{not-json'), 'INVALID_JSON');

  const missingOwner = backup();
  delete missingOwner.owner;
  expectBackupError(() => parseLifeHubBackup(missingOwner), 'INVALID_SHAPE');

  const wrongCount = backup({ data: emptyData({ notes: [{ id: 'note-1' }] }) });
  wrongCount.counts.notes = 0;
  expectBackupError(() => parseLifeHubBackup(wrongCount), 'COUNT_MISMATCH');

  const missingId = backup();
  missingId.data.notes = [{ title: 'ID 없음' }];
  missingId.counts.notes = 1;
  expectBackupError(() => parseLifeHubBackup(missingId), 'INVALID_SHAPE');
});

test('배열 안의 중복 ID를 거부한다', () => {
  expectBackupError(() => createLifeHubBackup({
    owner: 'guestuser',
    appVersion: '0.5.1',
    createdAt: CREATED_AT,
    data: emptyData({ notes: [{ id: 'same' }, { id: 'same' }] })
  }), 'DUPLICATE_ID');

  const sparseNotes = [];
  sparseNotes.length = 1;
  expectBackupError(() => backup({
    data: emptyData({ notes: sparseNotes })
  }), 'INVALID_SHAPE');
});

test('prototype pollution 키를 중첩 위치에서도 거부한다', () => {
  const malicious = serializeLifeHubBackup(backup()).replace(
    '"notes": []',
    '"notes": [{"id":"note-1","__proto__":{"polluted":true}}]'
  ).replace('"notes": 0', '"notes": 1');

  expectBackupError(() => parseLifeHubBackup(malicious), 'PROTOTYPE_POLLUTION_KEY');
  assert.equal({}.polluted, undefined);

  const constructorAttack = JSON.parse(serializeLifeHubBackup(backup()));
  constructorAttack.data.notes = [{ id: 'note-2', constructor: { prototype: { polluted: true } } }];
  constructorAttack.counts.notes = 1;
  expectBackupError(() => parseLifeHubBackup(constructorAttack), 'PROTOTYPE_POLLUTION_KEY');
  assert.equal({}.polluted, undefined);
});

test('Bridge 토큰과 대화 상태 필드는 백업 생성과 읽기에서 거부한다', () => {
  expectBackupError(() => backup({
    data: emptyData({
      notes: [{ id: 'note-1', bridgeToken: 'must-not-export' }]
    })
  }), 'SENSITIVE_STATE');

  const withThreads = JSON.parse(serializeLifeHubBackup(backup()));
  withThreads.data.threads = [{ id: 'thread-1', messages: [] }];
  expectBackupError(() => parseLifeHubBackup(withThreads), 'SENSITIVE_STATE');

  expectBackupError(() => backup({
    data: emptyData({
      notes: [{ id: 'note-2', 'bridge.access-token': 'must-not-export' }]
    })
  }), 'SENSITIVE_STATE');
  expectBackupError(() => backup({
    data: emptyData({
      notes: [{ id: 'note-3', conversationMessages: [] }]
    })
  }), 'SENSITIVE_STATE');
  expectBackupError(() => backup({
    data: emptyData({
      notes: [{ id: 'note-4', chatHistory: [] }]
    })
  }), 'SENSITIVE_STATE');
});

test('dailyBriefingSettings가 없는 canonical v1 백업은 현재 설정을 보존한다', () => {
  const canonicalWithoutSettings = backup();
  canonicalWithoutSettings.formatVersion = 1;
  delete canonicalWithoutSettings.data.recurringPayments;
  delete canonicalWithoutSettings.counts.recurringPayments;
  delete canonicalWithoutSettings.data.dailyBriefingSettings;
  const parsed = parseLifeHubBackup(canonicalWithoutSettings);
  assert.equal(parsed.data.dailyBriefingSettings, null);

  const current = emptyData({
    dailyBriefingSettings: { morningEnabled: true, morningTime: '07:00' }
  });
  for (const mode of ['merge', 'replace']) {
    const plan = planLifeHubBackupImport(current, canonicalWithoutSettings, { mode });
    assert.deepEqual(plan.data.dailyBriefingSettings, current.dailyBriefingSettings);
    assert.equal(plan.dailyBriefingSettings.overwritten, false);
  }
});

test('bodyProfile이 null인 백업은 merge와 replace 모두 현재 신체정보를 보존한다', () => {
  const current = emptyData({ bodyProfile: { weightKg: '72' } });
  const withoutProfile = backup({ data: emptyData({ bodyProfile: null }) });
  for (const mode of ['merge', 'replace']) {
    const plan = planLifeHubBackupImport(current, withoutProfile, { mode });
    assert.deepEqual(plan.data.bodyProfile, current.bodyProfile);
    assert.equal(plan.bodyProfile.overwritten, false);
  }
});

test('merge plan은 ID가 같은 incoming 레코드로 덮고 기존·신규 레코드를 보존한다', () => {
  const current = emptyData({
    schedules: [
      { id: 'schedule-1', title: '이전 제목' },
      { id: 'schedule-2', title: '기존 유지' }
    ],
    notes: [{ id: 'note-1', title: '기존 메모' }],
    bodyProfile: { weightKg: '65' },
    dailyBriefingSettings: { morningEnabled: false }
  });
  const incoming = backup({
    owner: 'backup-owner',
    data: emptyData({
      schedules: [
        { id: 'schedule-1', title: '가져온 최신 제목' },
        { id: 'schedule-3', title: '가져온 새 일정' }
      ],
      bodyProfile: { weightKg: '70' },
      dailyBriefingSettings: { morningEnabled: true, morningTime: '08:00' }
    })
  });

  const plan = planLifeHubBackupImport(current, incoming, { mode: 'merge' });
  assert.equal(plan.mode, 'merge');
  assert.equal(plan.incomingWins, true);
  assert.equal(plan.source.owner, 'backup-owner');
  assert.deepEqual(plan.data.schedules.map(({ id, title }) => ({ id, title })), [
    { id: 'schedule-1', title: '가져온 최신 제목' },
    { id: 'schedule-2', title: '기존 유지' },
    { id: 'schedule-3', title: '가져온 새 일정' }
  ]);
  assert.equal(plan.data.notes[0].title, '기존 메모');
  assert.deepEqual(plan.data.bodyProfile, { weightKg: '70' });
  assert.deepEqual(plan.data.dailyBriefingSettings, { morningEnabled: true, morningTime: '08:00' });
  assert.equal(plan.dailyBriefingSettings.overwritten, true);
  assert.deepEqual(plan.collections.schedules, {
    current: 2,
    incoming: 2,
    added: 1,
    overwritten: 1,
    retained: 1,
    removed: 0,
    result: 3
  });
  assert.equal(plan.counts.result.schedules, 3);

  plan.data.schedules[0].title = 'plan 변경';
  assert.equal(current.schedules[0].title, '이전 제목');
  assert.equal(incoming.data.schedules[0].title, '가져온 최신 제목');
});

test('replace plan은 incoming 데이터만 남기고 제거 개수를 계산한다', () => {
  const current = emptyData({
    notes: [{ id: 'note-old', title: '삭제될 메모' }],
    trips: [{ id: 'trip-shared', title: '예전 여행' }, { id: 'trip-old', title: '삭제될 여행' }]
  });
  const incoming = backup({
    data: emptyData({
      trips: [{ id: 'trip-shared', title: '복원된 여행' }, { id: 'trip-new', title: '새 여행' }]
    })
  });

  const plan = planLifeHubBackupImport(current, incoming, { mode: 'replace' });
  assert.deepEqual(plan.data.notes, []);
  assert.deepEqual(plan.data.trips.map((trip) => trip.id), ['trip-shared', 'trip-new']);
  assert.deepEqual(plan.collections.notes, {
    current: 1,
    incoming: 0,
    added: 0,
    overwritten: 0,
    retained: 0,
    removed: 1,
    result: 0
  });
  assert.equal(plan.collections.trips.overwritten, 1);
  assert.equal(plan.collections.trips.added, 1);
  assert.equal(plan.collections.trips.removed, 1);
});

test('지원하지 않는 import mode를 거부한다', () => {
  expectBackupError(
    () => planLifeHubBackupImport(emptyData(), backup(), { mode: 'append' }),
    'INVALID_IMPORT_MODE'
  );
});
