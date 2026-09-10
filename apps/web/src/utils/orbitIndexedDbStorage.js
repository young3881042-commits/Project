export const ORBIT_DATABASE_NAME = 'orbit-local-data';
export const ORBIT_DATABASE_VERSION = 1;
export const ORBIT_DATABASE_STORE = 'records';
export const ORBIT_STORAGE_STATUS_EVENT = 'orbit:storage-status';

const DATA_KEY_PREFIXES = Object.freeze([
  'codex-ai-note-blocks',
  'codex-ai-note-boards',
  'codex-personal-scheduler-items',
  'ai-assistant-budget-entries',
  'ai-assistant-daily-memo-draft',
  'ai-assistant-body-profile',
  'ai-assistant-workout-profile',
  'ai-assistant-workout-logs',
  'ai-assistant-diet-entries',
  'ai-assistant-lifehub-trips',
  'orbit-travel-workspace:v1',
  'ai-assistant-lifehub-local-owner',
  'lifehub-card-import-sources:v1',
  'lifehub-finance-category-settings:v1',
  'lifehub-recurring-payments:v1',
  'orbit.daily-briefing:v1',
  'orbit.finance-budget:v1',
  'orbit.backup-status:v1'
]);

let databasePromise = null;
let initialized = false;
let status = Object.freeze({
  mode: 'local',
  state: 'idle',
  restored: 0,
  migrated: 0,
  lastSyncedAt: ''
});
const pendingWrites = new Set();

function browserStorage() {
  return globalThis.localStorage || null;
}

function emitStatus(next) {
  status = Object.freeze({ ...status, ...next });
  globalThis.dispatchEvent?.(new CustomEvent(ORBIT_STORAGE_STATUS_EVENT, { detail: status }));
  return status;
}

export function isOrbitDataKey(key) {
  const value = String(key || '');
  return DATA_KEY_PREFIXES.some((prefix) => value === prefix || value.startsWith(prefix + ':'));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error || new Error('IndexedDB request failed')), { once: true });
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error || new Error('IndexedDB transaction aborted')), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error || new Error('IndexedDB transaction failed')), { once: true });
  });
}

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB unavailable'));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(ORBIT_DATABASE_NAME, ORBIT_DATABASE_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(ORBIT_DATABASE_STORE)) {
        database.createObjectStore(ORBIT_DATABASE_STORE, { keyPath: 'key' });
      }
    });
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => {
      databasePromise = null;
      reject(request.error || new Error('IndexedDB open failed'));
    }, { once: true });
    request.addEventListener('blocked', () => {
      databasePromise = null;
      reject(new Error('IndexedDB upgrade blocked'));
    }, { once: true });
  });
  return databasePromise;
}

async function readDatabaseRecords(database) {
  const transaction = database.transaction(ORBIT_DATABASE_STORE, 'readonly');
  const request = transaction.objectStore(ORBIT_DATABASE_STORE).getAll();
  const records = await requestResult(request);
  await transactionComplete(transaction);
  return Array.isArray(records) ? records : [];
}

async function writeDatabaseRecords(database, records) {
  if (!records.length) return;
  const transaction = database.transaction(ORBIT_DATABASE_STORE, 'readwrite');
  const store = transaction.objectStore(ORBIT_DATABASE_STORE);
  records.forEach((record) => store.put(record));
  await transactionComplete(transaction);
}

function trackedWrite(task) {
  const promise = Promise.resolve(task)
    .then(() => {
      emitStatus({ mode: 'indexeddb', state: 'ready', lastSyncedAt: new Date().toISOString() });
      return true;
    })
    .catch(() => {
      emitStatus({ mode: 'local', state: 'degraded' });
      return false;
    })
    .finally(() => pendingWrites.delete(promise));
  pendingWrites.add(promise);
  return promise;
}

function queueRecord(key, value, deleted) {
  if (!initialized || !isOrbitDataKey(key)) return Promise.resolve(false);
  return trackedWrite(
    openDatabase().then((database) => writeDatabaseRecords(database, [{
      key: String(key),
      value: deleted ? '' : String(value),
      deleted: Boolean(deleted),
      updatedAt: new Date().toISOString()
    }]))
  );
}

export function queueOrbitIndexedDbWrite(key, value) {
  return queueRecord(key, value, false);
}

export function queueOrbitIndexedDbRemove(key) {
  return queueRecord(key, '', true);
}

export const orbitStorage = {
  getItem(key) {
    return browserStorage()?.getItem(String(key)) ?? null;
  },
  setItem(key, value) {
    const storage = browserStorage();
    if (!storage) throw new Error('Local storage unavailable');
    storage.setItem(String(key), String(value));
    queueOrbitIndexedDbWrite(key, value);
  },
  removeItem(key) {
    browserStorage()?.removeItem(String(key));
    queueOrbitIndexedDbRemove(key);
  }
};

function localOrbitEntries(storage) {
  const entries = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!isOrbitDataKey(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) entries.push([key, value]);
  }
  return entries;
}

export async function initializeOrbitIndexedDbStorage() {
  const storage = browserStorage();
  if (initialized) return status;
  if (!storage || !globalThis.indexedDB) {
    initialized = true;
    return emitStatus({ mode: 'local', state: 'unsupported' });
  }

  emitStatus({ state: 'migrating' });
  try {
    const database = await openDatabase();
    const databaseRecords = await readDatabaseRecords(database);
    const databaseByKey = new Map(databaseRecords.map((record) => [record.key, record]));
    const localEntries = localOrbitEntries(storage);
    const localKeys = new Set(localEntries.map(([key]) => key));
    let restored = 0;

    databaseRecords.forEach((record) => {
      if (!isOrbitDataKey(record.key) || localKeys.has(record.key)) return;
      if (record.deleted) storage.removeItem(record.key);
      else {
        storage.setItem(record.key, record.value);
        restored += 1;
      }
    });

    const now = new Date().toISOString();
    const recordsToMigrate = localEntries.map(([key, value]) => ({
      key,
      value,
      deleted: false,
      updatedAt: databaseByKey.get(key)?.value === value
        ? databaseByKey.get(key)?.updatedAt || now
        : now
    }));
    await writeDatabaseRecords(database, recordsToMigrate);
    initialized = true;
    return emitStatus({
      mode: 'indexeddb',
      state: 'ready',
      restored,
      migrated: recordsToMigrate.length,
      lastSyncedAt: now
    });
  } catch {
    initialized = true;
    return emitStatus({ mode: 'local', state: 'degraded' });
  }
}

export function getOrbitStorageStatus() {
  return status;
}

export async function flushOrbitIndexedDbStorage() {
  await Promise.all([...pendingWrites]);
  return status;
}
