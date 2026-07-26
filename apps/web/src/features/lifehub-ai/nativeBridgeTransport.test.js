import test from 'node:test';
import assert from 'node:assert/strict';
import { canUseNativeHttpTransport, nativeBridgeRequest, nativeBridgeStream } from './nativeBridgeTransport.js';

function eventWithDetail(type, detail) {
  const event = new Event(type);
  Object.defineProperty(event, 'detail', { value: detail });
  return event;
}

test('Android native request 응답의 JSON body를 파싱한다', async () => {
  const target = new EventTarget();
  target.setTimeout = globalThis.setTimeout;
  target.clearTimeout = globalThis.clearTimeout;
  target.AiAssistantNative = {
    getBridgeCapabilities() {
      return JSON.stringify({ nativeTransport: true, http: true, https: true, secureTokenStorage: 'android-keystore', tokenExport: false });
    },
    bridgeRequest(requestId) {
      queueMicrotask(() => target.dispatchEvent(eventWithDetail('lifehub:native-bridge-response', {
        requestId,
        ok: true,
        status: 200,
        body: '{"connected":true}',
        contentType: 'application/json',
        error: null
      })));
      return true;
    },
    bridgeCancel() { return true; }
  };
  globalThis.window = target;

  const response = await nativeBridgeRequest({ url: 'http://pc:4317/api/device/status', method: 'GET', tokenKey: 'lifehub.bridge.token:pc' });
  assert.equal(response.ok, true);
  assert.deepEqual(response.payload, { connected: true });
});

test('Android native SSE event union을 웹 SSE frame으로 변환한다', async () => {
  const target = new EventTarget();
  target.AiAssistantNative = {
    getBridgeCapabilities() {
      return JSON.stringify({ nativeTransport: true, http: true, https: true, secureTokenStorage: 'android-keystore', tokenExport: false });
    },
    bridgeRequest() { return true; },
    bridgeStream(requestId) {
      queueMicrotask(() => {
        target.dispatchEvent(eventWithDetail('lifehub:native-bridge-stream', { requestId, type: 'open', status: 200, contentType: 'text/event-stream' }));
        target.dispatchEvent(eventWithDetail('lifehub:native-bridge-stream', {
          requestId,
          type: 'event',
          event: 'message.delta',
          data: '{"id":7,"type":"message.delta","data":{"delta":"안녕"}}',
          id: '7',
          retry: null
        }));
        target.dispatchEvent(eventWithDetail('lifehub:native-bridge-stream', { requestId, type: 'end' }));
      });
      return true;
    },
    bridgeCancel() { return true; }
  };
  globalThis.window = target;
  const frames = [];
  await nativeBridgeStream({
    url: 'http://pc:4317/api/threads/thread-1/events',
    tokenKey: 'lifehub.bridge.token:pc',
    onEvent: (frame) => frames.push(frame)
  });

  assert.equal(frames.length, 1);
  assert.equal(frames[0].event, 'message.delta');
  assert.equal(frames[0].data.data.delta, '안녕');
});

test('Android에서는 HTTP와 HTTPS Bridge 요청을 모두 native transport로 제한한다', () => {
  globalThis.window = {
    AiAssistantNative: {
      getBridgeCapabilities() {
        return JSON.stringify({ nativeTransport: true, http: true, https: true, secureTokenStorage: 'android-keystore', tokenExport: false });
      },
      bridgeRequest() { return true; },
      bridgeStream() { return true; },
      bridgeCancel() { return true; }
    }
  };

  assert.equal(canUseNativeHttpTransport('http://pc:4317'), true);
  assert.equal(canUseNativeHttpTransport('https://pc.tailnet.example', true), true);
  assert.equal(canUseNativeHttpTransport('ftp://pc'), false);
});

test('비신뢰 origin처럼 capability가 없으면 native 메서드가 보여도 사용하지 않는다', () => {
  globalThis.window = {
    AiAssistantNative: {
      getBridgeCapabilities() { return null; },
      bridgeRequest() { return true; },
      bridgeStream() { return true; },
      bridgeCancel() { return true; }
    }
  };
  assert.equal(canUseNativeHttpTransport('http://pc:4317'), false);
});
