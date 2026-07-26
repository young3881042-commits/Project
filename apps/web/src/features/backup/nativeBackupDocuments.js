export const NATIVE_BACKUP_DOCUMENT_RESULT_EVENT = 'lifehub:native-backup-result';
export const NATIVE_BACKUP_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;

const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;
const OPERATIONS = new Set(['export', 'import']);
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const ERROR_CODE_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/;
const activeRequests = new WeakMap();

export class NativeBackupDocumentError extends Error {
  constructor(code, message, {
    operation = '',
    requestId = '',
    browserFallbackAllowed = false,
    cancelled = false,
    detail = null,
    cause
  } = {}) {
    super(message);
    this.name = 'NativeBackupDocumentError';
    this.code = code;
    this.operation = operation;
    this.requestId = requestId;
    this.browserFallbackAllowed = browserFallbackAllowed;
    this.cancelled = cancelled;
    this.detail = detail;
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

function isObjectLike(value) {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function own(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function utf8ByteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function requestId(operation) {
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `lifehub-backup-${operation}-${suffix}`;
}

function adapterError(code, message, context = {}, overrides = {}) {
  return new NativeBackupDocumentError(code, message, {
    operation: context.operation,
    requestId: context.requestId,
    ...overrides
  });
}

function normalizeTimeout(timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw adapterError('invalid_argument', 'timeoutMs는 0보다 큰 숫자여야 합니다.');
  }
  return timeoutMs;
}

function normalizeFileName(value) {
  if (typeof value !== 'string') {
    throw adapterError('invalid_argument', '백업 파일 이름이 필요합니다.', { operation: 'export' });
  }
  let fileName = value.trim();
  if (!fileName
      || /[\u0000-\u001f\u007f-\u009f/\\]/.test(fileName)) {
    throw adapterError('invalid_argument', '백업 파일 이름을 사용할 수 없습니다.', { operation: 'export' });
  }
  if (!fileName.toLowerCase().endsWith('.json')) fileName += '.json';
  if (fileName.length > 128
      || fileName.toLowerCase() === '.json'
      || fileName.toLowerCase() === '..json') {
    throw adapterError('invalid_argument', '백업 파일 이름을 사용할 수 없습니다.', { operation: 'export' });
  }
  return fileName;
}

function assertJsonObject(json, context) {
  if (typeof json !== 'string') {
    throw adapterError('invalid_argument', '백업 내용은 JSON 문자열이어야 합니다.', context);
  }
  const bytes = utf8ByteLength(json);
  if (bytes > NATIVE_BACKUP_DOCUMENT_MAX_BYTES) {
    throw adapterError('payload_too_large', '백업 파일은 8 MiB 이하여야 합니다.', context);
  }
  const clean = json.trim();
  if (!clean.startsWith('{') || !clean.endsWith('}')) {
    throw adapterError('invalid_argument', '백업 내용은 JSON 객체여야 합니다.', context);
  }
  try {
    const parsed = JSON.parse(json);
    if (!isPlainRecord(parsed)) throw new Error('not an object');
  } catch (cause) {
    throw adapterError('invalid_argument', '백업 내용은 올바른 JSON 객체여야 합니다.', context, { cause });
  }
  return bytes;
}

function invalidResult(context, message = '네이티브 백업 응답 형식이 올바르지 않습니다.') {
  return adapterError('invalid_result', message, context);
}

function normalizeByteCount(value, context) {
  if (!Number.isSafeInteger(value) || value < 0) throw invalidResult(context);
  if (value > NATIVE_BACKUP_DOCUMENT_MAX_BYTES) {
    throw adapterError('payload_too_large', '네이티브 백업 응답이 8 MiB를 넘었습니다.', context);
  }
  return value;
}

function normalizeErrorDetail(value, context) {
  if (!isPlainRecord(value)
      || typeof value.code !== 'string'
      || !ERROR_CODE_PATTERN.test(value.code)
      || typeof value.message !== 'string'
      || !value.message
      || value.message.length > 240) {
    throw invalidResult(context);
  }
  return { code: value.code, message: value.message };
}

function normalizeNativeResult(value, context) {
  if (!isPlainRecord(value)) throw invalidResult(context);
  const required = ['requestId', 'operation', 'ok', 'cancelled', 'bytes', 'error'];
  if (required.some((key) => !own(value, key))
      || value.requestId !== context.requestId
      || !REQUEST_ID_PATTERN.test(value.requestId)
      || value.operation !== context.operation
      || !OPERATIONS.has(value.operation)
      || typeof value.ok !== 'boolean'
      || typeof value.cancelled !== 'boolean'
      || (value.ok && value.cancelled)) {
    throw invalidResult(context);
  }

  const bytes = normalizeByteCount(value.bytes, context);
  const normalized = {
    requestId: value.requestId,
    operation: value.operation,
    ok: value.ok,
    cancelled: value.cancelled,
    bytes
  };

  if (value.ok) {
    if (value.error !== null || bytes === 0) throw invalidResult(context);
    if (context.operation === 'export') {
      if (value.fileName !== context.fileName || own(value, 'json') || bytes !== context.exportBytes) {
        throw invalidResult(context);
      }
      normalized.fileName = value.fileName;
    } else {
      if (own(value, 'fileName') || typeof value.json !== 'string') throw invalidResult(context);
      let importedBytes;
      try {
        importedBytes = assertJsonObject(value.json, context);
      } catch (error) {
        if (error instanceof NativeBackupDocumentError && error.code === 'payload_too_large') {
          throw error;
        }
        throw invalidResult(context);
      }
      if (bytes !== importedBytes) throw invalidResult(context);
      normalized.json = value.json;
    }
    normalized.error = null;
    return normalized;
  }

  const error = normalizeErrorDetail(value.error, context);
  if (bytes !== 0
      || own(value, 'json')
      || (value.cancelled && error.code !== 'cancelled')
      || (!value.cancelled && error.code === 'cancelled')) {
    throw invalidResult(context);
  }
  const expectsCancelledExportFileName = value.cancelled && context.operation === 'export';
  if (expectsCancelledExportFileName) {
    if (!own(value, 'fileName') || value.fileName !== context.fileName) throw invalidResult(context);
    normalized.fileName = value.fileName;
  } else if (own(value, 'fileName')) {
    throw invalidResult(context);
  }
  normalized.error = error;
  return normalized;
}

export function hasNativeBackupDocumentApi(target = defaultTarget()) {
  const native = nativeApi(target);
  return Boolean(
    typeof native?.exportLifeHubBackup === 'function'
    && typeof native?.importLifeHubBackup === 'function'
  );
}

function rejected(error) {
  return Promise.reject(error);
}

function beginNativeRequest({ target, operation, timeoutMs, fileName, json, exportBytes }) {
  if (!hasNativeBackupDocumentApi(target)
      || !isObjectLike(target)
      || typeof target.addEventListener !== 'function'
      || typeof target.removeEventListener !== 'function') {
    return rejected(adapterError(
      'unavailable',
      '네이티브 백업 문서 기능을 사용할 수 없습니다.',
      { operation },
      { browserFallbackAllowed: true }
    ));
  }
  if (activeRequests.has(target)) {
    return rejected(adapterError(
      'busy',
      '다른 네이티브 백업 문서 작업이 진행 중입니다.',
      { operation }
    ));
  }

  const id = requestId(operation);
  const context = { operation, requestId: id, fileName, exportBytes };
  const native = nativeApi(target);
  activeRequests.set(target, context);

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    let listening = false;
    const setTimer = typeof target.setTimeout === 'function'
      ? target.setTimeout.bind(target)
      : globalThis.setTimeout;
    const clearTimer = typeof target.clearTimeout === 'function'
      ? target.clearTimeout.bind(target)
      : globalThis.clearTimeout;

    const cleanup = () => {
      if (timer !== null) clearTimer(timer);
      if (listening) target.removeEventListener(NATIVE_BACKUP_DOCUMENT_RESULT_EVENT, handleResult);
      if (activeRequests.get(target) === context) activeRequests.delete(target);
    };
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const fail = (error) => finish(() => reject(error));
    const handleResult = (event) => {
      let detail;
      try {
        detail = event?.detail;
        if (detail?.requestId !== id) return;
        const result = normalizeNativeResult(detail, context);
        if (!result.ok) {
          fail(adapterError(result.error.code, result.error.message, context, {
            cancelled: result.cancelled,
            detail: result
          }));
          return;
        }
        finish(() => resolve(result));
      } catch (error) {
        fail(error instanceof NativeBackupDocumentError
          ? error
          : invalidResult(context));
      }
    };

    try {
      target.addEventListener(NATIVE_BACKUP_DOCUMENT_RESULT_EVENT, handleResult);
      listening = true;
      timer = setTimer(() => fail(adapterError(
        'timeout',
        '네이티브 백업 문서 작업 시간이 초과되었습니다.',
        context
      )), timeoutMs);
    } catch (cause) {
      fail(adapterError(
        'unavailable',
        '네이티브 백업 결과를 기다릴 수 없습니다.',
        context,
        { browserFallbackAllowed: true, cause }
      ));
      return;
    }

    try {
      const accepted = operation === 'export'
        ? native.exportLifeHubBackup(id, fileName, json)
        : native.importLifeHubBackup(id);
      if (accepted !== true) {
        fail(adapterError(
          'native_rejected',
          '네이티브 백업 문서 요청이 시작되지 않았습니다.',
          context,
          { browserFallbackAllowed: true }
        ));
      }
    } catch (cause) {
      fail(adapterError(
        'native_exception',
        '네이티브 백업 문서 요청을 시작하지 못했습니다.',
        context,
        { browserFallbackAllowed: true, cause }
      ));
    }
  });
}

export function exportNativeLifeHubBackup({
  fileName,
  json,
  target = defaultTarget(),
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  try {
    const normalizedFileName = normalizeFileName(fileName);
    const exportBytes = assertJsonObject(json, { operation: 'export' });
    return beginNativeRequest({
      target,
      operation: 'export',
      timeoutMs: normalizeTimeout(timeoutMs),
      fileName: normalizedFileName,
      json,
      exportBytes
    });
  } catch (error) {
    return rejected(error);
  }
}

export function importNativeLifeHubBackup({
  target = defaultTarget(),
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  try {
    return beginNativeRequest({
      target,
      operation: 'import',
      timeoutMs: normalizeTimeout(timeoutMs)
    });
  } catch (error) {
    return rejected(error);
  }
}
