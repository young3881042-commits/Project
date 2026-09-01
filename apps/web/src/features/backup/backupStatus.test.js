import assert from 'node:assert/strict';
import test from 'node:test';
import {
  backupHealth,
  markBackupCreated,
  readBackupStatus
} from './backupStatus.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
}

test('backup status is scoped per owner', () => {
  const storage = memoryStorage();
  markBackupCreated('guestuser', storage, new Date('2026-09-01T00:00:00.000Z'));
  assert.equal(readBackupStatus('guestuser', storage).lastExportedAt, '2026-09-01T00:00:00.000Z');
  assert.equal(readBackupStatus('another', storage).lastExportedAt, '');
});

test('records without a recent export produce a backup reminder', () => {
  const data = { schedules: [{ id: 'one' }], notes: [], budgetEntries: [] };
  assert.equal(backupHealth(data, {}, new Date('2026-09-20T00:00:00.000Z')).due, true);
  const health = backupHealth(data, { lastExportedAt: '2026-09-01T00:00:00.000Z' }, new Date('2026-09-20T00:00:00.000Z'));
  assert.equal(health.daysSince, 19);
  assert.equal(health.due, true);
});
