import { hasNativeBridgeApi, nativeBridgeCapabilities } from './nativeBridgeTransport.js';

const PCS_KEY = 'lifehub.bridge.pcs:v1';
const LAST_PC_KEY = 'lifehub.bridge.lastPc:v1';
const LAST_PROJECT_KEY = 'lifehub.bridge.lastProject:v1';
const PROJECT_CACHE_KEY = 'lifehub.bridge.projects:v1';
const THREAD_CACHE_KEY = 'lifehub.bridge.threads:v1';
const PERMISSION_KEY = 'lifehub.bridge.permissions:v1';
const TOKEN_PREFIX = 'lifehub.bridge.token:';

const volatileTokens = new Map();

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function localStorageAvailable() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function readLocal(key, fallback = null) {
  if (!localStorageAvailable()) return fallback;
  return parseJson(window.localStorage.getItem(key), fallback);
}

function writeLocal(key, value) {
  if (!localStorageAvailable()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeLocal(key) {
  if (!localStorageAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Metadata cleanup is best effort. Tokens never use this storage path.
  }
}

function cleanPermissions(value = {}) {
  const permissions = Array.isArray(value) ? new Set(value) : null;
  return {
    chat: permissions ? permissions.has('chat') : value.chat !== false,
    projectRead: permissions ? permissions.has('project:read') : Boolean(value.projectRead),
    fileWrite: permissions ? permissions.has('file:write') : Boolean(value.fileWrite),
    commandRun: permissions ? permissions.has('command:execute') : Boolean(value.commandRun),
    buildRun: permissions ? permissions.has('build:execute') : Boolean(value.buildRun),
    git: permissions ? permissions.has('git') : Boolean(value.git)
  };
}

function cleanPc(value = {}) {
  const id = String(value.id || value.pcId || value.deviceId || '').trim();
  const baseUrl = String(value.baseUrl || value.url || '').trim();
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(id) || !baseUrl) return null;
  return {
    id,
    baseUrl,
    name: String(value.name || value.pcName || value.hostName || '내 PC').trim() || '내 PC',
    deviceName: String(value.deviceName || '').trim(),
    permissions: cleanPermissions(value.permissions),
    pairedAt: value.pairedAt || new Date().toISOString(),
    lastConnectedAt: value.lastConnectedAt || null
  };
}

function cleanPendingScheduleRequest(value) {
  if (!value || typeof value !== 'object' || value.action?.status !== 'need-more') return null;
  const missing = ['title', 'meridiem'].includes(value.action.missing) ? value.action.missing : '';
  const draft = value.action.draft && typeof value.action.draft === 'object' ? value.action.draft : {};
  if (!missing || !/^20\d{2}-\d{2}-\d{2}$/.test(String(draft.date || ''))) return null;
  return {
    requestId: String(value.requestId || '').slice(0, 128),
    action: {
      status: 'need-more',
      missing,
      question: String(value.action.question || '').slice(0, 300),
      draft: {
        title: String(draft.title || '').slice(0, 80),
        date: String(draft.date),
        time: /^\d{2}:\d{2}$/.test(String(draft.time || '')) ? String(draft.time) : '',
        category: String(draft.category || 'etc').slice(0, 40),
        ...(Number.isInteger(draft.hour) ? { hour: draft.hour } : {}),
        ...(Number.isInteger(draft.minute) ? { minute: draft.minute } : {})
      }
    }
  };
}

function cleanLifeRecordDate(value) {
  const text = String(value || '');
  const match = text.match(/^(20\d{2})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
  return date.getFullYear() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3])
    ? text
    : '';
}

function cleanPendingLifeRecordDraft(kind, value) {
  const draft = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  if (kind === 'memo') {
    const body = String(draft.body || '').trim().slice(0, 300);
    if (!body) return null;
    return {
      title: String(draft.title || '').trim().slice(0, 80),
      body,
      tags: (Array.isArray(draft.tags) ? draft.tags : [])
        .map((tag) => String(tag || '').trim().slice(0, 30))
        .filter(Boolean)
        .slice(0, 6)
    };
  }

  const date = cleanLifeRecordDate(draft.date);
  if (!date) return null;
  if (kind === 'expense' || kind === 'income') {
    const amount = Number(draft.amount);
    const memo = String(draft.memo || '').trim().slice(0, 80);
    const expectedType = kind === 'income' ? 'deposit' : 'withdraw';
    if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000_000 || !memo || draft.type !== expectedType) return null;
    return {
      type: expectedType,
      amount,
      category: String(draft.category || (kind === 'income' ? '수입' : '기타')).trim().slice(0, 40),
      memo,
      date
    };
  }
  if (kind === 'workout') {
    const templateId = ['cardio', 'upper', 'lower', 'other'].includes(draft.templateId) ? draft.templateId : '';
    const workoutKind = draft.workoutKind === 'cardio' || draft.workoutKind === 'strength' ? draft.workoutKind : '';
    const title = String(draft.title || '').trim().slice(0, 80);
    const activity = String(draft.activity || '').trim().slice(0, 80);
    const activityId = String(draft.activityId || '').trim().slice(0, 60);
    const durationMinutes = Number(draft.durationMinutes);
    if (
      !templateId
      || !workoutKind
      || !title
      || !activity
      || !Number.isInteger(durationMinutes)
      || durationMinutes < 1
      || durationMinutes > 600
      || (templateId === 'cardio') !== (workoutKind === 'cardio')
      || (activityId && !/^[a-z0-9-]+$/.test(activityId))
    ) return null;
    return { templateId, workoutKind, title, activity, activityId, durationMinutes, date };
  }
  if (kind === 'diet') {
    const mealType = ['breakfast', 'lunch', 'dinner', 'snack'].includes(draft.mealType) ? draft.mealType : '';
    const food = String(draft.food || '').trim().slice(0, 80);
    const calories = Number(draft.calories);
    if (!mealType || !food || !Number.isInteger(calories) || calories < 1 || calories > 10000) return null;
    return { mealType, food, calories, date };
  }
  return null;
}

function cleanPendingLifeRecordRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const requestId = String(value.requestId || '').trim().slice(0, 128);
  const action = value.action && typeof value.action === 'object' && !Array.isArray(value.action) ? value.action : {};
  const kind = ['memo', 'expense', 'income', 'workout', 'diet'].includes(action.kind) ? action.kind : '';
  const draft = cleanPendingLifeRecordDraft(kind, action.draft);
  const fingerprint = String(action.fingerprint || '').trim().slice(0, 160);
  if (
    !requestId
    || !kind
    || !draft
    || !new RegExp(`^life-record:v1:${kind}:[0-9a-f]{8}$`).test(fingerprint)
  ) return null;
  return {
    requestId,
    action: {
      kind,
      draft,
      confirmationText: String(action.confirmationText || '').trim().slice(0, 1000),
      fingerprint
    }
  };
}

function tokenKey(pcId) {
  return `${TOKEN_PREFIX}${String(pcId || '').trim()}`;
}

function nativeSecureStore() {
  if (typeof window === 'undefined') return null;
  const native = window.AiAssistantNative;
  if (!native) return null;
  const capabilities = nativeBridgeCapabilities();
  if (!capabilities || capabilities.secureTokenStorage !== 'android-keystore' || capabilities.tokenExport !== false) return null;
  if (
    typeof native.hasSecureValue !== 'function'
    || typeof native.getSecureValueMetadata !== 'function'
    || typeof native.removeSecureValue !== 'function'
  ) return null;
  return native;
}

export function hasNativeSecureStorage() {
  return Boolean(nativeSecureStore());
}

export function listPairedPcs() {
  const rows = readLocal(PCS_KEY, []);
  return Array.isArray(rows) ? rows.map(cleanPc).filter(Boolean) : [];
}

export function selectedPc() {
  const pcs = listPairedPcs();
  const selectedId = readLocal(LAST_PC_KEY, '');
  return pcs.find((pc) => pc.id === selectedId) || pcs[0] || null;
}

export function selectPc(pcId) {
  return writeLocal(LAST_PC_KEY, String(pcId || ''));
}

export async function savePairedPc(value, deviceToken, nativeReceipt = null) {
  const pc = cleanPc(value);
  if (!pc) throw new Error('페어링 응답이 올바르지 않습니다.');

  const native = nativeSecureStore();
  if (native) {
    const expectedKey = tokenKey(pc.id);
    if (nativeReceipt?.tokenStored !== true || nativeReceipt?.tokenKey !== expectedKey) {
      throw new Error('Android 보안 저장소의 페어링 확인 정보가 올바르지 않습니다.');
    }
    const stored = await Promise.resolve(native.hasSecureValue(expectedKey));
    if (!stored) throw new Error('Android 보안 저장소에서 기기 토큰을 확인하지 못했습니다.');
    let metadata;
    try {
      metadata = JSON.parse(String(await Promise.resolve(native.getSecureValueMetadata(expectedKey)) || 'null'));
    } catch {
      metadata = null;
    }
    const url = new URL(pc.baseUrl);
    const expectedOrigin = `${url.protocol}//${url.hostname.toLowerCase()}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`;
    if (
      !metadata
      || metadata.exists !== true
      || metadata.exportable !== false
      || metadata.bridgeOrigin !== expectedOrigin
    ) throw new Error('Android 보안 저장소의 Bridge origin 확인에 실패했습니다.');
  } else {
    if (hasNativeBridgeApi()) throw new Error('Android 보안 브리지가 준비되지 않아 페어링 정보를 저장하지 않았습니다.');
    if (!deviceToken) throw new Error('페어링 응답이 올바르지 않습니다.');
    // Browser/PWA fallback intentionally lasts only for the current document lifetime.
    volatileTokens.set(tokenKey(pc.id), String(deviceToken));
  }

  const pcs = listPairedPcs();
  const next = [...pcs.filter((item) => item.id !== pc.id), pc];
  writeLocal(PCS_KEY, next);
  selectPc(pc.id);
  writeLocal(PERMISSION_KEY, {
    ...(readLocal(PERMISSION_KEY, {}) || {}),
    [pc.id]: pc.permissions
  });
  window.dispatchEvent(new CustomEvent('lifehub:bridge-storage-changed'));
  return pc;
}

export function readVolatileDeviceToken(pcId) {
  const key = tokenKey(pcId);
  const native = nativeSecureStore();
  if (native) return null;
  return volatileTokens.get(key) || null;
}

export async function hasDeviceToken(pcId) {
  const key = tokenKey(pcId);
  const native = nativeSecureStore();
  if (native) return Boolean(await Promise.resolve(native.hasSecureValue(key)));
  return volatileTokens.has(key);
}

export async function deviceTokenMetadata(pcId) {
  const native = nativeSecureStore();
  if (!native) return null;
  const value = await Promise.resolve(native.getSecureValueMetadata(tokenKey(pcId)));
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

export async function forgetPairedPc(pcId) {
  const id = String(pcId || '');
  const native = nativeSecureStore();
  if (native) await Promise.resolve(native.removeSecureValue(tokenKey(id)));
  volatileTokens.delete(tokenKey(id));
  const next = listPairedPcs().filter((pc) => pc.id !== id);
  writeLocal(PCS_KEY, next);
  if (readLocal(LAST_PC_KEY, '') === id) {
    if (next[0]) selectPc(next[0].id);
    else removeLocal(LAST_PC_KEY);
  }
  const selectedProjects = readLocal(LAST_PROJECT_KEY, {}) || {};
  const projectCache = readLocal(PROJECT_CACHE_KEY, {}) || {};
  const permissions = readLocal(PERMISSION_KEY, {}) || {};
  const threadCache = readLocal(THREAD_CACHE_KEY, {}) || {};
  delete selectedProjects[id];
  delete projectCache[id];
  delete permissions[id];
  Object.keys(threadCache).filter((key) => key.startsWith(`${id}:`)).forEach((key) => delete threadCache[key]);
  writeLocal(LAST_PROJECT_KEY, selectedProjects);
  writeLocal(PROJECT_CACHE_KEY, projectCache);
  writeLocal(PERMISSION_KEY, permissions);
  writeLocal(THREAD_CACHE_KEY, threadCache);
  window.dispatchEvent(new CustomEvent('lifehub:bridge-storage-changed'));
}

export function selectedProjectId(pcId) {
  const value = readLocal(LAST_PROJECT_KEY, {});
  return String(value?.[pcId] || '');
}

export function selectProject(pcId, projectId) {
  const value = readLocal(LAST_PROJECT_KEY, {}) || {};
  return writeLocal(LAST_PROJECT_KEY, { ...value, [pcId]: String(projectId || '') });
}

export function cacheProjects(pcId, projects) {
  const id = String(pcId || '');
  if (!id) return false;
  const cache = readLocal(PROJECT_CACHE_KEY, {}) || {};
  const rows = (Array.isArray(projects) ? projects : []).slice(0, 100).map((project) => ({
    id: String(project?.id || '').slice(0, 128),
    name: String(project?.name || '').trim().slice(0, 120)
  })).filter((project) => project.id && project.name);
  return writeLocal(PROJECT_CACHE_KEY, { ...cache, [id]: rows });
}

export function projectNameFor(pcId, projectId) {
  const cache = readLocal(PROJECT_CACHE_KEY, {}) || {};
  const rows = Array.isArray(cache?.[pcId]) ? cache[pcId] : [];
  return rows.find((project) => project.id === projectId)?.name || '';
}

export function permissionsForPc(pcId) {
  const value = readLocal(PERMISSION_KEY, {}) || {};
  return cleanPermissions(value[pcId]);
}

export function cacheThreads(pcId, mode, threads) {
  const cache = readLocal(THREAD_CACHE_KEY, {}) || {};
  const key = `${pcId}:${mode}`;
  const safeThreads = (Array.isArray(threads) ? threads : []).slice(0, 50).map((thread) => ({
    id: String(thread.id || ''),
    appThreadId: String(thread.appThreadId || thread.id || ''),
    codexThreadId: String(thread.codexThreadId || ''),
    title: String(thread.title || '새 대화').slice(0, 120),
    mode: thread.mode === 'codex' ? 'codex' : 'assistant',
    localOnly: thread.localOnly === true,
    pendingScheduleRequest: thread.localOnly === true ? cleanPendingScheduleRequest(thread.pendingScheduleRequest) : null,
    pendingLifeRecordRequest: thread.localOnly === true ? cleanPendingLifeRecordRequest(thread.pendingLifeRecordRequest) : null,
    projectId: String(thread.projectId || ''),
    eventCursor: Number(thread.eventCursor) || 0,
    updatedAt: thread.updatedAt || thread.createdAt || new Date().toISOString(),
    messages: (Array.isArray(thread.messages) ? thread.messages : []).slice(-100).map((message) => ({
      id: String(message.id || ''),
      role: message.role === 'user' ? 'user' : 'assistant',
      content: String(message.content || message.text || '').slice(0, 200000),
      status: String(message.status || 'complete'),
      createdAt: message.createdAt || new Date().toISOString()
    }))
  }));
  return writeLocal(THREAD_CACHE_KEY, { ...cache, [key]: safeThreads });
}

export function readCachedThreads(pcId, mode) {
  const cache = readLocal(THREAD_CACHE_KEY, {}) || {};
  const rows = cache[`${pcId}:${mode}`];
  return Array.isArray(rows) ? rows.map((thread) => ({
    ...thread,
    pendingScheduleRequest: thread?.localOnly === true
      ? cleanPendingScheduleRequest(thread.pendingScheduleRequest)
      : null,
    pendingLifeRecordRequest: thread?.localOnly === true
      ? cleanPendingLifeRecordRequest(thread.pendingLifeRecordRequest)
      : null
  })) : [];
}

export function clearBridgeMetadataForTests() {
  removeLocal(PCS_KEY);
  removeLocal(LAST_PC_KEY);
  removeLocal(LAST_PROJECT_KEY);
  removeLocal(PROJECT_CACHE_KEY);
  removeLocal(THREAD_CACHE_KEY);
  removeLocal(PERMISSION_KEY);
  volatileTokens.clear();
}

export { cleanPermissions };
