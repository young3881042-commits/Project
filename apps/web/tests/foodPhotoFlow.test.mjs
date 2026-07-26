import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFoodPhotoReadyState,
  shouldAbortFoodPhotoAnalysis
} from '../src/components/diet/food-photo/useFoodPhotoAnalyzer.js';
import { LifeHubBridgeClient } from '../src/features/lifehub-ai/bridgeClient.js';

const BRIDGE_RESULT = {
  foodName: '김치볶음밥',
  caloriesKcal: 619.6,
  carbohydratesGrams: 88.04,
  proteinGrams: 18.05,
  fatGrams: 22,
  confidence: 0.824,
  notes: '보이는 양 약 1그릇 기준'
};

function eventWithDetail(type, detail) {
  const event = new Event(type);
  Object.defineProperty(event, 'detail', { value: detail });
  return event;
}

test('연결 폴링의 일시적 checking은 진행 중 사진 분석을 취소하지 않는다', () => {
  assert.equal(shouldAbortFoodPhotoAnalysis('connected', 'analyzing'), false);
  assert.equal(shouldAbortFoodPhotoAnalysis('checking', 'analyzing'), false);
  assert.equal(shouldAbortFoodPhotoAnalysis('checking', 'ready'), false);

  for (const kind of ['offline', 'disconnected', 'revoked', 'unpaired']) {
    assert.equal(shouldAbortFoodPhotoAnalysis(kind, 'analyzing'), true, kind);
    assert.equal(shouldAbortFoodPhotoAnalysis(kind, 'ready'), false, `${kind} ready`);
  }
});

test('APK 클라이언트가 사진 data URL을 전송하고 Bridge 결과를 ready 표시 상태로 변환한다', async () => {
  let received;
  const originalWindow = globalThis.window;
  const target = new EventTarget();
  target.setTimeout = globalThis.setTimeout;
  target.clearTimeout = globalThis.clearTimeout;
  target.AiAssistantNative = {
    getBridgeCapabilities() {
      return JSON.stringify({
        nativeTransport: true,
        http: true,
        https: true,
        secureTokenStorage: 'android-keystore',
        tokenExport: false
      });
    },
    bridgeRequest(requestId, url, method, body, tokenKey) {
      received = { url, method, body: JSON.parse(body), tokenKey };
      queueMicrotask(() => target.dispatchEvent(eventWithDetail(
        'lifehub:native-bridge-response',
        { requestId, ok: true, status: 200, body: JSON.stringify(BRIDGE_RESULT) }
      )));
      return true;
    },
    bridgeCancel() { return true; }
  };
  globalThis.window = target;

  let ready;
  try {
    const client = new LifeHubBridgeClient({
      baseUrl: 'https://pc.example',
      tokenKey: 'lifehub.bridge.token:paired-pc',
      getToken: () => { throw new Error('APK는 보안 토큰을 JavaScript로 읽지 않아야 합니다.'); }
    });
    const imageDataUrl = 'data:image/jpeg;base64,/9j/2Q==';
    const response = await client.analyzeFood({ imageDataUrl });
    ready = createFoodPhotoReadyState(response);

    assert.deepEqual(received, {
      method: 'POST',
      url: 'https://pc.example/api/food/analyze',
      body: { imageDataUrl },
      tokenKey: 'lifehub.bridge.token:paired-pc'
    });
  } finally {
    globalThis.window = originalWindow;
  }

  assert.deepEqual(ready, {
    status: 'ready',
    message: '먹은 양을 확인하고 바로 기록하거나 입력칸에서 수정해주세요.',
    analysis: {
      foodName: '김치볶음밥',
      caloriesKcal: 620,
      carbohydratesGrams: 88,
      proteinGrams: 18.1,
      fatGrams: 22,
      confidence: 0.82,
      notes: '보이는 양 약 1그릇 기준'
    }
  });
});
