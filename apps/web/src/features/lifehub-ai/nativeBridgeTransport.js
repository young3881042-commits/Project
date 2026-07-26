const RESPONSE_EVENT = 'lifehub:native-bridge-response';
const STREAM_EVENT = 'lifehub:native-bridge-stream';

function nativeApi() {
  return typeof window === 'undefined' ? null : window.AiAssistantNative || null;
}

export function hasNativeBridgeApi() {
  return Boolean(nativeApi());
}

export function nativeBridgeCapabilities() {
  const native = nativeApi();
  if (typeof native?.getBridgeCapabilities !== 'function') return null;
  try {
    const raw = native.getBridgeCapabilities();
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object') return null;
    return value.nativeTransport === true
      && value.secureTokenStorage === 'android-keystore'
      && value.tokenExport === false
      ? value
      : null;
  } catch {
    return null;
  }
}

function requestId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function parseBody(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return { message: String(value).slice(0, 500) };
  }
}

function cancelNative(id) {
  try {
    nativeApi()?.bridgeCancel?.(id);
  } catch {
    // The native task may already have completed.
  }
}

export function canUseNativeHttpTransport(baseUrl, stream = false) {
  let protocol = '';
  try {
    protocol = new URL(baseUrl).protocol;
  } catch {
    return false;
  }
  const native = nativeApi();
  const capabilities = nativeBridgeCapabilities();
  return (protocol === 'http:' || protocol === 'https:')
    && capabilities?.nativeTransport === true
    && capabilities?.[protocol.slice(0, -1)] === true
    && typeof native?.bridgeRequest === 'function'
    && (!stream || (typeof native?.bridgeStream === 'function' && typeof native?.bridgeCancel === 'function'));
}

export function nativeBridgeRequest({ url, method, body, tokenKey = '', signal, timeoutMs = 15000 }) {
  const native = nativeApi();
  if (!native || typeof native.bridgeRequest !== 'function') return Promise.reject(new Error('Native Bridge transport is unavailable.'));
  const id = requestId('request');
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener(RESPONSE_EVENT, handleResponse);
      signal?.removeEventListener('abort', handleAbort);
    };
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const handleAbort = () => finish(() => {
      cancelNative(id);
      reject(new DOMException('Aborted', 'AbortError'));
    });
    const handleResponse = (event) => {
      const detail = event?.detail || {};
      if (String(detail.requestId || detail.id || '') !== id) return;
      finish(() => {
        const status = Number(detail.status || detail.statusCode || 0);
        const payload = parseBody(detail.body ?? detail.payload ?? detail.data);
        resolve({
          ok: detail.ok === true || (status >= 200 && status < 300),
          status,
          payload,
          error: detail.error ? String(detail.error.message || 'Native Bridge 요청에 실패했습니다.') : '',
          errorCode: detail.error ? String(detail.error.code || '') : ''
        });
      });
    };
    const timer = window.setTimeout(() => finish(() => {
      cancelNative(id);
      reject(new DOMException('Timeout', 'TimeoutError'));
    }), timeoutMs);
    window.addEventListener(RESPONSE_EVENT, handleResponse);
    if (signal) {
      if (signal.aborted) {
        handleAbort();
        return;
      }
      signal.addEventListener('abort', handleAbort, { once: true });
    }
    try {
      const accepted = native.bridgeRequest(id, url, method, body === undefined ? '' : JSON.stringify(body), tokenKey);
      if (accepted === false) finish(() => reject(new Error('Native Bridge request was rejected.')));
    } catch {
      finish(() => reject(new Error('Native Bridge request failed to start.')));
    }
  });
}

export function nativeBridgeStream({ url, tokenKey, lastEventId = 0, signal, onEvent }) {
  const native = nativeApi();
  if (!native || typeof native.bridgeStream !== 'function') return Promise.reject(new Error('Native Bridge stream is unavailable.'));
  const id = requestId('stream');
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.removeEventListener(STREAM_EVENT, handleStream);
      signal?.removeEventListener('abort', handleAbort);
    };
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const handleAbort = () => finish(() => {
      cancelNative(id);
      reject(new DOMException('Aborted', 'AbortError'));
    });
    const handleStream = (event) => {
      const detail = event?.detail || {};
      if (String(detail.requestId || detail.id || '') !== id) return;
      const kind = String(detail.kind || detail.type || '').toLowerCase();
      if (kind === 'error' || detail.error) {
        finish(() => reject(new Error(String(detail.error?.message || detail.message || 'Native Bridge stream failed.'))));
        return;
      }
      if (kind === 'end' || kind === 'done' || kind === 'closed' || detail.done === true) {
        finish(resolve);
        return;
      }
      if (kind === 'cancelled') {
        finish(() => reject(new DOMException('Aborted', 'AbortError')));
        return;
      }
      if (kind === 'open' || kind === 'connected') return;
      const rawData = detail.data ?? detail.payload ?? detail.body;
      const data = parseBody(rawData);
      onEvent({
        event: String(detail.event || detail.eventType || data?.type || 'message'),
        id: String(detail.eventId || detail.lastEventId || data?.id || ''),
        data
      });
    };
    window.addEventListener(STREAM_EVENT, handleStream);
    if (signal) {
      if (signal.aborted) {
        handleAbort();
        return;
      }
      signal.addEventListener('abort', handleAbort, { once: true });
    }
    try {
      const accepted = native.bridgeStream(id, url, tokenKey, String(lastEventId || 0));
      if (accepted === false) finish(() => reject(new Error('Native Bridge stream was rejected.')));
    } catch {
      finish(() => reject(new Error('Native Bridge stream failed to start.')));
    }
  });
}
