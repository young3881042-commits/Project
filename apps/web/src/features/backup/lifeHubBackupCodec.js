export const LIFEHUB_BACKUP_FORMAT_VERSION = 2;
export const LIFEHUB_BACKUP_PRODUCT = 'LifeHub';
const LIFEHUB_V1_BACKUP_COLLECTIONS = Object.freeze([
  'schedules',
  'notes',
  'workouts',
  'dietEntries',
  'budgetEntries',
  'trips'
]);
export const LIFEHUB_BACKUP_COLLECTIONS = Object.freeze([
  ...LIFEHUB_V1_BACKUP_COLLECTIONS,
  'recurringPayments'
]);

const PROFILE_KEY = 'bodyProfile';
const BRIEFING_SETTINGS_KEY = 'dailyBriefingSettings';
const LEGACY_PROFILE_KEY = 'workoutProfile';
const MAX_OBJECT_DEPTH = 64;
const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SENSITIVE_STATE_KEYS = new Set([
  'admintoken',
  'approval',
  'approvals',
  'authorization',
  'bridge',
  'bridgeauth',
  'bridgeorigin',
  'bridgestate',
  'bridgetoken',
  'bridgetokens',
  'chathistory',
  'chatmessages',
  'chatstate',
  'chatthreads',
  'conversation',
  'conversations',
  'conversationhistory',
  'conversationmessages',
  'conversationstate',
  'devicetoken',
  'devicetokens',
  'events',
  'messages',
  'messagestate',
  'ownedeviceid',
  'paircodes',
  'pairingtoken',
  'pairrequests',
  'securevalue',
  'securevalues',
  'sdkthreadid',
  'threads',
  'threadstate',
  'token',
  'tokenhash',
  'tokenkey',
  'tokens',
  'tokenstored'
]);

const CANONICAL_ROOT_KEYS = new Set([
  'product',
  'formatVersion',
  'createdAt',
  'appVersion',
  'owner',
  'counts',
  'data'
]);
const LEGACY_ROOT_KEYS = new Set(['product', 'exportedAt', 'account', 'counts', 'data']);
const LEGACY_DATA_KEYS = new Set([...LIFEHUB_V1_BACKUP_COLLECTIONS, PROFILE_KEY, BRIEFING_SETTINGS_KEY, LEGACY_PROFILE_KEY]);

export class LifeHubBackupError extends Error {
  constructor(code, message, path = '$', cause = undefined) {
    super(message);
    this.name = 'LifeHubBackupError';
    this.code = code;
    this.path = path;
    if (cause !== undefined) this.cause = cause;
  }
}

function fail(code, message, path = '$', cause = undefined) {
  throw new LifeHubBackupError(code, message, path, cause);
}

function own(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function childPath(path, key) {
  return /^[$A-Z_a-z][$\w]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}

function normalizedSecurityKey(key) {
  return String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isSensitiveStateKey(key) {
  const normalized = normalizedSecurityKey(key);
  if (SENSITIVE_STATE_KEYS.has(normalized)) return true;
  if (normalized.includes('bridge')
      && ['token', 'auth', 'credential', 'secret', 'apikey', 'password']
        .some((part) => normalized.includes(part))) {
    return true;
  }
  return (normalized.includes('conversation') || normalized.includes('chat'))
    && ['state', 'message', 'thread', 'event', 'history'].some((part) => normalized.includes(part));
}

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requirePlainRecord(value, path) {
  if (!isPlainRecord(value)) fail('INVALID_SHAPE', `${path}는 객체여야 합니다.`, path);
  return value;
}

function assertSafeJson(value, path = '$', ancestors = new Set(), depth = 0) {
  if (depth > MAX_OBJECT_DEPTH) {
    fail('INVALID_SHAPE', `백업 데이터가 허용 깊이 ${MAX_OBJECT_DEPTH}를 넘었습니다.`, path);
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('INVALID_SHAPE', `${path}에 유한하지 않은 숫자가 있습니다.`, path);
    return;
  }
  if (typeof value !== 'object') {
    fail('INVALID_SHAPE', `${path}에 JSON으로 저장할 수 없는 값이 있습니다.`, path);
  }
  if (ancestors.has(value)) fail('INVALID_SHAPE', `${path}에 순환 참조가 있습니다.`, path);
  ancestors.add(value);

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSafeJson(entry, `${path}[${index}]`, ancestors, depth + 1));
    ancestors.delete(value);
    return;
  }

  requirePlainRecord(value, path);
  for (const key of Object.keys(value)) {
    const nextPath = childPath(path, key);
    if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
      fail('PROTOTYPE_POLLUTION_KEY', `${nextPath} 키는 백업에 사용할 수 없습니다.`, nextPath);
    }
    if (isSensitiveStateKey(key)) {
      fail('SENSITIVE_STATE', `${nextPath}에 Bridge 토큰 또는 대화 상태로 보이는 필드가 있습니다.`, nextPath);
    }
    assertSafeJson(value[key], nextPath, ancestors, depth + 1);
  }
  ancestors.delete(value);
}

function cloneSafeJson(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(cloneSafeJson);
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneSafeJson(entry)]));
}

function assertAllowedKeys(record, allowed, required, path) {
  requirePlainRecord(record, path);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail('INVALID_SHAPE', `${childPath(path, key)}는 지원하지 않는 필드입니다.`, childPath(path, key));
  }
  for (const key of required) {
    if (!own(record, key)) fail('INVALID_SHAPE', `${childPath(path, key)} 필드가 필요합니다.`, childPath(path, key));
  }
}

function normalizeRequiredString(value, path, maximum = 128) {
  if (typeof value !== 'string') fail('INVALID_SHAPE', `${path}는 문자열이어야 합니다.`, path);
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    fail('INVALID_SHAPE', `${path}는 1~${maximum}자여야 합니다.`, path);
  }
  return normalized;
}

function normalizeTimestamp(value, path) {
  if (typeof value !== 'string' || !value.trim()) {
    fail('INVALID_SHAPE', `${path}는 ISO 날짜 문자열이어야 합니다.`, path);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) fail('INVALID_SHAPE', `${path} 날짜를 해석할 수 없습니다.`, path);
  return new Date(timestamp).toISOString();
}

function normalizeCollection(value, path) {
  if (!Array.isArray(value)) fail('INVALID_SHAPE', `${path}는 배열이어야 합니다.`, path);
  const ids = new Set();
  return Array.from(value, (entry, index) => {
    const entryPath = `${path}[${index}]`;
    requirePlainRecord(entry, entryPath);
    const id = normalizeRequiredString(entry.id, `${entryPath}.id`, 256);
    if (ids.has(id)) fail('DUPLICATE_ID', `${entryPath}.id가 같은 배열 안에서 중복되었습니다.`, `${entryPath}.id`);
    ids.add(id);
    return { ...cloneSafeJson(entry), id };
  });
}

function normalizeBodyProfile(value, path) {
  if (value === null) return null;
  requirePlainRecord(value, path);
  return cloneSafeJson(value);
}

function normalizeBriefingSettings(value, path) {
  if (value === null || value === undefined) return null;
  requirePlainRecord(value, path);
  return cloneSafeJson(value);
}

function normalizedCounts(data, collectionKeys = LIFEHUB_BACKUP_COLLECTIONS) {
  return Object.fromEntries(collectionKeys.map((key) => [key, data[key].length]));
}

function normalizeDataForCreation(input) {
  requirePlainRecord(input, '$.data');
  assertSafeJson(input, '$.data');
  const data = {};
  for (const key of LIFEHUB_BACKUP_COLLECTIONS) {
    data[key] = normalizeCollection(input[key] ?? [], `$.data.${key}`);
  }
  const profile = own(input, PROFILE_KEY)
    ? input[PROFILE_KEY]
    : own(input, LEGACY_PROFILE_KEY)
      ? input[LEGACY_PROFILE_KEY]
      : null;
  data[PROFILE_KEY] = normalizeBodyProfile(profile, `$.data.${PROFILE_KEY}`);
  data[BRIEFING_SETTINGS_KEY] = normalizeBriefingSettings(
    input[BRIEFING_SETTINGS_KEY],
    `$.data.${BRIEFING_SETTINGS_KEY}`
  );
  return data;
}

function normalizeSnapshotData(input, {
  legacy = false,
  collectionKeys = LIFEHUB_BACKUP_COLLECTIONS
} = {}) {
  const allowed = legacy
    ? LEGACY_DATA_KEYS
    : new Set([...collectionKeys, PROFILE_KEY, BRIEFING_SETTINGS_KEY]);
  const required = [...collectionKeys];
  if (!legacy) required.push(PROFILE_KEY);
  assertAllowedKeys(input, allowed, required, '$.data');
  if (legacy && !own(input, PROFILE_KEY) && !own(input, LEGACY_PROFILE_KEY)) {
    fail('INVALID_SHAPE', '$.data.bodyProfile 또는 $.data.workoutProfile 필드가 필요합니다.', '$.data');
  }

  const data = {};
  for (const key of LIFEHUB_BACKUP_COLLECTIONS) {
    data[key] = collectionKeys.includes(key)
      ? normalizeCollection(input[key], `$.data.${key}`)
      : [];
  }
  const profile = own(input, PROFILE_KEY) ? input[PROFILE_KEY] : input[LEGACY_PROFILE_KEY];
  data[PROFILE_KEY] = normalizeBodyProfile(profile, `$.data.${PROFILE_KEY}`);
  data[BRIEFING_SETTINGS_KEY] = normalizeBriefingSettings(
    input[BRIEFING_SETTINGS_KEY],
    `$.data.${BRIEFING_SETTINGS_KEY}`
  );
  return data;
}

function validateCounts(counts, data, collectionKeys = LIFEHUB_BACKUP_COLLECTIONS) {
  assertAllowedKeys(counts, new Set(collectionKeys), collectionKeys, '$.counts');
  const actual = normalizedCounts(data, collectionKeys);
  for (const key of collectionKeys) {
    const value = counts[key];
    if (!Number.isSafeInteger(value) || value < 0) {
      fail('INVALID_SHAPE', `$.counts.${key}는 0 이상의 정수여야 합니다.`, `$.counts.${key}`);
    }
    if (value !== actual[key]) {
      fail('COUNT_MISMATCH', `$.counts.${key}와 실제 데이터 개수가 일치하지 않습니다.`, `$.counts.${key}`);
    }
  }
}

function validateProduct(value) {
  if (value !== LIFEHUB_BACKUP_PRODUCT) {
    fail('INVALID_PRODUCT', 'Orbit LifeHub 백업 파일이 아닙니다.', '$.product');
  }
}

export function createLifeHubBackup({ owner, appVersion, data, createdAt = new Date().toISOString() }) {
  const normalizedData = normalizeDataForCreation(data);
  return {
    product: LIFEHUB_BACKUP_PRODUCT,
    formatVersion: LIFEHUB_BACKUP_FORMAT_VERSION,
    createdAt: normalizeTimestamp(createdAt, '$.createdAt'),
    appVersion: normalizeRequiredString(appVersion, '$.appVersion'),
    owner: normalizeRequiredString(owner, '$.owner'),
    counts: normalizedCounts(normalizedData),
    data: normalizedData
  };
}

function parseCanonicalSnapshot(root) {
  const version = root.formatVersion;
  if (!Number.isSafeInteger(version) || version < 1) {
    fail('UNSUPPORTED_VERSION', '백업 formatVersion이 올바르지 않습니다.', '$.formatVersion');
  }
  if (version > LIFEHUB_BACKUP_FORMAT_VERSION) {
    fail(
      'UNSUPPORTED_FUTURE_VERSION',
      `이 앱보다 새로운 백업 형식(${version})은 복원할 수 없습니다.`,
      '$.formatVersion'
    );
  }
  assertAllowedKeys(root, CANONICAL_ROOT_KEYS, CANONICAL_ROOT_KEYS, '$');
  validateProduct(root.product);
  const collectionKeys = version === 1 ? LIFEHUB_V1_BACKUP_COLLECTIONS : LIFEHUB_BACKUP_COLLECTIONS;
  const data = normalizeSnapshotData(root.data, { collectionKeys });
  validateCounts(root.counts, data, collectionKeys);
  return createLifeHubBackup({
    owner: root.owner,
    appVersion: root.appVersion,
    createdAt: root.createdAt,
    data
  });
}

function parseLegacySnapshot(root) {
  assertAllowedKeys(root, LEGACY_ROOT_KEYS, LEGACY_ROOT_KEYS, '$');
  validateProduct(root.product);
  assertAllowedKeys(root.account, new Set(['username', 'mode']), ['username', 'mode'], '$.account');
  normalizeRequiredString(root.account.mode, '$.account.mode', 32);
  const data = normalizeSnapshotData(root.data, {
    legacy: true,
    collectionKeys: LIFEHUB_V1_BACKUP_COLLECTIONS
  });
  validateCounts(root.counts, data, LIFEHUB_V1_BACKUP_COLLECTIONS);
  return createLifeHubBackup({
    owner: root.account.username,
    appVersion: 'legacy',
    createdAt: root.exportedAt,
    data
  });
}

export function parseLifeHubBackup(input) {
  let root = input;
  if (typeof input === 'string') {
    try {
      root = JSON.parse(input);
    } catch (error) {
      fail('INVALID_JSON', '백업 JSON을 해석할 수 없습니다.', '$', error);
    }
  }
  assertSafeJson(root);
  requirePlainRecord(root, '$');
  return own(root, 'formatVersion') ? parseCanonicalSnapshot(root) : parseLegacySnapshot(root);
}

export function serializeLifeHubBackup(snapshot, space = 2) {
  const normalized = parseLifeHubBackup(snapshot);
  const indentation = Number.isInteger(space) ? Math.max(0, Math.min(10, space)) : 2;
  return JSON.stringify(normalized, null, indentation);
}

export function countLifeHubBackupData(data) {
  return normalizedCounts(normalizeDataForCreation(data));
}

function collectionImportSummary(current, incoming, mode) {
  const currentIds = new Set(current.map((entry) => entry.id));
  const incomingIds = new Set(incoming.map((entry) => entry.id));
  const common = [...incomingIds].filter((id) => currentIds.has(id)).length;
  return {
    current: current.length,
    incoming: incoming.length,
    added: [...incomingIds].filter((id) => !currentIds.has(id)).length,
    overwritten: common,
    retained: mode === 'merge' ? [...currentIds].filter((id) => !incomingIds.has(id)).length : 0,
    removed: mode === 'replace' ? [...currentIds].filter((id) => !incomingIds.has(id)).length : 0,
    result: mode === 'replace' ? incoming.length : currentIds.size + incomingIds.size - common
  };
}

function mergeCollectionById(current, incoming) {
  const result = current.map(cloneSafeJson);
  const positions = new Map(result.map((entry, index) => [entry.id, index]));
  for (const entry of incoming) {
    const next = cloneSafeJson(entry);
    if (positions.has(entry.id)) {
      result[positions.get(entry.id)] = next;
    } else {
      positions.set(entry.id, result.length);
      result.push(next);
    }
  }
  return result;
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function planLifeHubBackupImport(currentData, backupInput, { mode = 'merge' } = {}) {
  if (mode !== 'merge' && mode !== 'replace') {
    fail('INVALID_IMPORT_MODE', '가져오기 방식은 merge 또는 replace여야 합니다.', '$.mode');
  }
  const current = normalizeDataForCreation(currentData);
  const snapshot = parseLifeHubBackup(backupInput);
  const result = {};
  const collections = {};

  for (const key of LIFEHUB_BACKUP_COLLECTIONS) {
    collections[key] = collectionImportSummary(current[key], snapshot.data[key], mode);
    result[key] = mode === 'replace'
      ? snapshot.data[key].map(cloneSafeJson)
      : mergeCollectionById(current[key], snapshot.data[key]);
  }
  result[PROFILE_KEY] = cloneSafeJson(snapshot.data[PROFILE_KEY] ?? current[PROFILE_KEY]);
  result[BRIEFING_SETTINGS_KEY] = cloneSafeJson(
    snapshot.data[BRIEFING_SETTINGS_KEY] ?? current[BRIEFING_SETTINGS_KEY]
  );

  return {
    mode,
    incomingWins: true,
    source: {
      formatVersion: snapshot.formatVersion,
      createdAt: snapshot.createdAt,
      appVersion: snapshot.appVersion,
      owner: snapshot.owner
    },
    counts: {
      current: normalizedCounts(current),
      incoming: { ...snapshot.counts },
      result: normalizedCounts(result)
    },
    collections,
    bodyProfile: {
      overwritten: !jsonEqual(current[PROFILE_KEY], result[PROFILE_KEY])
    },
    dailyBriefingSettings: {
      overwritten: !jsonEqual(current[BRIEFING_SETTINGS_KEY], result[BRIEFING_SETTINGS_KEY])
    },
    data: result
  };
}
