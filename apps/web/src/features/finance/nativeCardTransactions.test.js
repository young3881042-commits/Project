import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CARD_IMPORT_SOURCE_IDS,
  CARD_IMPORT_SOURCES,
  NATIVE_CARD_IMPORT_RESULT_EVENT,
  NativeCardImportError,
  acknowledgePendingCardTransactions,
  configureNativeCardImport,
  hasNativeCardImportApi,
  nativeCardImportCapabilities,
  normalizeNativeCardCandidate,
  openNativeCardImportAppSettings,
  openNativeCardNotificationAccessSettings,
  requestPendingCardTransactions
} from './nativeCardTransactions.js';

const occurredAt = Date.parse('2026-08-19T01:23:45.000Z');
const allSources = [...CARD_IMPORT_SOURCE_IDS];

function candidate(overrides = {}) {
  return {
    eventId: 'wallet:v1:event-1',
    source: 'samsung-wallet',
    amount: 4500,
    merchant: '오비트카페',
    occurredAt,
    ...overrides
  };
}

function resultEvent(detail) {
  const event = new Event(NATIVE_CARD_IMPORT_RESULT_EVENT);
  Object.defineProperty(event, 'detail', { value: detail });
  return event;
}

function nativeTarget(overrides = {}) {
  const target = new EventTarget();
  target.setTimeout = globalThis.setTimeout;
  target.clearTimeout = globalThis.clearTimeout;
  target.AiAssistantNative = {
    getCardImportCapabilities() {
      return JSON.stringify({
        schemaVersion: 1,
        nativeCardImport: true,
        supported: true,
        access: 'enabled',
        supportedSources: allSources,
        availableSources: CARD_IMPORT_SOURCES,
        selectedSources: ['samsung-wallet'],
        pendingCount: 2
      });
    },
    configureCardImport() { return true; },
    openCardNotificationAccessSettings() { return true; },
    openAppDetailsSettings() { return true; },
    requestPendingCardTransactions() { return true; },
    resolvePendingCardTransactions() { return true; },
    ...overrides
  };
  return target;
}

test('native 카드 capability와 설정 API는 정확한 메서드 집합에서만 열린다', () => {
  const target = nativeTarget();
  assert.equal(hasNativeCardImportApi(target), true);
  assert.deepEqual(nativeCardImportCapabilities(target), {
    schemaVersion: 1,
    nativeCardImport: true,
    access: 'enabled',
    supportedSources: allSources,
    selectedSources: ['samsung-wallet'],
    pendingCount: 2
  });
  assert.equal(configureNativeCardImport({ owner: 'GuestUser', sources: ['samsung-wallet', 'bad'], target }), true);
  assert.equal(openNativeCardNotificationAccessSettings(target), true);
  assert.equal(openNativeCardImportAppSettings(target), true);
  assert.equal(hasNativeCardImportApi({ AiAssistantNative: {} }), false);
});

test('native capability는 두 source의 정확한 ID, 순서, label 외에는 fail-closed 한다', () => {
  const capabilities = {
    schemaVersion: 1,
    nativeCardImport: true,
    supported: true,
    access: 'enabled',
    supportedSources: allSources,
    availableSources: CARD_IMPORT_SOURCES,
    selectedSources: allSources,
    pendingCount: 0
  };
  const withCapabilities = (overrides) => nativeTarget({
    getCardImportCapabilities() {
      return JSON.stringify({ ...capabilities, ...overrides });
    }
  });

  assert.deepEqual(
    nativeCardImportCapabilities(withCapabilities({})).selectedSources,
    allSources
  );
  assert.equal(nativeCardImportCapabilities(withCapabilities({
    supportedSources: ['samsung-wallet']
  })), null);
  assert.equal(nativeCardImportCapabilities(withCapabilities({
    supportedSources: [...allSources, 'unknown-pay']
  })), null);
  assert.equal(nativeCardImportCapabilities(withCapabilities({
    availableSources: CARD_IMPORT_SOURCES.map((source) => (
      source.id === 'kakao-pay' ? { ...source, label: '카카오' } : source
    ))
  })), null);
  assert.equal(nativeCardImportCapabilities(withCapabilities({
    selectedSources: ['kakao-pay', 'samsung-wallet']
  })), null);
  assert.equal(nativeCardImportCapabilities(withCapabilities({
    selectedSources: ['samsung-wallet', 'unknown-pay']
  })), null);
  assert.equal(nativeCardImportCapabilities(nativeTarget({
    getCardImportCapabilities() {
      return JSON.stringify({ ...capabilities, unexpected: true });
    }
  })), null);
});

test('candidate는 허용된 최소 필드만 받고 원문·잔액·계좌처럼 보이는 값을 거부한다', () => {
  assert.deepEqual(normalizeNativeCardCandidate(candidate()), candidate());
  assert.deepEqual(
    normalizeNativeCardCandidate(candidate({ source: 'kakao-pay' })).source,
    'kakao-pay'
  );
  assert.equal(normalizeNativeCardCandidate({ ...candidate(), rawText: '원문' }), null);
  assert.equal(normalizeNativeCardCandidate(candidate({ merchant: '잔액 12,000원' })), null);
  assert.equal(normalizeNativeCardCandidate(candidate({ merchant: '계좌 110-123-456789' })), null);
  assert.equal(normalizeNativeCardCandidate(candidate({ merchant: 'Available balance' })), null);
  assert.equal(normalizeNativeCardCandidate(candidate({ merchant: 'KB국민 ****1234' })), null);
  assert.equal(normalizeNativeCardCandidate(candidate({ amount: 0 })), null);
  assert.equal(normalizeNativeCardCandidate(candidate({ amount: 1_000_000_000 })), null);
  assert.equal(normalizeNativeCardCandidate(candidate({ source: 'unknown-card-app' })), null);
});

test('peek은 matching requestId의 strict batch만 반환한다', async () => {
  let requested = null;
  const target = nativeTarget({
    requestPendingCardTransactions(requestId, owner, sourcesJson) {
      requested = { requestId, owner, sources: JSON.parse(sourcesJson) };
      queueMicrotask(() => {
        target.dispatchEvent(resultEvent({
          schemaVersion: 1,
          requestId: 'different-request',
          operation: 'peek',
          ok: true,
          access: 'enabled',
          pendingCount: 1,
          items: [candidate()],
          error: null
        }));
        target.dispatchEvent(resultEvent({
          schemaVersion: 1,
          requestId,
          operation: 'peek',
          ok: true,
          access: 'enabled',
          pendingCount: 1,
          items: [candidate()],
          error: null
        }));
      });
      return true;
    }
  });
  const result = await requestPendingCardTransactions({
    owner: 'GuestUser',
    sources: ['kakao-pay', 'samsung-wallet'],
    target,
    timeoutMs: 1000
  });
  assert.match(requested.requestId, /^card-import-peek-/);
  assert.equal(requested.owner, 'guestuser');
  assert.deepEqual(requested.sources, allSources);
  assert.deepEqual(result.items, [candidate()]);
});

test('peek 결과에 native 원문 필드나 malformed candidate가 섞이면 batch 전체를 fail-closed 한다', async () => {
  const target = nativeTarget({
    requestPendingCardTransactions(requestId) {
      queueMicrotask(() => target.dispatchEvent(resultEvent({
        schemaVersion: 1,
        requestId,
        operation: 'peek',
        ok: true,
        access: 'enabled',
        pendingCount: 1,
        items: [{ ...candidate(), notificationText: '전체 알림' }],
        error: null
      })));
      return true;
    }
  });
  await assert.rejects(
    requestPendingCardTransactions({ owner: 'guestuser', sources: ['samsung-wallet'], target }),
    (error) => error instanceof NativeCardImportError && error.code === 'invalid_result'
  );
});

test('resolve는 saved/duplicate 결정만 native로 보내고 전체 ack 결과를 확인한다', async () => {
  let nativeDecisions = null;
  const target = nativeTarget({
    resolvePendingCardTransactions(requestId, owner, decisionsJson) {
      nativeDecisions = JSON.parse(decisionsJson);
      queueMicrotask(() => target.dispatchEvent(resultEvent({
        schemaVersion: 1,
        requestId,
        operation: 'resolve',
        ok: true,
        access: 'enabled',
        pendingCount: 0,
        resolvedEventIds: nativeDecisions.map((item) => item.eventId),
        error: null
      })));
      return true;
    }
  });
  const result = await acknowledgePendingCardTransactions({
    owner: 'guestuser',
    decisions: [
      { eventId: 'wallet:v1:event-1', status: 'saved' },
      { eventId: 'wallet:v1:event-2', status: 'duplicate' }
    ],
    target,
    timeoutMs: 1000
  });
  assert.deepEqual(nativeDecisions, [
    { eventId: 'wallet:v1:event-1', status: 'saved' },
    { eventId: 'wallet:v1:event-2', status: 'duplicate' }
  ]);
  assert.deepEqual(result.resolvedEventIds, ['wallet:v1:event-1', 'wallet:v1:event-2']);
  await assert.rejects(
    acknowledgePendingCardTransactions({
      owner: 'guestuser',
      decisions: [{ eventId: 'wallet:v1:event-3', status: 'discarded' }],
      target
    }),
    (error) => error.code === 'invalid_argument'
  );
});

test('동일 target의 요청을 직렬화하고 완료 뒤 잠금을 해제한다', async () => {
  let firstId = '';
  const target = nativeTarget({
    requestPendingCardTransactions(requestId) {
      firstId ||= requestId;
      return true;
    }
  });
  const first = requestPendingCardTransactions({
    owner: 'guestuser',
    sources: ['samsung-wallet'],
    target,
    timeoutMs: 1000
  });
  await assert.rejects(
    requestPendingCardTransactions({ owner: 'guestuser', sources: ['samsung-wallet'], target }),
    (error) => error.code === 'busy'
  );
  target.dispatchEvent(resultEvent({
    schemaVersion: 1,
    requestId: firstId,
    operation: 'peek',
    ok: true,
    access: 'enabled',
    pendingCount: 0,
    items: [],
    error: null
  }));
  await first;
});
