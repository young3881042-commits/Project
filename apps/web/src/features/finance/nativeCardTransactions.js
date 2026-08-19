export const NATIVE_CARD_IMPORT_RESULT_EVENT = 'lifehub:native-card-import-result';
export const CARD_IMPORT_SCHEMA_VERSION = 1;

export const CARD_IMPORT_SOURCES = Object.freeze([
  Object.freeze({ id: 'samsung-wallet', label: '삼성월렛' }),
  Object.freeze({ id: 'kakao-pay', label: '카카오페이 앱' })
]);

export const CARD_IMPORT_SOURCE_IDS = Object.freeze(
  CARD_IMPORT_SOURCES.map((source) => source.id)
);

const SOURCE_IDS = new Set(CARD_IMPORT_SOURCES.map((source) => source.id));
const ACCESS_STATES = new Set(['enabled', 'disabled', 'unsupported']);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const OWNER_PATTERN = /^[a-z0-9._-]{1,128}$/;
const EVENT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const ERROR_CODE_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const SENSITIVE_MERCHANT_TEXT = /(?:잔액|출금가능|계좌(?:번호)?|카드(?:번호)?|주민번호|비밀번호|(?:available\s*)?balance|account(?:\s*(?:number|no\.?))?|card\s*(?:number|no\.?)|password|passcode|pin\b)/i;
const SENSITIVE_NUMBER = /[0-9０-９]{4,}|(?:[*#xX•·]\s*){2,}[0-9０-９]{2,}/;
const activeRequests = new WeakMap();

export class NativeCardImportError extends Error {
  constructor(code, message, { operation = '', requestId = '', cause } = {}) {
    super(message);
    this.name = 'NativeCardImportError';
    this.code = code;
    this.operation = operation;
    this.requestId = requestId;
    if (cause !== undefined) this.cause = cause;
  }
}

function defaultTarget() {
  return typeof window === 'undefined' ? null : window;
}

function nativeApi(target) {
  try {
    return target?.AiAssistantNative || null;
  } catch {
    return null;
  }
}

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, allowed, required = allowed) {
  if (!isPlainRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.every((key) => allowed.includes(key))
    && required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function parseJsonObject(raw) {
  if (isPlainRecord(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return isPlainRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizedAccess(value) {
  const access = String(value || '').trim().toLowerCase();
  return ACCESS_STATES.has(access) ? access : null;
}

export function normalizeCardImportOwner(value) {
  const owner = String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .slice(0, 128);
  return OWNER_PATTERN.test(owner) ? owner : 'guestuser';
}

export function normalizeCardImportSources(value) {
  const values = Array.isArray(value) ? value : [];
  const unique = [];
  values.forEach((entry) => {
    const source = String(entry || '').trim().toLowerCase();
    if (SOURCE_IDS.has(source) && !unique.includes(source)) unique.push(source);
  });
  return CARD_IMPORT_SOURCES.map((source) => source.id).filter((source) => unique.includes(source));
}

function exactNativeSourceIds(value, { requireAll = false } = {}) {
  if (!Array.isArray(value)
      || value.some((source) => typeof source !== 'string' || !SOURCE_IDS.has(source))
      || new Set(value).size !== value.length) {
    return null;
  }
  const normalized = normalizeCardImportSources(value);
  if (normalized.length !== value.length
      || normalized.some((source, index) => source !== value[index])
      || (requireAll && normalized.length !== CARD_IMPORT_SOURCE_IDS.length)) {
    return null;
  }
  return normalized;
}

function hasExactNativeSources(value) {
  if (!Array.isArray(value) || value.length !== CARD_IMPORT_SOURCES.length) return false;
  return value.every((source, index) => (
    hasExactKeys(source, ['id', 'label'])
    && source.id === CARD_IMPORT_SOURCES[index].id
    && source.label === CARD_IMPORT_SOURCES[index].label
  ));
}

function normalizedMerchant(value) {
  if (typeof value !== 'string') return null;
  const merchant = value.normalize('NFKC').trim().replace(/[\t ]+/g, ' ');
  if (!merchant
      || merchant.length > 80
      || /[\r\n\u0000-\u001f\u007f]/.test(merchant)
      || SENSITIVE_MERCHANT_TEXT.test(merchant)
      || SENSITIVE_NUMBER.test(merchant)) {
    return null;
  }
  return merchant;
}

export function normalizeNativeCardCandidate(value) {
  const keys = ['eventId', 'source', 'amount', 'merchant', 'occurredAt'];
  if (!hasExactKeys(value, keys)) return null;
  const eventId = String(value.eventId || '');
  const source = String(value.source || '');
  const amount = value.amount;
  const occurredAt = value.occurredAt;
  const merchant = normalizedMerchant(value.merchant);
  if (!EVENT_ID_PATTERN.test(eventId)
      || !SOURCE_IDS.has(source)
      || !Number.isSafeInteger(amount)
      || amount < 1
      || amount > 999_999_999
      || !Number.isSafeInteger(occurredAt)
      || occurredAt < Date.UTC(2000, 0, 1)
      || occurredAt > Date.now() + 24 * 60 * 60 * 1000
      || !merchant) {
    return null;
  }
  return { eventId, source, amount, merchant, occurredAt };
}

function normalizeError(value) {
  if (!hasExactKeys(value, ['code', 'message'])) return null;
  const code = String(value.code || '');
  if (!ERROR_CODE_PATTERN.test(code)) return null;
  return { code };
}

function invalidResult(operation, requestId) {
  return new NativeCardImportError(
    'invalid_result',
    '결제 알림 응답을 안전하게 확인하지 못했어요.',
    { operation, requestId }
  );
}

function normalizeResult(value, { operation, requestId }) {
  const allowedRootKeys = [
    'schemaVersion',
    'requestId',
    'operation',
    'ok',
    'access',
    'pendingCount',
    'items',
    'resolvedEventIds',
    'error'
  ];
  const requiredRootKeys = ['schemaVersion', 'requestId', 'operation', 'ok', 'access', 'error'];
  if (!hasExactKeys(value, allowedRootKeys, requiredRootKeys)
      || value.schemaVersion !== CARD_IMPORT_SCHEMA_VERSION
      || value.requestId !== requestId
      || value.operation !== operation
      || typeof value.ok !== 'boolean') {
    throw invalidResult(operation, requestId);
  }
  const access = normalizedAccess(value.access);
  if (!access) throw invalidResult(operation, requestId);
  const pendingCount = value.pendingCount === undefined ? 0 : value.pendingCount;
  if (!Number.isSafeInteger(pendingCount) || pendingCount < 0 || pendingCount > 1000) {
    throw invalidResult(operation, requestId);
  }

  if (!value.ok) {
    const error = normalizeError(value.error);
    if (!error || value.items !== undefined || value.resolvedEventIds !== undefined) {
      throw invalidResult(operation, requestId);
    }
    throw new NativeCardImportError(
      error.code,
      '결제 알림을 가져오지 못했어요.',
      { operation, requestId }
    );
  }
  if (value.error !== null) throw invalidResult(operation, requestId);

  if (operation === 'peek') {
    if (!Array.isArray(value.items)
        || value.items.length > 256
        || value.resolvedEventIds !== undefined) {
      throw invalidResult(operation, requestId);
    }
    const items = value.items.map(normalizeNativeCardCandidate);
    if (items.some((item) => !item)) throw invalidResult(operation, requestId);
    if (new Set(items.map((item) => item.eventId)).size !== items.length) {
      throw invalidResult(operation, requestId);
    }
    return { schemaVersion: 1, operation, requestId, ok: true, access, pendingCount, items, error: null };
  }

  if (!Array.isArray(value.resolvedEventIds)
      || value.resolvedEventIds.length > 256
      || value.items !== undefined
      || value.resolvedEventIds.some((eventId) => !EVENT_ID_PATTERN.test(String(eventId || '')))
      || new Set(value.resolvedEventIds).size !== value.resolvedEventIds.length) {
    throw invalidResult(operation, requestId);
  }
  return {
    schemaVersion: 1,
    operation,
    requestId,
    ok: true,
    access,
    pendingCount,
    resolvedEventIds: [...value.resolvedEventIds],
    error: null
  };
}

function requestId(operation) {
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `card-import-${operation}-${suffix}`;
}

function requiredNativeMethods(native) {
  return typeof native?.getCardImportCapabilities === 'function'
    && typeof native?.configureCardImport === 'function'
    && typeof native?.openCardNotificationAccessSettings === 'function'
    && typeof native?.requestPendingCardTransactions === 'function'
    && typeof native?.resolvePendingCardTransactions === 'function';
}

export function hasNativeCardImportApi(target = defaultTarget()) {
  return requiredNativeMethods(nativeApi(target));
}

export function nativeCardImportCapabilities(target = defaultTarget()) {
  const native = nativeApi(target);
  if (!requiredNativeMethods(native)) return null;
  let value;
  try {
    value = parseJsonObject(native.getCardImportCapabilities());
  } catch {
    return null;
  }
  const capabilityKeys = [
    'schemaVersion',
    'nativeCardImport',
    'supported',
    'access',
    'supportedSources',
    'availableSources',
    'selectedSources',
    'pendingCount'
  ];
  if (!hasExactKeys(value, capabilityKeys)) return null;
  const access = normalizedAccess(value.access);
  const supportedSources = exactNativeSourceIds(value.supportedSources, { requireAll: true });
  const selectedSources = exactNativeSourceIds(value.selectedSources);
  const pendingCount = value.pendingCount;
  if (value.schemaVersion !== 1
      || value.nativeCardImport !== true
      || value.supported !== true
      || !access
      || !supportedSources
      || !hasExactNativeSources(value.availableSources)
      || !selectedSources
      || !Number.isSafeInteger(pendingCount)
      || pendingCount < 0
      || pendingCount > 1000) {
    return null;
  }
  return {
    schemaVersion: 1,
    nativeCardImport: true,
    access,
    supportedSources,
    selectedSources,
    pendingCount
  };
}

export function configureNativeCardImport({ owner, sources, target = defaultTarget() } = {}) {
  if (!hasNativeCardImportApi(target)) return false;
  const normalizedOwner = normalizeCardImportOwner(owner);
  const normalizedSources = normalizeCardImportSources(sources);
  try {
    return nativeApi(target).configureCardImport(
      normalizedOwner,
      JSON.stringify(normalizedSources)
    ) === true;
  } catch {
    return false;
  }
}

export function openNativeCardNotificationAccessSettings(target = defaultTarget()) {
  if (!hasNativeCardImportApi(target)) return false;
  try {
    return nativeApi(target).openCardNotificationAccessSettings() === true;
  } catch {
    return false;
  }
}

export function openNativeCardImportAppSettings(target = defaultTarget()) {
  const native = nativeApi(target);
  if (!hasNativeCardImportApi(target) || typeof native?.openAppDetailsSettings !== 'function') {
    return false;
  }
  try {
    return native.openAppDetailsSettings() === true;
  } catch {
    return false;
  }
}

function beginRequest({ operation, owner, sources, decisions, target, timeoutMs }) {
  if (!hasNativeCardImportApi(target)
      || !target
      || typeof target.addEventListener !== 'function'
      || typeof target.removeEventListener !== 'function') {
    return Promise.reject(new NativeCardImportError(
      'unavailable',
      '이 환경에서는 결제 알림 가져오기를 사용할 수 없어요.',
      { operation }
    ));
  }
  if (activeRequests.has(target)) {
    return Promise.reject(new NativeCardImportError(
      'busy',
      '결제 알림을 이미 가져오고 있어요.',
      { operation }
    ));
  }
  const id = requestId(operation);
  const context = { operation, requestId: id };
  const native = nativeApi(target);
  const normalizedOwner = normalizeCardImportOwner(owner);
  activeRequests.set(target, context);

  return new Promise((resolve, reject) => {
    let settled = false;
    const setTimer = typeof target.setTimeout === 'function'
      ? target.setTimeout.bind(target)
      : globalThis.setTimeout;
    const clearTimer = typeof target.clearTimeout === 'function'
      ? target.clearTimeout.bind(target)
      : globalThis.clearTimeout;
    let timer = null;
    const cleanup = () => {
      if (timer !== null) clearTimer(timer);
      target.removeEventListener(NATIVE_CARD_IMPORT_RESULT_EVENT, handleResult);
      if (activeRequests.get(target) === context) activeRequests.delete(target);
    };
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const handleResult = (event) => {
      if (event?.detail?.requestId !== id) return;
      try {
        const result = normalizeResult(event.detail, context);
        finish(() => resolve(result));
      } catch (error) {
        finish(() => reject(error));
      }
    };
    target.addEventListener(NATIVE_CARD_IMPORT_RESULT_EVENT, handleResult);
    timer = setTimer(() => finish(() => reject(new NativeCardImportError(
      'timeout',
      '결제 알림 가져오기 시간이 초과됐어요.',
      context
    ))), timeoutMs);

    try {
      const accepted = operation === 'peek'
        ? native.requestPendingCardTransactions(
            id,
            normalizedOwner,
            JSON.stringify(normalizeCardImportSources(sources))
          )
        : native.resolvePendingCardTransactions(
            id,
            normalizedOwner,
            JSON.stringify(decisions)
          );
      if (accepted !== true) {
        finish(() => reject(new NativeCardImportError(
          'native_rejected',
          '결제 알림 요청이 시작되지 않았어요.',
          context
        )));
      }
    } catch (cause) {
      finish(() => reject(new NativeCardImportError(
        'native_exception',
        '결제 알림 요청을 시작하지 못했어요.',
        { ...context, cause }
      )));
    }
  });
}

export function requestPendingCardTransactions({
  owner,
  sources,
  target = defaultTarget(),
  timeoutMs = 15000
} = {}) {
  return beginRequest({ operation: 'peek', owner, sources, decisions: [], target, timeoutMs });
}

export function acknowledgePendingCardTransactions({
  owner,
  decisions,
  target = defaultTarget(),
  timeoutMs = 15000
} = {}) {
  const normalizedDecisions = Array.isArray(decisions)
    ? decisions.map((value) => ({
        eventId: String(value?.eventId || ''),
        status: String(value?.status || '')
      }))
    : [];
  const normalizedIds = normalizedDecisions.map((value) => value.eventId);
  if (!normalizedDecisions.length
      || normalizedDecisions.length > 256
      || normalizedDecisions.some((value) => (
        !EVENT_ID_PATTERN.test(value.eventId)
        || !['saved', 'duplicate'].includes(value.status)
      ))
      || new Set(normalizedIds).size !== normalizedIds.length) {
    return Promise.reject(new NativeCardImportError(
      'invalid_argument',
      '처리할 결제 알림 식별자가 올바르지 않아요.',
      { operation: 'resolve' }
    ));
  }
  return beginRequest({
    operation: 'resolve',
    owner,
    sources: [],
    decisions: normalizedDecisions,
    target,
    timeoutMs
  }).then((result) => {
    if (result.resolvedEventIds.length !== normalizedIds.length
        || normalizedIds.some((eventId) => !result.resolvedEventIds.includes(eventId))) {
      throw invalidResult('resolve', result.requestId);
    }
    return result;
  });
}
