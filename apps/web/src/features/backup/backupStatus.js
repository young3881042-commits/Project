import { orbitStorage } from '../../utils/orbitIndexedDbStorage.js';

export const BACKUP_STATUS_STORAGE_KEY = 'orbit.backup-status:v1';
export const BACKUP_REMINDER_DAYS = 14;

function ownerName(owner) {
  const username = typeof owner === 'string' ? owner : owner?.username;
  return String(username || 'guestuser').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'guestuser';
}

function storageKey(owner) {
  return BACKUP_STATUS_STORAGE_KEY + ':' + ownerName(owner);
}

export function normalizeBackupStatus(value = {}) {
  const parsed = value?.lastExportedAt ? new Date(value.lastExportedAt) : null;
  return {
    lastExportedAt: parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : ''
  };
}

export function readBackupStatus(owner, storage = orbitStorage) {
  try {
    return normalizeBackupStatus(JSON.parse(storage?.getItem(storageKey(owner)) || '{}'));
  } catch {
    return normalizeBackupStatus();
  }
}

export function markBackupCreated(owner, storage = orbitStorage, now = new Date()) {
  const status = normalizeBackupStatus({
    lastExportedAt: now instanceof Date && !Number.isNaN(now.getTime())
      ? now.toISOString()
      : new Date().toISOString()
  });
  try {
    storage?.setItem(storageKey(owner), JSON.stringify(status));
    return { saved: true, status };
  } catch {
    return { saved: false, status };
  }
}

export function backupRecordCount(data = {}) {
  return ['schedules', 'notes', 'budgetEntries', 'recurringPayments', 'trips']
    .reduce((total, key) => total + (Array.isArray(data?.[key]) ? data[key].length : 0), 0);
}

export function backupHealth(data, statusValue, now = new Date()) {
  const records = backupRecordCount(data);
  const status = normalizeBackupStatus(statusValue);
  if (!records) return { records, due: false, daysSince: null, lastExportedAt: status.lastExportedAt };
  if (!status.lastExportedAt) return { records, due: true, daysSince: null, lastExportedAt: '' };
  const elapsed = Math.max(0, now.getTime() - new Date(status.lastExportedAt).getTime());
  const daysSince = Math.floor(elapsed / 86400000);
  return {
    records,
    due: daysSince >= BACKUP_REMINDER_DAYS,
    daysSince,
    lastExportedAt: status.lastExportedAt
  };
}
