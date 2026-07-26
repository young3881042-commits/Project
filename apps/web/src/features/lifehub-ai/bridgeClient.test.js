import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BridgeError,
  claimPairing,
  LifeHubBridgeClient,
  normalizeBridgeBaseUrl,
  PAIRING_CLAIM_POLL_INTERVAL_MS,
  pollPairingClaim,
  requestLocalBridgeConnection,
  requestPairing
} from './bridgeClient.js';

function eventWithDetail(type, detail) {
  const event = new Event(type);
  Object.defineProperty(event, 'detail', { value: detail });
  return event;
}

test('Bridge URL은 명시된 호스트와 포트만 정규화한다', () => {
  assert.equal(normalizeBridgeBaseUrl('192.0.2.10', '4317'), 'http://192.0.2.10:4317');
  assert.equal(normalizeBridgeBaseUrl('https://pc.tailnet.example/path?q=1'), 'https://pc.tailnet.example');
});

test('Bridge URL에 자격 증명이나 잘못된 포트를 허용하지 않는다', () => {
  assert.throws(() => normalizeBridgeBaseUrl('http://user:secret@localhost:4317'), /HTTP 또는 HTTPS/);
  assert.throws(() => normalizeBridgeBaseUrl('localhost', '70000'), /1~65535/);
});

test('페어링 요청과 claim은 Bridge 계약의 필드만 전송한다', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ status: 'pending' }), {
      status: 202,
      headers: { 'content-type': 'application/json' }
    });
  };
  try {
    await requestPairing({
      address: 'localhost',
      port: '4317',
      code: '123456',
      deviceName: '테스트 폰',
      permissions: { chat: true, projectRead: true, fileWrite: true }
    });
    await claimPairing({
      address: 'localhost',
      port: '4317',
      requestId: 'pair_1',
      requestSecret: 'temporary-secret'
    });
    await requestLocalBridgeConnection({
      address: 'localhost',
      port: '4317',
      deviceName: 'Orbit 로컬 웹'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requests[0].body, {
    code: '123456',
    deviceName: '테스트 폰',
    requestedPermissions: ['chat', 'project:read', 'file:write']
  });
  assert.deepEqual(requests[1].body, { requestId: 'pair_1', requestSecret: 'temporary-secret' });
  assert.equal(requests[2].url, 'http://localhost:4317/api/local/connect');
  assert.deepEqual(requests[2].body, { deviceName: 'Orbit 로컬 웹' });
});

test('Android 페어링은 5초 간격으로 claim하고 승인 즉시 secure token 영수증을 받는다', async () => {
  const originalWindow = globalThis.window;
  const target = new EventTarget();
  target.setTimeout = globalThis.setTimeout;
  target.clearTimeout = globalThis.clearTimeout;
  const requests = [];
  target.AiAssistantNative = {
    getBridgeCapabilities() {
      return JSON.stringify({ nativeTransport: true, http: true, https: true, secureTokenStorage: 'android-keystore', tokenExport: false });
    },
    bridgeRequest(requestId, url, method, body, tokenKey) {
      requests.push({ url, method, body: JSON.parse(body), tokenKey });
      const pending = requests.length === 1;
      const payload = pending
        ? { requestId: 'pair_1', status: 'pending' }
        : {
          requestId: 'pair_1',
          status: 'approved',
          bridge: { id: 'bridge_1', name: 'Orbit PC' },
          device: { id: 'device_1', permissions: ['chat'] },
          tokenStored: true,
          tokenKey: 'lifehub.bridge.token:device_1'
        };
      queueMicrotask(() => target.dispatchEvent(eventWithDetail('lifehub:native-bridge-response', {
        requestId,
        ok: true,
        status: pending ? 202 : 200,
        body: JSON.stringify(payload)
      })));
      return true;
    },
    bridgeCancel() { return true; }
  };
  globalThis.window = target;
  const waits = [];

  try {
    const result = await pollPairingClaim({
      address: 'https://pc.example',
      port: '443',
      requestId: 'pair_1',
      requestSecret: 'temporary-secret'
    }, {
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      wait: async (delay) => { waits.push(delay); }
    });

    assert.equal(PAIRING_CLAIM_POLL_INTERVAL_MS, 5000);
    assert.deepEqual(waits, [5000]);
    assert.equal(requests.length, 2);
    for (const request of requests) {
      assert.equal(request.url, 'https://pc.example/api/pair/approve');
      assert.equal(request.method, 'POST');
      assert.equal(request.tokenKey, '');
      assert.deepEqual(request.body, { requestId: 'pair_1', requestSecret: 'temporary-secret' });
    }
    assert.equal(result.tokenStored, true);
    assert.equal(result.tokenKey, 'lifehub.bridge.token:device_1');
    assert.equal(result.device.id, 'device_1');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('Android status 0 네트워크·timeout 오류 뒤에는 자동 claim을 재개하고 계약 오류는 중단한다', async () => {
  const originalWindow = globalThis.window;

  try {
    for (const transientCode of ['network_error', 'timeout']) {
      const target = new EventTarget();
      target.setTimeout = globalThis.setTimeout;
      target.clearTimeout = globalThis.clearTimeout;
      let attempts = 0;
      const waits = [];
      const retries = [];
      target.AiAssistantNative = {
        getBridgeCapabilities() {
          return JSON.stringify({ nativeTransport: true, http: true, https: true, secureTokenStorage: 'android-keystore', tokenExport: false });
        },
        bridgeRequest(requestId) {
          attempts += 1;
          const detail = attempts === 1
            ? {
              requestId,
              ok: false,
              status: 0,
              body: '',
              error: { code: transientCode, message: 'Bridge could not be reached.' }
            }
            : {
              requestId,
              ok: true,
              status: 200,
              body: JSON.stringify({
                requestId: `pair_${transientCode}`,
                status: 'approved',
                device: { id: `device_${transientCode}` },
                tokenStored: true,
                tokenKey: `lifehub.bridge.token:device_${transientCode}`
              })
            };
          queueMicrotask(() => target.dispatchEvent(eventWithDetail('lifehub:native-bridge-response', detail)));
          return true;
        },
        bridgeCancel() { return true; }
      };
      globalThis.window = target;

      const result = await pollPairingClaim({
        address: 'https://pc.example',
        port: '443',
        requestId: `pair_${transientCode}`,
        requestSecret: 'temporary-secret'
      }, {
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        wait: async (delay) => { waits.push(delay); },
        onRetry: (error) => { retries.push({ code: error.code, status: error.status, retryable: error.retryable }); }
      });

      assert.equal(attempts, 2, transientCode);
      assert.deepEqual(waits, [PAIRING_CLAIM_POLL_INTERVAL_MS], transientCode);
      assert.deepEqual(retries, [{ code: transientCode, status: 0, retryable: true }], transientCode);
      assert.equal(result.device.id, `device_${transientCode}`);
    }

    const terminalFailures = [
      {
        name: 'contract',
        status: 0,
        body: '',
        error: { code: 'invalid_pairing_response', message: 'Bridge returned an invalid pairing response.' },
        expectedCode: 'invalid_pairing_response'
      },
      {
        name: 'authentication',
        status: 401,
        body: JSON.stringify({ error: { code: 'INVALID_PAIR_CLAIM', message: 'Pairing claim is invalid.' } }),
        error: { code: 'http_error', message: 'Bridge returned HTTP 401.' },
        expectedCode: 'INVALID_PAIR_CLAIM'
      }
    ];
    for (const terminal of terminalFailures) {
      const target = new EventTarget();
      target.setTimeout = globalThis.setTimeout;
      target.clearTimeout = globalThis.clearTimeout;
      let attempts = 0;
      let waits = 0;
      target.AiAssistantNative = {
        getBridgeCapabilities() {
          return JSON.stringify({ nativeTransport: true, http: true, https: true, secureTokenStorage: 'android-keystore', tokenExport: false });
        },
        bridgeRequest(requestId) {
          attempts += 1;
          queueMicrotask(() => target.dispatchEvent(eventWithDetail('lifehub:native-bridge-response', {
            requestId,
            ok: false,
            status: terminal.status,
            body: terminal.body,
            error: terminal.error
          })));
          return true;
        },
        bridgeCancel() { return true; }
      };
      globalThis.window = target;

      await assert.rejects(
        pollPairingClaim({
          address: 'https://pc.example',
          port: '443',
          requestId: `pair_${terminal.name}`,
          requestSecret: 'temporary-secret'
        }, {
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          wait: async () => { waits += 1; }
        }),
        (error) => error.code === terminal.expectedCode && error.status === terminal.status && error.retryable === false,
        terminal.name
      );
      assert.equal(attempts, 1, terminal.name);
      assert.equal(waits, 0, terminal.name);
    }
  } finally {
    globalThis.window = originalWindow;
  }
});

test('페어링 claim 폴링은 일시적 연결 오류를 재시도하고 요청 만료와 취소에서 즉시 중단한다', async () => {
  let attempts = 0;
  const waits = [];
  const retries = [];
  const result = await pollPairingClaim({ requestId: 'pair_retry', requestSecret: 'secret' }, {
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    intervalMs: 1,
    claimRequest: async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new BridgeError('잠시 연결되지 않음', { code: 'NETWORK_ERROR', retryable: true });
      }
      return { status: 'approved', device: { id: 'device_retry' } };
    },
    wait: async (delay) => { waits.push(delay); },
    onRetry: (error) => { retries.push(error.code); }
  });
  assert.equal(attempts, 2);
  assert.deepEqual(waits, [5000]);
  assert.deepEqual(retries, ['NETWORK_ERROR']);
  assert.equal(result.device.id, 'device_retry');

  let expiredClaimed = false;
  await assert.rejects(
    pollPairingClaim({ requestId: 'pair_expired', requestSecret: 'secret' }, {
      expiresAt: new Date(Date.now() - 1).toISOString(),
      claimRequest: async () => { expiredClaimed = true; }
    }),
    (error) => error.status === 410 && error.code === 'EXPIRED_PAIR_REQUEST'
  );
  assert.equal(expiredClaimed, false);

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    pollPairingClaim({ requestId: 'pair_cancelled', requestSecret: 'secret' }, {
      signal: controller.signal,
      claimRequest: async () => { throw new Error('claim should not start'); }
    }),
    (error) => error.name === 'AbortError'
  );
});

test('Android 백그라운드 복귀와 네트워크 재연결은 5초 대기를 즉시 깨우고 claim을 한 번만 재시도한다', async () => {
  for (const wakeKind of ['online', 'visible']) {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const eventWindow = new EventTarget();
    const eventDocument = new EventTarget();
    eventDocument.visibilityState = 'hidden';
    eventDocument.hidden = true;
    let timerCallback = null;
    let clearedTimers = 0;
    let attempts = 0;
    globalThis.window = eventWindow;
    globalThis.document = eventDocument;
    globalThis.setTimeout = (callback) => {
      timerCallback = callback;
      return 7;
    };
    globalThis.clearTimeout = () => { clearedTimers += 1; };

    try {
      const resultPromise = pollPairingClaim(
        { requestId: `pair_${wakeKind}`, requestSecret: 'secret' },
        {
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          claimRequest: async () => {
            attempts += 1;
            return attempts === 1
              ? { status: 'pending' }
              : { status: 'approved', device: { id: `device_${wakeKind}` } };
          }
        }
      );
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(attempts, 1, wakeKind);

      if (wakeKind === 'online') {
        eventWindow.dispatchEvent(new Event('online'));
      } else {
        eventDocument.dispatchEvent(new Event('visibilitychange'));
        await Promise.resolve();
        assert.equal(attempts, 1, 'hidden visibilitychange must not wake polling');
        eventDocument.visibilityState = 'visible';
        eventDocument.hidden = false;
        eventDocument.dispatchEvent(new Event('visibilitychange'));
      }

      const result = await resultPromise;
      assert.equal(result.device.id, `device_${wakeKind}`);
      assert.equal(attempts, 2, wakeKind);
      assert.equal(clearedTimers, 1, wakeKind);

      eventWindow.dispatchEvent(new Event('online'));
      eventDocument.dispatchEvent(new Event('visibilitychange'));
      timerCallback?.();
      await Promise.resolve();
      assert.equal(attempts, 2, `${wakeKind} listeners must be removed after wake`);
    } finally {
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
  }
});

test('음식 사진 분석은 인증된 JSON을 전송하고 90초 timeout을 사용한다', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let request = null;
  let timeoutMs = 0;
  globalThis.window = undefined;
  globalThis.setTimeout = (_callback, delay) => {
    timeoutMs = delay;
    return 1;
  };
  globalThis.clearTimeout = () => {};
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ foodName: '비빔밥' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const client = new LifeHubBridgeClient({
      baseUrl: 'https://pc.example',
      getToken: () => 'device-token'
    });
    await client.analyzeFood({ imageDataUrl: 'data:image/jpeg;base64,YQ==' });
    assert.equal(request.url, 'https://pc.example/api/food/analyze');
    assert.equal(request.init.method, 'POST');
    assert.equal(request.init.headers.Authorization, 'Bearer device-token');
    assert.deepEqual(JSON.parse(request.init.body), { imageDataUrl: 'data:image/jpeg;base64,YQ==' });
    assert.equal(timeoutMs, 90000);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test('원격 명령은 프로젝트 경로를 인코딩하고 준비 승인 뒤 190초 실행 timeout을 사용한다', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const requests = [];
  const timeouts = [];
  globalThis.window = undefined;
  globalThis.setTimeout = (_callback, delay) => {
    timeouts.push(delay);
    return timeouts.length;
  };
  globalThis.clearTimeout = () => {};
  globalThis.fetch = async (url, init) => {
    requests.push({ url, init, body: JSON.parse(init.body) });
    const payload = url.endsWith('/prepare')
      ? { approval: { id: 'approval_1', command: 'git push', risk: 'high' } }
      : { result: { command: 'git push', stdout: 'Everything up-to-date', exitCode: 0 } };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    const client = new LifeHubBridgeClient({
      baseUrl: 'https://pc.example',
      getToken: () => 'device-token'
    });
    await client.prepareRemoteCommand('project/a b', { command: 'git push' });
    await client.executeRemoteCommand('project/a b', { approvalId: 'approval_1' });

    assert.equal(requests[0].url, 'https://pc.example/api/projects/project%2Fa%20b/commands/prepare');
    assert.equal(requests[1].url, 'https://pc.example/api/projects/project%2Fa%20b/commands/execute');
    assert.equal(requests[0].init.method, 'POST');
    assert.equal(requests[1].init.method, 'POST');
    assert.equal(requests[0].init.headers.Authorization, 'Bearer device-token');
    assert.equal(requests[1].init.headers.Authorization, 'Bearer device-token');
    assert.deepEqual(requests[0].body, { command: 'git push' });
    assert.deepEqual(requests[1].body, { approvalId: 'approval_1' });
    assert.deepEqual(timeouts, [15000, 190000]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test('Android HTTPS 요청은 토큰을 JS로 읽지 않고 native transport를 사용한다', async () => {
  const target = new EventTarget();
  target.setTimeout = globalThis.setTimeout;
  target.clearTimeout = globalThis.clearTimeout;
  let receivedTokenKey = '';
  target.AiAssistantNative = {
    getBridgeCapabilities() {
      return JSON.stringify({ nativeTransport: true, http: true, https: true, secureTokenStorage: 'android-keystore', tokenExport: false });
    },
    bridgeRequest(requestId, url, method, body, tokenKey) {
      receivedTokenKey = tokenKey;
      queueMicrotask(() => target.dispatchEvent(eventWithDetail('lifehub:native-bridge-response', {
        requestId,
        ok: true,
        status: 200,
        body: '{"ok":true}'
      })));
      return true;
    },
    bridgeCancel() { return true; }
  };
  globalThis.window = target;
  const client = new LifeHubBridgeClient({
    baseUrl: 'https://pc.tailnet.example',
    tokenKey: 'lifehub.bridge.token:pc',
    getToken: () => { throw new Error('JS token readback must not happen'); }
  });

  assert.deepEqual(await client.health(), { ok: true });
  assert.equal(receivedTokenKey, 'lifehub.bridge.token:pc');
});

test('Native object가 있는데 capability가 준비되지 않으면 fetch로 우회하지 않는다', async () => {
  const target = new EventTarget();
  target.AiAssistantNative = {
    getBridgeCapabilities() { return null; },
    bridgeRequest() { return false; }
  };
  globalThis.window = target;
  let fetched = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetched = true; throw new Error('must not fetch'); };
  try {
    const client = new LifeHubBridgeClient({ baseUrl: 'https://pc.example', tokenKey: 'lifehub.bridge.token:pc' });
    await assert.rejects(client.health(), (error) => error.code === 'NATIVE_BRIDGE_UNAVAILABLE');
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
