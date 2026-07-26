import { NATIVE_BACKUP_DOCUMENT_MAX_BYTES } from './nativeBackupDocuments.js';

export const BROWSER_BACKUP_DOCUMENT_MAX_BYTES = NATIVE_BACKUP_DOCUMENT_MAX_BYTES;

export class BrowserBackupDocumentError extends Error {
  constructor(code, message, cause = undefined) {
    super(message);
    this.name = 'BrowserBackupDocumentError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

export function backupJsonByteLength(json) {
  if (typeof json !== 'string') {
    throw new BrowserBackupDocumentError('invalid_json', '백업 내용은 JSON 문자열이어야 해요.');
  }
  return new TextEncoder().encode(json).byteLength;
}

export function assertBrowserBackupByteLimit(size) {
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new BrowserBackupDocumentError('invalid_file', '백업 파일 크기를 확인할 수 없어요.');
  }
  if (size > BROWSER_BACKUP_DOCUMENT_MAX_BYTES) {
    throw new BrowserBackupDocumentError('payload_too_large', '백업 파일은 8 MiB 이하여야 해요.');
  }
}

export async function readBrowserBackupFile(file) {
  assertBrowserBackupByteLimit(file?.size);
  let buffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (cause) {
    throw new BrowserBackupDocumentError('read_failed', '백업 파일을 읽지 못했어요.', cause);
  }
  if (!(buffer instanceof ArrayBuffer)) {
    throw new BrowserBackupDocumentError('read_failed', '백업 파일을 읽지 못했어요.');
  }
  assertBrowserBackupByteLimit(buffer.byteLength);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (cause) {
    throw new BrowserBackupDocumentError(
      'invalid_json',
      '백업 파일이 올바른 UTF-8 JSON이 아니에요.',
      cause
    );
  }
}
