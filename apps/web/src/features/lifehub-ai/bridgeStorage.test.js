import test from 'node:test';
import assert from 'node:assert/strict';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    dump: () => [...values.values()].join('\n')
  };
}

test('기기 토큰은 localStorage가 아니라 Native secure store에만 저장한다', async () => {
  const localStorage = memoryStorage();
  const tokenKey = 'lifehub.bridge.token:pc-test';
  const secure = new Map([[tokenKey, {
    exists: true,
    createdAt: '2026-07-11T00:00:00.000Z',
    storage: 'android-keystore',
    bridgeOrigin: 'http://127.0.0.1:4317',
    exportable: false
  }]]);
  let plaintextSetterCalled = false;
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  globalThis.window = {
    localStorage,
    dispatchEvent() {},
    AiAssistantNative: {
      getBridgeCapabilities() {
        return JSON.stringify({ nativeTransport: true, http: true, https: true, secureTokenStorage: 'android-keystore', tokenExport: false });
      },
      setBridgeToken() { plaintextSetterCalled = true; throw new Error('JS plaintext token setter must not be called'); },
      hasSecureValue(key) { return secure.has(key); },
      getSecureValueMetadata(key) {
        return secure.has(key) ? JSON.stringify(secure.get(key)) : '';
      },
      removeSecureValue(key) { secure.delete(key); return true; }
    }
  };
  const storage = await import(`./bridgeStorage.js?test=${Date.now()}`);
  await storage.savePairedPc(
    { id: 'pc-test', baseUrl: 'http://127.0.0.1:4317', name: 'Test PC' },
    '',
    { tokenStored: true, tokenKey }
  );

  assert.equal(plaintextSetterCalled, false);
  assert.equal(localStorage.dump().includes('device-token'), false);
  assert.equal(await storage.hasDeviceToken('pc-test'), true);
  assert.equal(storage.readVolatileDeviceToken('pc-test'), null);
  assert.deepEqual(await storage.deviceTokenMetadata('pc-test'), {
    exists: true,
    createdAt: '2026-07-11T00:00:00.000Z',
    storage: 'android-keystore',
    bridgeOrigin: 'http://127.0.0.1:4317',
    exportable: false
  });

  await storage.forgetPairedPc('pc-test');
  assert.equal(secure.has('lifehub.bridge.token:pc-test'), false);
});

test('Native 페어링은 tokenStored 영수증과 정확한 tokenKey가 없으면 거부한다', async () => {
  const localStorage = memoryStorage();
  globalThis.window = {
    localStorage,
    dispatchEvent() {},
    AiAssistantNative: {
      getBridgeCapabilities() {
        return JSON.stringify({ nativeTransport: true, http: true, https: true, secureTokenStorage: 'android-keystore', tokenExport: false });
      },
      hasSecureValue() { return true; },
      getSecureValueMetadata() {
        return JSON.stringify({ exists: true, bridgeOrigin: 'https://pc.example:443', exportable: false });
      },
      removeSecureValue() { return true; }
    }
  };
  const storage = await import(`./bridgeStorage.js?receipt-test=${Date.now()}`);
  const pc = { id: 'pc-receipt', baseUrl: 'https://pc.example', name: 'Receipt PC' };
  await assert.rejects(storage.savePairedPc(pc, '', { tokenStored: true, tokenKey: 'wrong-key' }), /확인 정보/);
  assert.equal(storage.listPairedPcs().length, 0);
});

test('브라우저 fallback 토큰은 document 메모리에만 유지한다', async () => {
  const localStorage = memoryStorage();
  globalThis.window = { localStorage, dispatchEvent() {} };
  const storage = await import(`./bridgeStorage.js?browser-test=${Date.now()}`);
  const token = 'browser-volatile-device-token';
  await storage.savePairedPc({ id: 'pc-browser', baseUrl: 'https://pc.example', name: 'Browser PC' }, token);
  storage.selectProject('pc-browser', 'project-browser');
  storage.cacheProjects('pc-browser', [{ id: 'project-browser', name: 'Browser Project' }]);
  storage.cacheThreads('pc-browser', 'assistant', [{ id: 'thread-browser', messages: [] }]);
  assert.equal(storage.readVolatileDeviceToken('pc-browser'), token);
  assert.equal(localStorage.dump().includes(token), false);
  await storage.forgetPairedPc('pc-browser');
  assert.equal(storage.readVolatileDeviceToken('pc-browser'), null);
  assert.equal(storage.selectedProjectId('pc-browser'), '');
  assert.equal(storage.projectNameFor('pc-browser', 'project-browser'), '');
  assert.equal(storage.readCachedThreads('pc-browser', 'assistant').length, 0);
});

test('프로젝트 캐시는 선택 id를 사용자용 이름으로만 변환한다', async () => {
  const localStorage = memoryStorage();
  globalThis.window = { localStorage, dispatchEvent() {} };
  const storage = await import(`./bridgeStorage.js?project-test=${Date.now()}`);
  storage.cacheProjects('pc-project', [
    { id: 'vibeCoding', name: 'LifeHub', cwd: '/private/home/vibeCoding' }
  ]);
  storage.selectProject('pc-project', 'vibeCoding');

  assert.equal(storage.projectNameFor('pc-project', storage.selectedProjectId('pc-project')), 'LifeHub');
  assert.equal(localStorage.dump().includes('/private/home'), false);
});

test('일반 AI와 Codex 대화/SDK thread ID는 PC·모드별로 분리 저장한다', async () => {
  const localStorage = memoryStorage();
  globalThis.window = { localStorage, dispatchEvent() {} };
  const storage = await import(`./bridgeStorage.js?thread-test=${Date.now()}`);
  storage.cacheThreads('pc-thread', 'assistant', [{
    id: 'general-1',
    appThreadId: 'general-1',
    codexThreadId: 'sdk-general',
    localOnly: true,
    pendingScheduleRequest: {
      requestId: 'request-1',
      action: { status: 'need-more', missing: 'title', question: '제목은?', draft: { title: '', date: '2026-07-16', time: '', category: 'etc' } }
    },
    pendingLifeRecordRequest: {
      requestId: 'life-record-1',
      action: {
        kind: 'expense',
        draft: { type: 'withdraw', amount: 4500, category: '카페', memo: '커피', date: '2026-07-16', ignored: 'remove-me' },
        confirmationText: '커피 지출 미리보기',
        fingerprint: 'life-record:v1:expense:1234abcd',
        ignored: 'remove-me'
      },
      ignored: 'remove-me'
    },
    mode: 'assistant',
    messages: [{ id: 'm1', role: 'user', content: '일반 질문' }]
  }]);
  storage.cacheThreads('pc-thread', 'codex', [{
    id: 'codex-1',
    appThreadId: 'codex-1',
    codexThreadId: 'sdk-codex',
    mode: 'codex',
    projectId: 'project-1',
    messages: [{ id: 'm2', role: 'assistant', content: '개발 답변' }]
  }]);

  assert.equal(storage.readCachedThreads('pc-thread', 'assistant')[0].codexThreadId, 'sdk-general');
  assert.equal(storage.readCachedThreads('pc-thread', 'assistant')[0].localOnly, true);
  assert.equal(storage.readCachedThreads('pc-thread', 'assistant')[0].pendingScheduleRequest.action.draft.date, '2026-07-16');
  assert.deepEqual(storage.readCachedThreads('pc-thread', 'assistant')[0].pendingLifeRecordRequest, {
    requestId: 'life-record-1',
    action: {
      kind: 'expense',
      draft: { type: 'withdraw', amount: 4500, category: '카페', memo: '커피', date: '2026-07-16' },
      confirmationText: '커피 지출 미리보기',
      fingerprint: 'life-record:v1:expense:1234abcd'
    }
  });
  assert.equal(storage.readCachedThreads('pc-thread', 'codex')[0].codexThreadId, 'sdk-codex');
  assert.equal(storage.readCachedThreads('pc-thread', 'assistant')[0].messages[0].content, '일반 질문');
  assert.equal(storage.readCachedThreads('pc-thread', 'codex')[0].projectId, 'project-1');
});

test('생활 기록 대기 상태는 로컬 thread에서 종류별 허용 필드만 복원한다', async () => {
  const localStorage = memoryStorage();
  globalThis.window = { localStorage, dispatchEvent() {} };
  const storage = await import(`./bridgeStorage.js?life-record-thread-test=${Date.now()}`);
  localStorage.setItem('lifehub.bridge.threads:v1', JSON.stringify({
    'pc-life:assistant': [
      {
        id: 'valid-local',
        localOnly: true,
        pendingLifeRecordRequest: {
          requestId: 'request-valid',
          action: {
            kind: 'diet',
            draft: { mealType: 'lunch', food: '김밥', calories: 650, date: '2026-07-16', html: '<script>' },
            confirmationText: '점심 김밥 미리보기',
            fingerprint: 'life-record:v1:diet:abcdef12',
            arbitraryCapability: 'file:write'
          },
          token: 'must-not-restore'
        }
      },
      {
        id: 'invalid-local',
        localOnly: true,
        pendingLifeRecordRequest: {
          requestId: 'request-invalid',
          action: {
            kind: 'expense',
            draft: { type: 'deposit', amount: -1, memo: '잘못된 값', date: '2026-02-30' },
            fingerprint: 'not-a-fingerprint'
          }
        }
      },
      {
        id: 'remote-thread',
        localOnly: false,
        pendingLifeRecordRequest: {
          requestId: 'request-remote',
          action: {
            kind: 'memo',
            draft: { title: '', body: '복원되면 안 됨', tags: [] },
            fingerprint: 'life-record:v1:memo:1234abcd'
          }
        }
      }
    ]
  }));

  const rows = storage.readCachedThreads('pc-life', 'assistant');
  assert.deepEqual(rows[0].pendingLifeRecordRequest, {
    requestId: 'request-valid',
    action: {
      kind: 'diet',
      draft: { mealType: 'lunch', food: '김밥', calories: 650, date: '2026-07-16' },
      confirmationText: '점심 김밥 미리보기',
      fingerprint: 'life-record:v1:diet:abcdef12'
    }
  });
  assert.equal(rows[1].pendingLifeRecordRequest, null);
  assert.equal(rows[2].pendingLifeRecordRequest, null);
  assert.equal(JSON.stringify(rows).includes('must-not-restore'), false);
  assert.equal(JSON.stringify(rows).includes('arbitraryCapability'), false);
});
