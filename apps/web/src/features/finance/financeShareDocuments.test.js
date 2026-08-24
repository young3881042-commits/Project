import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FINANCE_SHARE_DOCUMENT_MAX_BYTES,
  hasNativeFinanceShareApi,
  readFinanceShareDocument,
  shareFinanceDocument
} from './financeShareDocuments.js';

test('Android native 공유는 파일명·MIME·내용만 검증해 전달한다', async () => {
  let request = null;
  const target = {
    AiAssistantNative: {
      shareFinanceFile(fileName, mimeType, content) {
        request = { fileName, mimeType, content };
        return true;
      }
    }
  };
  assert.equal(hasNativeFinanceShareApi(target), true);
  const result = await shareFinanceDocument({
    fileName: 'Orbit-finance-2026-08-23',
    mimeType: 'application/json',
    content: '{"product":"OrbitFinance"}'
  }, { target, pageDocument: null });
  assert.equal(result.mode, 'native-share');
  assert.deepEqual(request, {
    fileName: 'Orbit-finance-2026-08-23.json',
    mimeType: 'application/json',
    content: '{"product":"OrbitFinance"}'
  });
});

test('Web Share 파일을 지원하면 시스템 공유 창을 사용한다', async () => {
  let payload = null;
  class FakeFile {
    constructor(parts, name, options) {
      this.parts = parts;
      this.name = name;
      this.type = options.type;
    }
  }
  const target = {
    File: FakeFile,
    navigator: {
      canShare: ({ files }) => files.length === 1,
      share: async (value) => { payload = value; }
    }
  };
  const result = await shareFinanceDocument({
    fileName: 'Orbit-finance.csv',
    mimeType: 'text/csv',
    content: '날짜,금액\r\n2026-08-23,1000\r\n'
  }, { target, pageDocument: null });
  assert.equal(result.mode, 'web-share');
  assert.equal(payload.files[0].name, 'Orbit-finance.csv');
  assert.equal(payload.files[0].type, 'text/csv');
});

test('8 MiB를 넘는 공유 내용은 native 호출 전에 거부한다', async () => {
  let called = false;
  const target = {
    AiAssistantNative: {
      shareFinanceFile() { called = true; return true; }
    }
  };
  await assert.rejects(
    shareFinanceDocument({
      fileName: 'Orbit-finance.csv',
      mimeType: 'text/csv',
      content: 'a'.repeat(FINANCE_SHARE_DOCUMENT_MAX_BYTES + 1)
    }, { target, pageDocument: null }),
    /8 MiB/
  );
  assert.equal(called, false);
});

test('가져오기 파일은 실제 ArrayBuffer 크기와 strict UTF-8을 다시 검사한다', async () => {
  const json = '{"product":"OrbitFinance"}';
  const bytes = new TextEncoder().encode(json);
  const file = {
    name: 'Orbit-finance.json',
    type: 'application/json',
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer
  };
  assert.equal(await readFinanceShareDocument(file), json);

  const invalid = new Uint8Array([0xc3, 0x28]);
  await assert.rejects(readFinanceShareDocument({
    ...file,
    size: invalid.byteLength,
    arrayBuffer: async () => invalid.buffer
  }), /UTF-8/);
});
