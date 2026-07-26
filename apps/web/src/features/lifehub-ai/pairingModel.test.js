import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADVANCED_PERMISSION_OPTIONS,
  defaultBridgeEndpoint,
  initialPairingForm,
  localBridgeConnectionAvailable,
  pairingErrorNotice,
  pairingPayload,
  pairingToken,
  pendingPairingId
} from './pairingModel.js';

test('개발 환경은 로컬 Bridge와 원클릭 연결을 기본 사용한다', () => {
  assert.deepEqual(defaultBridgeEndpoint({ DEV: true }), { address: 'http://127.0.0.1', port: '4317' });
  assert.equal(initialPairingForm({ DEV: true }).deviceName, 'Orbit 로컬 웹');
  assert.equal(localBridgeConnectionAvailable({ DEV: true }, { hostname: 'localhost' }), true);
  assert.equal(localBridgeConnectionAvailable({ DEV: true }, { hostname: '192.0.2.10' }), false);
  assert.equal(localBridgeConnectionAvailable({
    DEV: true,
    VITE_LIFEHUB_BRIDGE_ADDRESS: 'https://bridge.example'
  }, { hostname: 'localhost' }), false);
  assert.equal(ADVANCED_PERMISSION_OPTIONS.length, 5);
});

test('배포 환경과 명시 설정은 로컬 개발 기본값을 덮어쓴다', () => {
  assert.deepEqual(defaultBridgeEndpoint({ DEV: false }), { address: 'https://bridge.example.invalid', port: '443' });
  assert.deepEqual(defaultBridgeEndpoint({
    DEV: true,
    VITE_LIFEHUB_BRIDGE_ADDRESS: 'http://localhost',
    VITE_LIFEHUB_BRIDGE_PORT: '5000'
  }), { address: 'http://localhost', port: '5000' });
});

test('Bridge 응답 형식 차이를 한 곳에서 정규화한다', () => {
  const response = { data: { requestId: 'pair_1', deviceToken: 'token_1' } };
  assert.deepEqual(pairingPayload(response), response.data);
  assert.equal(pairingToken(response), 'token_1');
  assert.equal(pendingPairingId(response), 'pair_1');
});

test('페어링 오류 문구와 입력 필드를 상태 코드로 정규화한다', () => {
  assert.deepEqual(pairingErrorNotice({ status: 410 }, false), {
    tone: 'error',
    field: 'code',
    text: '연결 승인 대기 시간이 만료됐습니다. 관리자 화면에서 새 코드를 발급받아 입력해주세요.'
  });
});
