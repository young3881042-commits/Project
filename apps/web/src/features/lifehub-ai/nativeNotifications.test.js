import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasNativeNotificationApi,
  nativeExactAlarmPermissionState,
  nativeNotificationPermissionState,
  replaceNativeScheduledNotifications,
  requestNativeExactAlarmPermission,
  requestNativeNotificationPermission,
  shouldDeliverNativeNotification,
  showNativeNotification,
  stableNativeNotificationId
} from './nativeNotifications.js';

function permissionEvent(requestId, permission) {
  const event = new Event('lifehub:native-notification-permission');
  Object.defineProperty(event, 'detail', { value: { requestId, permission } });
  return event;
}

function exactAlarmPermissionEvent(requestId, permission) {
  const event = new Event('lifehub:native-exact-alarm-permission');
  Object.defineProperty(event, 'detail', { value: { requestId, permission } });
  return event;
}

function nativeTarget(overrides = {}) {
  const target = new EventTarget();
  target.setTimeout = globalThis.setTimeout;
  target.clearTimeout = globalThis.clearTimeout;
  target.AiAssistantNative = {
    getNotificationCapabilities() {
      return JSON.stringify({ nativeNotifications: true, scheduledNotifications: true, backgroundDelivery: true });
    },
    getNotificationPermission() { return 'granted'; },
    requestNotificationPermission() { return true; },
    showNotification() { return true; },
    replaceScheduledNotifications() { return true; },
    ...overrides
  };
  return target;
}

test('Android native 알림 capability와 권한 상태를 확인한다', () => {
  const target = nativeTarget();
  assert.equal(hasNativeNotificationApi(target), true);
  assert.equal(nativeNotificationPermissionState(target), 'granted');
  assert.equal(hasNativeNotificationApi(new EventTarget()), false);
});

test('exact alarm 메서드는 선택 기능이며 권한 상태를 정규화한다', () => {
  const legacyTarget = nativeTarget();
  assert.equal(hasNativeNotificationApi(legacyTarget), true);
  assert.equal(nativeExactAlarmPermissionState(legacyTarget), null);
  assert.equal(nativeExactAlarmPermissionState(nativeTarget({
    getExactAlarmPermission() { return 'granted'; }
  })), 'granted');
  assert.equal(nativeExactAlarmPermissionState(nativeTarget({
    getExactAlarmPermission() { return { permission: 'default' }; }
  })), 'default');
  assert.equal(nativeExactAlarmPermissionState(nativeTarget({
    getExactAlarmPermission() { return JSON.stringify({ status: 'denied' }); }
  })), 'denied');
});

test('exact alarm 권한 응답은 일치하는 requestId만 처리한다', async () => {
  let requestedId = '';
  const target = nativeTarget({
    getExactAlarmPermission() { return 'default'; },
    requestExactAlarmPermission(requestId) {
      requestedId = requestId;
      queueMicrotask(() => {
        target.dispatchEvent(exactAlarmPermissionEvent('different-request', 'denied'));
        target.dispatchEvent(exactAlarmPermissionEvent(requestId, 'granted'));
      });
      return true;
    }
  });
  assert.equal(await requestNativeExactAlarmPermission({ target, timeoutMs: 1000 }), 'granted');
  assert.match(requestedId, /^notification-/);
});

test('거절된 exact alarm 권한도 설정 화면에서 다시 요청할 수 있다', async () => {
  let requested = false;
  const target = nativeTarget({
    getExactAlarmPermission() { return 'denied'; },
    requestExactAlarmPermission(requestId) {
      requested = true;
      queueMicrotask(() => {
        target.dispatchEvent(exactAlarmPermissionEvent(requestId, 'granted'));
      });
      return true;
    }
  });
  assert.equal(await requestNativeExactAlarmPermission({ target, timeoutMs: 1000 }), 'granted');
  assert.equal(requested, true);
});

test('exact alarm 권한 요청이 false를 반환하거나 예외를 던지면 현재 상태로 끝낸다', async () => {
  const rejectedTarget = nativeTarget({
    getExactAlarmPermission() { return 'default'; },
    requestExactAlarmPermission() { return false; }
  });
  const throwingTarget = nativeTarget({
    getExactAlarmPermission() { return 'default'; },
    requestExactAlarmPermission() { throw new Error('native failure'); }
  });
  assert.equal(await requestNativeExactAlarmPermission({ target: rejectedTarget }), 'default');
  assert.equal(await requestNativeExactAlarmPermission({ target: throwingTarget }), 'default');
});

test('exact alarm 권한 이벤트가 없으면 timeout 시점의 상태를 다시 확인한다', async () => {
  let permission = 'default';
  const target = nativeTarget({
    getExactAlarmPermission() { return permission; },
    requestExactAlarmPermission() {
      permission = 'denied';
      return true;
    }
  });
  assert.equal(await requestNativeExactAlarmPermission({ target, timeoutMs: 5 }), 'denied');
});

test('Android 13 알림 권한 응답을 requestId로 연결한다', async () => {
  const target = nativeTarget({
    getNotificationPermission() { return 'default'; },
    requestNotificationPermission(requestId) {
      queueMicrotask(() => target.dispatchEvent(permissionEvent(requestId, 'granted')));
      return true;
    }
  });
  assert.equal(await requestNativeNotificationPermission({ target, timeoutMs: 1000 }), 'granted');
});

test('일정 알림 목록과 즉시 알림을 네이티브 알림 API로 전달한다', () => {
  let scheduled = null;
  let immediate = null;
  const target = nativeTarget({
    replaceScheduledNotifications(payload) {
      scheduled = JSON.parse(payload);
      return true;
    },
    showNotification(...args) {
      immediate = args;
      return true;
    }
  });
  const rows = [{ id: 'routine-1', title: '운동', body: '시작할 시간이에요.', path: '/schedule?edit=1', triggerAt: Date.now() + 60000 }];
  assert.equal(replaceNativeScheduledNotifications(rows, target), true);
  assert.deepEqual(scheduled, rows);
  assert.equal(showNativeNotification({ id: 'routine-now', title: '운동 시간', body: '일정을 확인하세요.', path: '/schedule' }, target), true);
  assert.deepEqual(immediate, ['routine-now', '운동 시간', '일정을 확인하세요.', '/schedule']);
  assert.equal(showNativeNotification({ id: 'legacy-ai', title: '이전 기능', path: '/ai' }, target), false);
  assert.equal(replaceNativeScheduledNotifications([
    { id: 'legacy-ai', title: '이전 기능', path: '/ai', triggerAt: Date.now() + 60000 }
  ], target), false);
});

test('포커스가 없는 화면에서만 시스템 알림을 선택한다', () => {
  assert.equal(shouldDeliverNativeNotification({ visibilityState: 'visible', hasFocus: () => true }), false);
  assert.equal(shouldDeliverNativeNotification({ visibilityState: 'hidden', hasFocus: () => false }), true);
  assert.equal(stableNativeNotificationId('routine', 'schedule-1:event-2'), stableNativeNotificationId('routine', 'schedule-1:event-2'));
});
