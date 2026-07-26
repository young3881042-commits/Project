import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BROWSER_BACKUP_DOCUMENT_MAX_BYTES,
  BrowserBackupDocumentError,
  assertBrowserBackupByteLimit,
  backupJsonByteLength,
  readBrowserBackupFile
} from './browserBackupDocuments.js';

function fileFromBytes(bytes, reportedSize = bytes.byteLength) {
  return {
    size: reportedSize,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  };
}

async function expectBrowserError(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof BrowserBackupDocumentError);
    assert.equal(error.code, code);
    return true;
  });
}

test('브라우저 fallback도 UTF-8 기준 8 MiB 단일 상한을 사용한다', () => {
  assert.equal(BROWSER_BACKUP_DOCUMENT_MAX_BYTES, 8 * 1024 * 1024);
  assert.doesNotThrow(() => assertBrowserBackupByteLimit(BROWSER_BACKUP_DOCUMENT_MAX_BYTES));
  assert.throws(
    () => assertBrowserBackupByteLimit(BROWSER_BACKUP_DOCUMENT_MAX_BYTES + 1),
    (error) => error?.code === 'payload_too_large'
  );
  assert.equal(backupJsonByteLength('{"owner":"사용자"}'), 21);
});

test('브라우저 파일은 strict UTF-8로 읽고 실제 buffer 크기도 다시 확인한다', async () => {
  const json = '{"product":"LifeHub"}';
  const encoded = new TextEncoder().encode(json);
  assert.equal(await readBrowserBackupFile(fileFromBytes(encoded)), json);

  let read = false;
  await expectBrowserError(readBrowserBackupFile({
    size: BROWSER_BACKUP_DOCUMENT_MAX_BYTES + 1,
    async arrayBuffer() {
      read = true;
      return new ArrayBuffer(0);
    }
  }), 'payload_too_large');
  assert.equal(read, false);

  const oversized = new Uint8Array(BROWSER_BACKUP_DOCUMENT_MAX_BYTES + 1);
  await expectBrowserError(readBrowserBackupFile(fileFromBytes(oversized, 1)), 'payload_too_large');
  await expectBrowserError(readBrowserBackupFile(fileFromBytes(Uint8Array.from([0xc3, 0x28]))), 'invalid_json');
});
