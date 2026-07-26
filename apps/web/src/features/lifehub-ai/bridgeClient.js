import { canUseNativeHttpTransport, hasNativeBridgeApi, nativeBridgeRequest, nativeBridgeStream } from './nativeBridgeTransport.js';

const DEFAULT_TIMEOUT_MS = 15000;
export const PAIRING_CLAIM_POLL_INTERVAL_MS = 5000;
const RETRYABLE_NATIVE_STATUS_ZERO_CODES = new Set([
  'network_error',
  'timeout',
  'connect_timeout',
  'read_timeout',
  'socket_timeout'
]);

export class BridgeError extends Error {
  constructor(message, { status = 0, code = 'BRIDGE_ERROR', retryable = false } = {}) {
    super(message);
    this.name = 'BridgeError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export function normalizeBridgeBaseUrl(address, port = '') {
  const raw = String(address || '').trim();
  if (!raw) throw new BridgeError('PC 주소를 입력해주세요.', { code: 'INVALID_ADDRESS' });
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new BridgeError('PC 주소 형식이 올바르지 않습니다.', { code: 'INVALID_ADDRESS' });
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new BridgeError('HTTP 또는 HTTPS PC 주소만 사용할 수 있습니다.', { code: 'INVALID_ADDRESS' });
  }
  if (port) {
    const parsedPort = Number(port);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      throw new BridgeError('포트는 1~65535 사이 숫자여야 합니다.', { code: 'INVALID_PORT' });
    }
    url.port = String(parsedPort);
  }
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.origin;
}

function responseMessage(payload, fallback) {
  return String(payload?.error?.message || payload?.message || payload?.error || fallback);
}

function isRetryableHttpStatus(status) {
  return status >= 500 || status === 408 || status === 429;
}

function isRetryableNativeFailure(status, code) {
  if (isRetryableHttpStatus(status)) return true;
  return status === 0 && RETRYABLE_NATIVE_STATUS_ZERO_CODES.has(String(code || '').trim().toLowerCase());
}

async function parseResponsePayload(response) {
  const contentType = response.headers.get('content-type') || '';
  if (response.status === 204) return null;
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  const text = await response.text();
  return text ? { message: text.slice(0, 500) } : null;
}

function mergeSignals(signal, timeoutMs) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort('timeout'), timeoutMs);
  const abort = () => controller.abort(signal?.reason || 'cancelled');
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup() {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  };
}

function parseSseFrame(frame) {
  let event = 'message';
  let id = '';
  const data = [];
  frame.split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith(':')) return;
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    const value = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '');
    if (field === 'event') event = value || event;
    if (field === 'id') id = value;
    if (field === 'data') data.push(value);
  });
  if (!data.length) return null;
  const raw = data.join('\n');
  let parsed = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Plain text deltas are valid SSE payloads.
  }
  return { event, id, data: parsed };
}

async function consumeSse(response, onEvent, signal) {
  if (!response.body?.getReader) {
    throw new BridgeError('이 환경은 스트리밍 응답을 지원하지 않습니다.', { code: 'STREAM_UNSUPPORTED' });
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || '';
      frames.forEach((frame) => {
        const parsed = parseSseFrame(frame);
        if (parsed) onEvent(parsed);
      });
      if (done) break;
    }
    if (buffer.trim()) {
      const parsed = parseSseFrame(buffer);
      if (parsed) onEvent(parsed);
    }
  } finally {
    reader.releaseLock();
  }
}

export class LifeHubBridgeClient {
  constructor({ baseUrl, getToken = null, tokenKey = '' }) {
    this.baseUrl = normalizeBridgeBaseUrl(baseUrl);
    this.getToken = getToken;
    this.tokenKey = tokenKey;
  }

  async headers({ authenticated = true, body = false, accept = 'application/json' } = {}) {
    const headers = { Accept: accept };
    if (body) headers['Content-Type'] = 'application/json';
    if (authenticated) {
      const token = await this.getToken?.();
      if (!token) throw new BridgeError('이 PC의 연결 토큰을 찾을 수 없습니다. 다시 페어링해주세요.', { status: 401, code: 'TOKEN_MISSING' });
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  async request(path, { method = 'GET', body, signal, authenticated = true, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new BridgeError('네트워크 연결이 끊겼습니다.', { code: 'OFFLINE', retryable: true });
    }
    const combined = mergeSignals(signal, timeoutMs);
    try {
      if (hasNativeBridgeApi() && !canUseNativeHttpTransport(this.baseUrl)) {
        throw new BridgeError('Android 보안 브리지가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.', {
          code: 'NATIVE_BRIDGE_UNAVAILABLE',
          retryable: true
        });
      }
      if (canUseNativeHttpTransport(this.baseUrl)) {
        const result = await nativeBridgeRequest({
          url: `${this.baseUrl}${path}`,
          method,
          body,
          tokenKey: authenticated ? this.tokenKey : '',
          signal: combined.signal,
          timeoutMs
        });
        if (!result.ok) {
          const code = String(result.payload?.error?.code || result.payload?.code || result.errorCode || 'HTTP_ERROR');
          throw new BridgeError(responseMessage(result.payload, result.error || `Bridge 요청에 실패했습니다 (${result.status}).`), {
            status: result.status,
            code,
            retryable: isRetryableNativeFailure(result.status, code)
          });
        }
        return result.payload;
      }
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: await this.headers({ authenticated, body: body !== undefined }),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: combined.signal,
        cache: 'no-store'
      });
      const payload = await parseResponsePayload(response);
      if (!response.ok) {
        throw new BridgeError(responseMessage(payload, `Bridge 요청에 실패했습니다 (${response.status}).`), {
          status: response.status,
          code: String(payload?.error?.code || payload?.code || 'HTTP_ERROR'),
          retryable: isRetryableHttpStatus(response.status)
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof BridgeError) throw error;
      if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
        const timedOut = error?.name === 'TimeoutError' || combined.signal.reason === 'timeout';
        throw new BridgeError(timedOut ? 'Bridge 응답 시간이 초과되었습니다.' : '요청을 중지했습니다.', {
          code: timedOut ? 'TIMEOUT' : 'CANCELLED',
          retryable: timedOut
        });
      }
      throw new BridgeError('PC Bridge에 연결할 수 없습니다.', { code: 'NETWORK_ERROR', retryable: true });
    } finally {
      combined.cleanup();
    }
  }

  health(options) { return this.request('/api/health', options); }
  deviceStatus(options) { return this.request('/api/device/status', options); }
  projects(options) { return this.request('/api/projects', options); }
  threads(options) { return this.request('/api/threads', options); }
  thread(threadId, options) { return this.request(`/api/threads/${encodeURIComponent(threadId)}`, options); }
  changes(threadId, options) { return this.request(`/api/threads/${encodeURIComponent(threadId)}/changes`, options); }

  prepareRemoteCommand(projectId, { command } = {}, options = {}) {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/commands/prepare`, {
      ...options,
      method: 'POST',
      body: { command: String(command || '') }
    });
  }

  executeRemoteCommand(projectId, { approvalId } = {}, options = {}) {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/commands/execute`, {
      ...options,
      method: 'POST',
      body: { approvalId: String(approvalId || '') },
      timeoutMs: options.timeoutMs || 190000
    });
  }

  createThread(input, options = {}) {
    return this.request('/api/threads', { ...options, method: 'POST', body: input });
  }

  sendMessage(threadId, input, options = {}) {
    return this.request(`/api/threads/${encodeURIComponent(threadId)}/messages`, {
      ...options,
      method: 'POST',
      body: input,
      timeoutMs: options.timeoutMs || 30000
    });
  }

  analyzeFood(input, options = {}) {
    return this.request('/api/food/analyze', {
      ...options,
      method: 'POST',
      body: input,
      timeoutMs: options.timeoutMs || 90000
    });
  }

  cancel(threadId, options = {}) {
    return this.request(`/api/threads/${encodeURIComponent(threadId)}/cancel`, { ...options, method: 'POST', body: {} });
  }

  approve(threadId, input, options = {}) {
    return this.request(`/api/threads/${encodeURIComponent(threadId)}/approve`, { ...options, method: 'POST', body: input });
  }

  reject(threadId, input, options = {}) {
    return this.request(`/api/threads/${encodeURIComponent(threadId)}/reject`, { ...options, method: 'POST', body: input });
  }

  revoke(input = {}, options = {}) {
    return this.request('/api/pair/revoke', { ...options, method: 'POST', body: input });
  }

  async streamEvents(threadId, { signal, onEvent, after = '' } = {}) {
    const query = after ? `?after=${encodeURIComponent(after)}` : '';
    const streamUrl = `${this.baseUrl}/api/threads/${encodeURIComponent(threadId)}/events${query}`;
    if (hasNativeBridgeApi() && !canUseNativeHttpTransport(this.baseUrl, true)) {
      throw new BridgeError('Android 보안 브리지의 스트리밍 기능이 아직 준비되지 않았습니다.', {
        code: 'NATIVE_BRIDGE_UNAVAILABLE',
        retryable: true
      });
    }
    if (canUseNativeHttpTransport(this.baseUrl, true)) {
      try {
        await nativeBridgeStream({
          url: streamUrl,
          tokenKey: this.tokenKey,
          lastEventId: after || 0,
          signal,
          onEvent
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        throw new BridgeError('스트리밍 연결을 열 수 없습니다.', { code: 'STREAM_NETWORK_ERROR', retryable: true });
      }
    }
    let response;
    try {
      const headers = await this.headers({ accept: 'text/event-stream' });
      if (after !== '' && after !== null && after !== undefined) headers['Last-Event-ID'] = String(after);
      response = await fetch(streamUrl, {
        method: 'GET',
        headers,
        signal,
        cache: 'no-store'
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new BridgeError('스트리밍 연결을 열 수 없습니다.', { code: 'STREAM_NETWORK_ERROR', retryable: true });
    }
    if (!response.ok) {
      const payload = await parseResponsePayload(response);
      throw new BridgeError(responseMessage(payload, '스트리밍 연결에 실패했습니다.'), {
        status: response.status,
        code: String(payload?.error?.code || payload?.code || 'STREAM_HTTP_ERROR'),
        retryable: response.status >= 500 || response.status === 429
      });
    }
    await consumeSse(response, onEvent, signal);
  }
}

export function createPairingClient(address, port) {
  return new LifeHubBridgeClient({ baseUrl: normalizeBridgeBaseUrl(address, port), getToken: null, tokenKey: '' });
}

export async function requestPairing({ address, port, code, deviceName, permissions }, options = {}) {
  const client = createPairingClient(address, port);
  const requestedPermissions = Array.isArray(permissions) ? permissions : [
    'chat',
    permissions?.projectRead ? 'project:read' : '',
    permissions?.fileWrite ? 'file:write' : '',
    permissions?.commandRun ? 'command:execute' : '',
    permissions?.buildRun ? 'build:execute' : '',
    permissions?.git ? 'git' : ''
  ].filter(Boolean);
  return client.request('/api/pair/request', {
    ...options,
    method: 'POST',
    authenticated: false,
    body: {
      code: String(code || '').trim(),
      deviceName: String(deviceName || '').trim(),
      requestedPermissions
    }
  });
}

export async function requestLocalBridgeConnection({ address, port, deviceName }, options = {}) {
  const client = createPairingClient(address, port);
  return client.request('/api/local/connect', {
    ...options,
    method: 'POST',
    authenticated: false,
    body: { deviceName: String(deviceName || '').trim() }
  });
}

export async function claimPairing({ address, port, requestId, requestSecret }, options = {}) {
  const client = createPairingClient(address, port);
  return client.request('/api/pair/approve', {
    ...options,
    method: 'POST',
    authenticated: false,
    body: {
      requestId: String(requestId || ''),
      requestSecret: String(requestSecret || '')
    }
  });
}

function pairingResponseData(payload) {
  return payload?.data && typeof payload.data === 'object' ? payload.data : payload || {};
}

export function isPairingClaimPending(payload) {
  return pairingResponseData(payload).status === 'pending';
}

function pairingPollAbortError() {
  return new DOMException('Aborted', 'AbortError');
}

function waitForPairingPoll(delayMs, signal) {
  if (signal?.aborted) return Promise.reject(pairingPollAbortError());
  return new Promise((resolve, reject) => {
    const eventWindow = typeof globalThis.window?.addEventListener === 'function'
      ? globalThis.window
      : null;
    const eventDocument = typeof globalThis.document?.addEventListener === 'function'
      ? globalThis.document
      : null;
    let settled = false;
    let timer = null;
    const cleanup = () => {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      eventWindow?.removeEventListener('online', wake);
      eventDocument?.removeEventListener('visibilitychange', wakeWhenVisible);
    };
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const wake = () => finish(resolve);
    const wakeWhenVisible = () => {
      if (eventDocument?.visibilityState === 'visible' || eventDocument?.hidden === false) wake();
    };
    const abort = () => finish(() => reject(pairingPollAbortError()));

    timer = globalThis.setTimeout(wake, delayMs);
    eventWindow?.addEventListener('online', wake);
    eventDocument?.addEventListener('visibilitychange', wakeWhenVisible);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function pollPairingClaim(input, {
  signal,
  expiresAt = '',
  intervalMs = PAIRING_CLAIM_POLL_INTERVAL_MS,
  onPending,
  onRetry,
  claimRequest = claimPairing,
  wait = waitForPairingPoll
} = {}) {
  const expiryMs = Date.parse(String(expiresAt || ''));
  const requestedDelayMs = Number(intervalMs);
  const delayMs = Number.isFinite(requestedDelayMs)
    ? Math.max(PAIRING_CLAIM_POLL_INTERVAL_MS, requestedDelayMs)
    : PAIRING_CLAIM_POLL_INTERVAL_MS;

  while (true) {
    if (signal?.aborted) throw pairingPollAbortError();
    if (Number.isFinite(expiryMs) && Date.now() >= expiryMs) {
      throw new BridgeError('페어링 요청이 만료되었습니다.', {
        status: 410,
        code: 'EXPIRED_PAIR_REQUEST'
      });
    }
    let response;
    try {
      response = await claimRequest(input, { signal });
    } catch (error) {
      if (signal?.aborted || error?.code === 'CANCELLED' || error?.name === 'AbortError') throw error;
      if (!error?.retryable) throw error;
      onRetry?.(error);
      await wait(delayMs, signal);
      continue;
    }
    if (!isPairingClaimPending(response)) return response;
    onPending?.(response);
    await wait(delayMs, signal);
  }
}
