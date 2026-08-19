export const NATIVE_NOTIFICATION_PERMISSION_EVENT = 'lifehub:native-notification-permission';
export const NATIVE_EXACT_ALARM_PERMISSION_EVENT = 'lifehub:native-exact-alarm-permission';

const PERMISSION_STATES = new Set(['granted', 'default', 'denied', 'unsupported']);

function defaultTarget() {
  return typeof window === 'undefined' ? null : window;
}

function nativeApi(target) {
  return target?.AiAssistantNative || null;
}

function isAllowedInternalPath(value) {
  if (typeof value !== 'string'
      || value.length < 1
      || value.length > 512
      || !value.startsWith('/')
      || value.startsWith('//')
      || value.includes('\\')
      || value.includes('#')
      || value.includes('://')
      || value.includes('..')
      || /[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }
  const route = value.split('?', 1)[0];
  return route === '/app' || route === '/schedule';
}

function parsedValue(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function normalizedPermission(raw) {
  const parsed = parsedValue(raw);
  const value = typeof parsed === 'object'
    ? parsed?.permission ?? parsed?.status
    : parsed;
  const permission = String(value || '').toLowerCase();
  return PERMISSION_STATES.has(permission) ? permission : null;
}

export function nativeNotificationCapabilities(target = defaultTarget()) {
  const native = nativeApi(target);
  if (typeof native?.getNotificationCapabilities !== 'function') return null;
  try {
    const value = parsedValue(native.getNotificationCapabilities());
    return value
      && typeof value === 'object'
      && value.nativeNotifications === true
      ? value
      : null;
  } catch {
    return null;
  }
}

export function hasNativeNotificationApi(target = defaultTarget()) {
  const native = nativeApi(target);
  return Boolean(
    nativeNotificationCapabilities(target)
    && typeof native?.getNotificationPermission === 'function'
    && typeof native?.requestNotificationPermission === 'function'
    && typeof native?.showNotification === 'function'
    && typeof native?.replaceScheduledNotifications === 'function'
  );
}

export function nativeNotificationPermissionState(target = defaultTarget()) {
  if (!hasNativeNotificationApi(target)) return null;
  try {
    return normalizedPermission(nativeApi(target).getNotificationPermission());
  } catch {
    return null;
  }
}

export function nativeExactAlarmPermissionState(target = defaultTarget()) {
  const native = nativeApi(target);
  if (!hasNativeNotificationApi(target)
      || typeof native?.getExactAlarmPermission !== 'function') {
    return null;
  }
  try {
    return normalizedPermission(native.getExactAlarmPermission());
  } catch {
    return null;
  }
}

function requestId() {
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `notification-${suffix}`;
}

export function requestNativeNotificationPermission({
  target = defaultTarget(),
  timeoutMs = 30000
} = {}) {
  const current = nativeNotificationPermissionState(target);
  if (current === null) return Promise.resolve(null);
  if (current === 'granted' || current === 'denied' || current === 'unsupported') {
    return Promise.resolve(current);
  }
  const native = nativeApi(target);
  const id = requestId();
  return new Promise((resolve) => {
    let settled = false;
    const setTimer = typeof target?.setTimeout === 'function'
      ? target.setTimeout.bind(target)
      : globalThis.setTimeout;
    const clearTimer = typeof target?.clearTimeout === 'function'
      ? target.clearTimeout.bind(target)
      : globalThis.clearTimeout;
    const finish = (permission) => {
      if (settled) return;
      settled = true;
      clearTimer(timer);
      target?.removeEventListener?.(NATIVE_NOTIFICATION_PERMISSION_EVENT, handlePermission);
      resolve(PERMISSION_STATES.has(permission) ? permission : 'default');
    };
    const handlePermission = (event) => {
      if (String(event?.detail?.requestId || '') !== id) return;
      finish(normalizedPermission(event?.detail) || 'default');
    };
    const timer = setTimer(() => {
      finish(nativeNotificationPermissionState(target) || 'default');
    }, timeoutMs);
    target?.addEventListener?.(NATIVE_NOTIFICATION_PERMISSION_EVENT, handlePermission);
    try {
      if (native.requestNotificationPermission(id) === false) {
        finish(nativeNotificationPermissionState(target) || 'default');
      }
    } catch {
      finish(nativeNotificationPermissionState(target) || 'default');
    }
  });
}

export function requestNativeExactAlarmPermission({
  target = defaultTarget(),
  timeoutMs = 30000
} = {}) {
  const current = nativeExactAlarmPermissionState(target);
  if (current === null) return Promise.resolve(null);
  if (current === 'granted' || current === 'unsupported') {
    return Promise.resolve(current);
  }
  const native = nativeApi(target);
  if (typeof native?.requestExactAlarmPermission !== 'function') {
    return Promise.resolve(current);
  }
  const id = requestId();
  return new Promise((resolve) => {
    let settled = false;
    const setTimer = typeof target?.setTimeout === 'function'
      ? target.setTimeout.bind(target)
      : globalThis.setTimeout;
    const clearTimer = typeof target?.clearTimeout === 'function'
      ? target.clearTimeout.bind(target)
      : globalThis.clearTimeout;
    const finish = (permission) => {
      if (settled) return;
      settled = true;
      clearTimer(timer);
      target?.removeEventListener?.(NATIVE_EXACT_ALARM_PERMISSION_EVENT, handlePermission);
      resolve(PERMISSION_STATES.has(permission) ? permission : 'default');
    };
    const handlePermission = (event) => {
      if (String(event?.detail?.requestId || '') !== id) return;
      finish(normalizedPermission(event?.detail) || 'default');
    };
    const timer = setTimer(() => {
      finish(nativeExactAlarmPermissionState(target) || 'default');
    }, timeoutMs);
    target?.addEventListener?.(NATIVE_EXACT_ALARM_PERMISSION_EVENT, handlePermission);
    try {
      if (native.requestExactAlarmPermission(id) === false) {
        finish(nativeExactAlarmPermissionState(target) || 'default');
      }
    } catch {
      finish(nativeExactAlarmPermissionState(target) || 'default');
    }
  });
}

export function replaceNativeScheduledNotifications(notifications, target = defaultTarget()) {
  if (!hasNativeNotificationApi(target)) return null;
  if (!Array.isArray(notifications)
      || notifications.length > 128
      || notifications.some((notification) => !isAllowedInternalPath(notification?.path))) {
    return false;
  }
  try {
    return nativeApi(target).replaceScheduledNotifications(JSON.stringify(notifications)) === true;
  } catch {
    return false;
  }
}

export function showNativeNotification(notification, target = defaultTarget()) {
  if (!hasNativeNotificationApi(target)) return null;
  const id = String(notification?.id || '');
  const title = String(notification?.title || '');
  const body = String(notification?.body || '');
  const path = String(notification?.path || '');
  if (!id || !title || !isAllowedInternalPath(path)) return false;
  try {
    return nativeApi(target).showNotification(id, title, body, path) === true;
  } catch {
    return false;
  }
}

export function stableNativeNotificationId(prefix, key) {
  const source = `${prefix}:${String(key || '')}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${String(prefix || 'notification').replace(/[^a-z0-9._:-]/gi, '-').slice(0, 48)}-${(hash >>> 0).toString(36)}`;
}

export function shouldDeliverNativeNotification(documentTarget = globalThis.document) {
  if (!documentTarget) return true;
  const focused = typeof documentTarget.hasFocus === 'function'
    ? documentTarget.hasFocus()
    : false;
  return documentTarget.visibilityState !== 'visible' || !focused;
}
