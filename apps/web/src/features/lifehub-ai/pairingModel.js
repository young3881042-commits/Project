import { cleanPermissions } from './bridgeStorage.js';

export const PERMISSION_OPTIONS = [
  { key: 'chat', label: 'AI 대화·음식 분석', detail: '일반 대화, 응답 스트리밍과 음식 사진 분석', locked: true },
  { key: 'projectRead', label: '프로젝트 파일 읽기', detail: 'Bridge에 명시적으로 등록한 프로젝트만 읽기' },
  { key: 'fileWrite', label: '파일 수정', detail: '승인한 범위 안에서만 프로젝트 파일 변경' },
  { key: 'commandRun', label: '명령 실행', detail: '허용 목록 또는 별도 승인한 명령만 실행' },
  { key: 'buildRun', label: '빌드·테스트 실행', detail: '프로젝트 빌드와 테스트를 명시적으로 승인' },
  { key: 'git', label: 'Git 작업', detail: 'diff 확인과 명시적으로 승인한 Git 작업' }
];

export const ADVANCED_PERMISSION_OPTIONS = PERMISSION_OPTIONS.filter((permission) => !permission.locked);
export const LOCAL_BRIDGE_ADDRESS = 'http://127.0.0.1';
export const LOCAL_BRIDGE_PORT = '4317';
// Public builds must inject their own Bridge endpoint with VITE_LIFEHUB_BRIDGE_ADDRESS.
// A reserved hostname keeps an unconfigured Android build from targeting an operator host.
export const ORBIT_BRIDGE_ADDRESS = 'https://bridge.example.invalid';
export const ORBIT_BRIDGE_PORT = '443';

export function defaultBridgeEndpoint(env = import.meta.env || {}) {
  const configuredAddress = String(env.VITE_LIFEHUB_BRIDGE_ADDRESS || '').trim();
  const configuredPort = String(env.VITE_LIFEHUB_BRIDGE_PORT || '').trim();
  if (configuredAddress) {
    return { address: configuredAddress, port: configuredPort || ORBIT_BRIDGE_PORT };
  }
  if (env.DEV) return { address: LOCAL_BRIDGE_ADDRESS, port: LOCAL_BRIDGE_PORT };
  return { address: ORBIT_BRIDGE_ADDRESS, port: ORBIT_BRIDGE_PORT };
}

export function initialPairingForm(env = import.meta.env || {}) {
  const endpoint = defaultBridgeEndpoint(env);
  return {
    address: endpoint.address,
    port: endpoint.port,
    code: '',
    deviceName: env.DEV ? 'Orbit 로컬 웹' : 'Orbit 휴대폰',
    permissions: cleanPermissions({ chat: true })
  };
}

function isLoopbackHostname(hostname) {
  const normalized = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

export function localBridgeConnectionAvailable(env = import.meta.env || {}, location = globalThis.location) {
  if (!env.DEV || !isLoopbackHostname(location?.hostname)) return false;
  try {
    return isLoopbackHostname(new URL(defaultBridgeEndpoint(env).address).hostname);
  } catch {
    return false;
  }
}

export function pairingPayload(payload) {
  return payload?.data && typeof payload.data === 'object' ? payload.data : payload || {};
}

export function pairingToken(payload) {
  const data = pairingPayload(payload);
  return data.deviceToken || data.token || data.pairingToken || '';
}

export function pendingPairingId(payload) {
  const data = pairingPayload(payload);
  return String(data.requestId || data.pairingRequestId || '');
}

export function pairingErrorNotice(error, claimWasPending) {
  const text = error?.code === 'PAIR_REJECTED' || error?.status === 403
    ? '관리자가 연결 요청을 거절했습니다. 필요한 경우 새 코드를 발급받아 다시 시도해주세요.'
    : error?.status === 410
      ? '연결 승인 대기 시간이 만료됐습니다. 관리자 화면에서 새 코드를 발급받아 입력해주세요.'
      : error?.status === 409
        ? '이미 사용했거나 완료된 코드입니다. 관리자 화면에서 새 코드를 발급받아 입력해주세요.'
        : error?.status === 401 && claimWasPending
          ? '연결 확인 정보가 유효하지 않습니다. 관리자 화면에서 새 코드를 발급받아 입력해주세요.'
          : error?.status === 401
            ? '6자리 연결 코드가 올바르지 않습니다. 관리자 화면의 코드를 다시 확인해주세요.'
            : error.message;
  return {
    tone: 'error',
    field: [401, 409, 410].includes(error?.status) ? 'code' : undefined,
    text
  };
}
