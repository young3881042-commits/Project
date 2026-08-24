export const FINANCE_SHARE_DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;

export const FINANCE_SHARE_DOCUMENT_TYPES = Object.freeze({
  json: 'application/json',
  csv: 'text/csv'
});

const MIME_EXTENSIONS = Object.freeze({
  [FINANCE_SHARE_DOCUMENT_TYPES.json]: '.json',
  [FINANCE_SHARE_DOCUMENT_TYPES.csv]: '.csv'
});

export class FinanceShareDocumentError extends Error {
  constructor(code, message, { cancelled = false, cause } = {}) {
    super(message);
    this.name = 'FinanceShareDocumentError';
    this.code = code;
    this.cancelled = cancelled;
    if (cause !== undefined) this.cause = cause;
  }
}

function documentError(code, message, options) {
  return new FinanceShareDocumentError(code, message, options);
}

function defaultTarget() {
  return typeof window === 'undefined' ? null : window;
}

function defaultDocument() {
  return typeof document === 'undefined' ? null : document;
}

function nativeApi(target) {
  try {
    return target?.AiAssistantNative || null;
  } catch {
    return null;
  }
}

function utf8Bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function normalizedDocument({ fileName, mimeType, content }) {
  if (typeof content !== 'string') {
    throw documentError('invalid_content', '공유할 가계부 파일 내용이 올바르지 않아요.');
  }
  const normalizedMime = String(mimeType || '').trim().toLowerCase();
  const extension = MIME_EXTENSIONS[normalizedMime];
  if (!extension) throw documentError('invalid_type', '지원하지 않는 가계부 파일 형식이에요.');
  let normalizedName = String(fileName || '').trim();
  if (!normalizedName
      || normalizedName.length > 128
      || /[\u0000-\u001f\u007f-\u009f/\\]/.test(normalizedName)) {
    throw documentError('invalid_name', '가계부 파일 이름을 사용할 수 없어요.');
  }
  if (!normalizedName.toLowerCase().endsWith(extension)) normalizedName += extension;
  if (normalizedName.length > 128 || normalizedName.toLowerCase() === extension) {
    throw documentError('invalid_name', '가계부 파일 이름을 사용할 수 없어요.');
  }
  const bytes = utf8Bytes(content);
  if (!bytes) throw documentError('empty_file', '공유할 가계부 기록이 없어요.');
  if (bytes > FINANCE_SHARE_DOCUMENT_MAX_BYTES) {
    throw documentError('payload_too_large', '가계부 공유 파일은 8 MiB 이하여야 해요.');
  }
  if (normalizedMime === FINANCE_SHARE_DOCUMENT_TYPES.json) {
    const clean = content.trim();
    if (!clean.startsWith('{') || !clean.endsWith('}')) {
      throw documentError('invalid_content', '가계부 JSON 파일 내용이 올바르지 않아요.');
    }
  }
  return { fileName: normalizedName, mimeType: normalizedMime, content, bytes };
}

export function hasNativeFinanceShareApi(target = defaultTarget()) {
  return typeof nativeApi(target)?.shareFinanceFile === 'function';
}

function downloadDocument(value, target, pageDocument) {
  const BlobConstructor = target?.Blob || globalThis.Blob;
  const urlApi = target?.URL || globalThis.URL;
  if (!pageDocument || typeof BlobConstructor !== 'function'
      || typeof urlApi?.createObjectURL !== 'function') {
    throw documentError('share_unavailable', '이 환경에서는 파일 공유나 저장을 사용할 수 없어요.');
  }
  const blob = new BlobConstructor([value.content], { type: value.mimeType });
  const url = urlApi.createObjectURL(blob);
  const link = pageDocument.createElement('a');
  link.href = url;
  link.download = value.fileName;
  pageDocument.body.appendChild(link);
  link.click();
  link.remove();
  (target?.setTimeout || globalThis.setTimeout)(() => urlApi.revokeObjectURL(url), 1000);
}

async function tryWebShare(value, target) {
  const navigatorObject = target?.navigator;
  const FileConstructor = target?.File || globalThis.File;
  if (typeof navigatorObject?.share !== 'function' || typeof FileConstructor !== 'function') return false;
  const file = new FileConstructor([value.content], value.fileName, { type: value.mimeType });
  const payload = {
    title: 'Orbit 가계부 파일',
    text: 'Orbit에서 내보낸 가계부 사본입니다.',
    files: [file]
  };
  if (typeof navigatorObject.canShare === 'function' && !navigatorObject.canShare({ files: payload.files })) {
    return false;
  }
  try {
    await navigatorObject.share(payload);
    return true;
  } catch (cause) {
    if (cause?.name === 'AbortError') {
      throw documentError('cancelled', '공유를 취소했어요.', { cancelled: true, cause });
    }
    return false;
  }
}

export async function shareFinanceDocument(input, {
  target = defaultTarget(),
  pageDocument = defaultDocument()
} = {}) {
  const value = normalizedDocument(input || {});
  const native = nativeApi(target);
  if (typeof native?.shareFinanceFile === 'function') {
    try {
      if (native.shareFinanceFile(value.fileName, value.mimeType, value.content) === true) {
        return { mode: 'native-share', ...value };
      }
    } catch {
      // Continue to the browser share/download fallback.
    }
  }
  if (await tryWebShare(value, target)) return { mode: 'web-share', ...value };
  downloadDocument(value, target, pageDocument);
  return { mode: 'download', ...value };
}

function assertFileSize(size) {
  if (!Number.isSafeInteger(size) || size < 0) {
    throw documentError('invalid_file', '가계부 파일 크기를 확인할 수 없어요.');
  }
  if (size > FINANCE_SHARE_DOCUMENT_MAX_BYTES) {
    throw documentError('payload_too_large', '가계부 공유 파일은 8 MiB 이하여야 해요.');
  }
}

export async function readFinanceShareDocument(file) {
  assertFileSize(file?.size);
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  if (name && !name.endsWith('.json')) {
    throw documentError('invalid_type', 'Orbit 가계부 JSON 파일을 선택해주세요.');
  }
  if (type && type !== FINANCE_SHARE_DOCUMENT_TYPES.json && type !== 'application/octet-stream') {
    throw documentError('invalid_type', 'Orbit 가계부 JSON 파일을 선택해주세요.');
  }
  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (cause) {
    throw documentError('read_failed', '가계부 파일을 읽지 못했어요.', { cause });
  }
  if (!(buffer instanceof ArrayBuffer)) throw documentError('read_failed', '가계부 파일을 읽지 못했어요.');
  assertFileSize(buffer.byteLength);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (cause) {
    throw documentError('invalid_encoding', '가계부 파일이 올바른 UTF-8이 아니에요.', { cause });
  }
}
