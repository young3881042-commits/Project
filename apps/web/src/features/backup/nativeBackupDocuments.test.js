import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NATIVE_BACKUP_DOCUMENT_MAX_BYTES,
  NATIVE_BACKUP_DOCUMENT_RESULT_EVENT,
  NativeBackupDocumentError,
  exportNativeLifeHubBackup,
  hasNativeBackupDocumentApi,
  importNativeLifeHubBackup
} from './nativeBackupDocuments.js';

function bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function resultEvent(detail) {
  const event = new Event(NATIVE_BACKUP_DOCUMENT_RESULT_EVENT);
  Object.defineProperty(event, 'detail', { value: detail });
  return event;
}

function nativeTarget(overrides = {}) {
  const target = new EventTarget();
  target.setTimeout = globalThis.setTimeout;
  target.clearTimeout = globalThis.clearTimeout;
  target.AiAssistantNative = {
    exportLifeHubBackup() { return true; },
    importLifeHubBackup() { return true; },
    ...overrides
  };
  return target;
}

async function expectNativeError(promise, code, checks = {}) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof NativeBackupDocumentError);
    assert.equal(error.code, code);
    for (const [key, value] of Object.entries(checks)) assert.equal(error[key], value);
    return true;
  });
}

test('capability는 두 native 백업 메서드의 정확한 존재로만 판별한다', () => {
  assert.equal(hasNativeBackupDocumentApi(nativeTarget()), true);
  assert.equal(hasNativeBackupDocumentApi({ AiAssistantNative: {} }), false);
  assert.equal(hasNativeBackupDocumentApi({
    AiAssistantNative: { exportLifeHubBackup() { return true; } }
  }), false);
  assert.equal(hasNativeBackupDocumentApi({
    AiAssistantNative: {
      exportLifeHubBackup: true,
      importLifeHubBackup() { return true; }
    }
  }), false);
});

test('export는 requestId를 맞춘 성공 detail을 정규화한다', async () => {
  const json = '{"product":"LifeHub","title":"한글"}';
  let nativeArguments = null;
  const target = nativeTarget({
    exportLifeHubBackup(requestId, fileName, payload) {
      nativeArguments = { requestId, fileName, payload };
      queueMicrotask(() => {
        target.dispatchEvent(resultEvent({
          requestId: 'different-request',
          operation: 'export',
          ok: true,
          cancelled: false,
          bytes: bytes(payload),
          fileName,
          error: null
        }));
        target.dispatchEvent(resultEvent({
          requestId,
          operation: 'export',
          ok: true,
          cancelled: false,
          bytes: bytes(payload),
          fileName,
          error: null
        }));
      });
      return true;
    }
  });

  const result = await exportNativeLifeHubBackup({
    fileName: ' lifehub-backup ',
    json,
    target,
    timeoutMs: 1000
  });
  assert.match(nativeArguments.requestId, /^lifehub-backup-export-[A-Za-z0-9._:-]+$/);
  assert.equal(nativeArguments.fileName, 'lifehub-backup.json');
  assert.equal(nativeArguments.payload, json);
  assert.deepEqual(result, {
    requestId: nativeArguments.requestId,
    operation: 'export',
    ok: true,
    cancelled: false,
    bytes: bytes(json),
    fileName: 'lifehub-backup.json',
    error: null
  });
});

test('import는 UTF-8 byte count가 일치하는 JSON 객체 문자열을 반환한다', async () => {
  const json = '{"owner":"사용자"}';
  const target = nativeTarget({
    importLifeHubBackup(requestId) {
      queueMicrotask(() => target.dispatchEvent(resultEvent({
        requestId,
        operation: 'import',
        ok: true,
        cancelled: false,
        bytes: bytes(json),
        json,
        error: null
      })));
      return true;
    }
  });

  const result = await importNativeLifeHubBackup({ target, timeoutMs: 1000 });
  assert.deepEqual(result, {
    requestId: result.requestId,
    operation: 'import',
    ok: true,
    cancelled: false,
    bytes: bytes(json),
    json,
    error: null
  });
});

test('같은 target의 export/import 동시 요청을 막고 완료 후 잠금을 해제한다', async () => {
  let exportId = '';
  const json = '{}';
  const target = nativeTarget({
    exportLifeHubBackup(requestId) {
      exportId = requestId;
      return true;
    },
    importLifeHubBackup(requestId) {
      queueMicrotask(() => target.dispatchEvent(resultEvent({
        requestId,
        operation: 'import',
        ok: false,
        cancelled: true,
        bytes: 0,
        error: { code: 'cancelled', message: '취소했어요.' }
      })));
      return true;
    }
  });

  const first = exportNativeLifeHubBackup({ fileName: 'backup.json', json, target, timeoutMs: 1000 });
  await expectNativeError(
    importNativeLifeHubBackup({ target, timeoutMs: 1000 }),
    'busy',
    { browserFallbackAllowed: false }
  );
  target.dispatchEvent(resultEvent({
    requestId: exportId,
    operation: 'export',
    ok: true,
    cancelled: false,
    bytes: bytes(json),
    fileName: 'backup.json',
    error: null
  }));
  await first;
  await expectNativeError(importNativeLifeHubBackup({ target, timeoutMs: 1000 }), 'cancelled');
});

test('native 취소와 실패를 code/detail이 있는 Error로 reject한다', async () => {
  const cancelledTarget = nativeTarget({
    exportLifeHubBackup(requestId, fileName) {
      queueMicrotask(() => cancelledTarget.dispatchEvent(resultEvent({
        requestId,
        operation: 'export',
        ok: false,
        cancelled: true,
        bytes: 0,
        fileName,
        error: { code: 'cancelled', message: 'JSON 문서 선택을 취소했어요.' }
      })));
      return true;
    }
  });
  await expectNativeError(
    exportNativeLifeHubBackup({ fileName: 'backup', json: '{}', target: cancelledTarget }),
    'cancelled',
    { cancelled: true, browserFallbackAllowed: false, operation: 'export' }
  );

  const failedTarget = nativeTarget({
    importLifeHubBackup(requestId) {
      queueMicrotask(() => failedTarget.dispatchEvent(resultEvent({
        requestId,
        operation: 'import',
        ok: false,
        cancelled: false,
        bytes: 0,
        error: { code: 'read_failed', message: '백업 파일을 읽지 못했어요.' }
      })));
      return true;
    }
  });
  await assert.rejects(importNativeLifeHubBackup({ target: failedTarget }), (error) => {
    assert.equal(error.code, 'read_failed');
    assert.equal(error.message, '백업 파일을 읽지 못했어요.');
    assert.equal(error.detail.error.code, 'read_failed');
    assert.equal(error.browserFallbackAllowed, false);
    return true;
  });
});

test('native API 부재·false·예외는 브라우저 fallback 가능한 시작 오류로 구분한다', async () => {
  await expectNativeError(
    importNativeLifeHubBackup({ target: new EventTarget() }),
    'unavailable',
    { browserFallbackAllowed: true }
  );
  await expectNativeError(
    importNativeLifeHubBackup({ target: nativeTarget({ importLifeHubBackup() { return false; } }) }),
    'native_rejected',
    { browserFallbackAllowed: true }
  );
  await expectNativeError(
    exportNativeLifeHubBackup({
      fileName: 'backup.json',
      json: '{}',
      target: nativeTarget({ exportLifeHubBackup() { throw new Error('bridge down'); } })
    }),
    'native_exception',
    { browserFallbackAllowed: true }
  );
});

test('결과 이벤트가 없으면 timeout으로 reject하고 요청 잠금을 해제한다', async () => {
  const target = nativeTarget();
  await expectNativeError(
    importNativeLifeHubBackup({ target, timeoutMs: 5 }),
    'timeout',
    { browserFallbackAllowed: false }
  );

  target.AiAssistantNative.importLifeHubBackup = () => false;
  await expectNativeError(
    importNativeLifeHubBackup({ target, timeoutMs: 1000 }),
    'native_rejected'
  );
});

test('matching requestId의 잘못된 operation/byte count/result shape을 거부한다', async () => {
  const wrongOperation = nativeTarget({
    exportLifeHubBackup(requestId, fileName, json) {
      queueMicrotask(() => wrongOperation.dispatchEvent(resultEvent({
        requestId,
        operation: 'import',
        ok: true,
        cancelled: false,
        bytes: bytes(json),
        fileName,
        error: null
      })));
      return true;
    }
  });
  await expectNativeError(
    exportNativeLifeHubBackup({ fileName: 'backup.json', json: '{}', target: wrongOperation }),
    'invalid_result'
  );

  const wrongBytes = nativeTarget({
    importLifeHubBackup(requestId) {
      queueMicrotask(() => wrongBytes.dispatchEvent(resultEvent({
        requestId,
        operation: 'import',
        ok: true,
        cancelled: false,
        bytes: 1,
        json: '{}',
        error: null
      })));
      return true;
    }
  });
  await expectNativeError(importNativeLifeHubBackup({ target: wrongBytes }), 'invalid_result');

  const invalidJson = nativeTarget({
    importLifeHubBackup(requestId) {
      queueMicrotask(() => invalidJson.dispatchEvent(resultEvent({
        requestId,
        operation: 'import',
        ok: true,
        cancelled: false,
        bytes: bytes('not-json'),
        json: 'not-json',
        error: null
      })));
      return true;
    }
  });
  await expectNativeError(importNativeLifeHubBackup({ target: invalidJson }), 'invalid_result');

  const incompleteCancellation = nativeTarget({
    exportLifeHubBackup(requestId) {
      queueMicrotask(() => incompleteCancellation.dispatchEvent(resultEvent({
        requestId,
        operation: 'export',
        ok: false,
        cancelled: true,
        bytes: 0,
        error: { code: 'cancelled', message: '취소했어요.' }
      })));
      return true;
    }
  });
  await expectNativeError(exportNativeLifeHubBackup({
    fileName: 'backup.json',
    json: '{}',
    target: incompleteCancellation
  }), 'invalid_result');
});

test('export 입력과 native 결과 모두 8 MiB 상한을 검증한다', async () => {
  assert.equal(NATIVE_BACKUP_DOCUMENT_MAX_BYTES, 8 * 1024 * 1024);
  let called = false;
  const oversizedJson = `{"value":"${'a'.repeat(NATIVE_BACKUP_DOCUMENT_MAX_BYTES)}"}`;
  const target = nativeTarget({
    exportLifeHubBackup() {
      called = true;
      return true;
    }
  });
  await expectNativeError(
    exportNativeLifeHubBackup({ fileName: 'backup.json', json: oversizedJson, target }),
    'payload_too_large'
  );
  assert.equal(called, false);

  const oversizedResult = nativeTarget({
    importLifeHubBackup(requestId) {
      queueMicrotask(() => oversizedResult.dispatchEvent(resultEvent({
        requestId,
        operation: 'import',
        ok: true,
        cancelled: false,
        bytes: NATIVE_BACKUP_DOCUMENT_MAX_BYTES + 1,
        json: '{}',
        error: null
      })));
      return true;
    }
  });
  await expectNativeError(
    importNativeLifeHubBackup({ target: oversizedResult }),
    'payload_too_large',
    { browserFallbackAllowed: false }
  );
});
