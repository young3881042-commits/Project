import { TRAVEL_PORT } from './travelModel.js';

export const TRAVEL_RESULT_EVENT = 'orbit:travel-result';
const ACTIONS = new Set(['auth-info', 'runtime-enable', 'runtime-legacy', 'auth-status', 'auth-login', 'auth-cancel', 'availability', 'status', 'pair', 'create', 'poll', 'cancel', 'chat-list', 'chat-create', 'chat-thread', 'chat-send', 'chat-update', 'chat-cancel', 'merchant-create', 'merchant-poll']);
const TOKEN_KEY = 'orbit-travel-session-token'; // Browser development only; never part of an Orbit backup.
export class TravelApiError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}
export function travelApi(action, payload = {}, target = window) {
  if (!ACTIONS.has(action)) return Promise.reject(new TravelApiError('지원하지 않는 여행 요청이에요.'));
  if (target.AiAssistantNative?.requestTravelAction) {
    return new Promise((resolve, reject) => {
      const requestId = target.crypto.randomUUID();
      const cleanup = () => { clearTimeout(timer); target.removeEventListener(TRAVEL_RESULT_EVENT, receive); };
      const receive = event => {
        const detail = event.detail;
        if (detail?.requestId !== requestId) return;
        cleanup();
        if (detail.error) reject(new TravelApiError(detail.error, detail.status));
        else resolve(detail.data);
      };
      const timer = setTimeout(() => { cleanup(); reject(new TravelApiError('AI 연결 응답이 늦어요. 연결을 다시 확인해주세요.')); }, 20000);
      target.addEventListener(TRAVEL_RESULT_EVENT, receive);
      try { target.AiAssistantNative.requestTravelAction(requestId, action, JSON.stringify(payload)); }
      catch { cleanup(); reject(new TravelApiError('앱을 최신 버전으로 업데이트해주세요.')); }
    });
  }
  // An HTTPS/PWA deployment must not open a generic cleartext or remote proxy.
  if (!['http://127.0.0.1:5173', 'http://localhost:5173'].includes(target.location.origin)) {
    return Promise.reject(new TravelApiError('Termux 여행 생성은 최신 Orbit Android 앱에서 이용해주세요.'));
  }
  if (action === 'availability') return Promise.resolve({ automatic: false, mode: 'standby', embeddedSupported: false });
  if (action.startsWith('runtime-') || action.startsWith('auth-')) return Promise.reject(new TravelApiError('내장 AI는 Android 앱에서 이용해주세요.'));
  return browserTravelApi(action, payload, target);
}
async function browserTravelApi(action, payload, target) {
  const job = ['poll', 'cancel'].includes(action);
  if (job && !/^[a-f0-9-]{36}$/.test(payload.id || '')) throw new TravelApiError('요청 ID가 올바르지 않아요.');
  const chatSuffix = { 'chat-thread': '', 'chat-send': '/messages', 'chat-update': '/meta', 'chat-cancel': '/cancel' };
  if (action in chatSuffix && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(payload.id || '')) throw new TravelApiError('대화 ID가 올바르지 않아요.');
  const chatPath = ['chat-list', 'chat-create'].includes(action) ? 'chat/threads' : action in chatSuffix ? 'chat/threads/' + payload.id + chatSuffix[action] : '';
  const post = ['merchant-create', 'create', 'pair', 'chat-create', 'chat-send', 'chat-update', 'chat-cancel'].includes(action);
  if (action === 'merchant-poll' && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(payload.id || '')) throw new TravelApiError('분류 요청 ID가 올바르지 않아요.');
  const merchantPath = action === 'merchant-create' ? 'merchant/jobs' : action === 'merchant-poll' ? `merchant/jobs/${payload.id}` : '';
  const path = merchantPath || chatPath || (job ? `jobs/${payload.id}` : action === 'create' ? 'jobs' : action);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const token = target.sessionStorage.getItem(TOKEN_KEY) || '';
    const response = await target.fetch(`http://127.0.0.1:${TRAVEL_PORT}/api/travel/${path}`, {
      method: action === 'cancel' ? 'DELETE' : post ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(post ? { body: JSON.stringify(payload) } : {}),
      signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error'
    });
    const data = await response.json();
    if (!response.ok) throw new TravelApiError(data.error || '여행 연결에 실패했어요.', response.status);
    if (action === 'pair') { target.sessionStorage.setItem(TOKEN_KEY, data.token); return { connected: true }; }
    return data;
  } catch (error) {
    if (error instanceof TravelApiError) throw error;
    throw new TravelApiError('Termux 여행 연결이 꺼져 있어요. 연결 안내를 확인해주세요.');
  } finally { clearTimeout(timer); }
}
