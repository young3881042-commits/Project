import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { createEmbeddedAuth } from './embedded-auth.mjs';
import { createTravelServer } from './server.mjs';

function fakeServer(respond) {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.send = message => child.stdout.write(JSON.stringify(message) + '\n');
  child.stdin = new Writable({ write(bytes, _encoding, done) {
    for (const line of bytes.toString().trim().split('\n')) {
      const request = JSON.parse(line);
      if (request.id != null) queueMicrotask(() => respond(request, child));
    }
    done();
  } });
  child.kill = () => { child.killed = true; queueMicrotask(() => child.emit('close', 0)); };
  return child;
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('auth status exposes only ChatGPT connection, closes process and rejects API-key accounts', async () => {
  for (const type of ['chatgpt', 'apiKey']) {
    const child = fakeServer((req, child) => child.send({ id: req.id, result: req.method === 'account/read' ? { account: { type, email: 'private@example.com', accessToken: 'private-value' } } : {} }));
    const auth = createEmbeddedAuth({ binary: '/apk/liborbit_codex.so', spawnProcess: () => child });
    const result = await auth.status();
    assert.equal(result.connected, type === 'chatgpt');
    assert.equal(JSON.stringify(result).includes('private'), false);
    assert.equal(child.killed, true); assert.equal(auth.busy, false);
  }
});

test('login reuses pending code, tracks completion and stops auth process', async () => {
  let starts = 0;
  const child = fakeServer((req, child) => { if (req.method === 'account/login/start') starts++;
    child.send({ id: req.id, result: req.method === 'account/login/start' ? { verificationUrl: 'https://auth.openai.com/codex/device', userCode: 'ABCD-1234', loginId: 'private-login-id' } : {} }); });
  const auth = createEmbeddedAuth({ binary: '/apk/liborbit_codex.so', spawnProcess: () => child });
  assert.equal((await auth.login()).state, 'preparing'); await tick();
  assert.deepEqual(await auth.status(), { connected: false, state: 'pending', userCode: 'ABCD-1234' });
  await auth.login(); assert.equal(starts, 1);
  child.send({ method: 'account/login/completed', params: { success: true } });
  assert.deepEqual(await auth.status(), { connected: true, state: 'connected' });
  assert.equal(child.killed, true);
});

test('unsafe login page, cancellation, expiry and stalled RPC do not leave a process running', async () => {
  for (const kind of ['unsafe', 'cancel', 'expiry', 'timeout']) {
    const child = fakeServer((req, child) => {
      if (kind === 'timeout') return;
      child.send({ id: req.id, result: req.method === 'account/login/start' ? { verificationUrl: kind === 'unsafe' ? 'https://example.com' : 'https://auth.openai.com/codex/device', userCode: 'ABCD-1234' } : {} });
    });
    const auth = createEmbeddedAuth({ binary: '/apk/liborbit_codex.so', spawnProcess: () => child, timeoutMs: 20, loginMs: 20 });
    await auth.login(); await tick();
    if (kind === 'cancel') auth.cancel();
    await new Promise(resolve => setTimeout(resolve, 60));
    const status = await auth.status();
    assert.equal(status.connected, false); assert.equal(child.killed, true);
    auth.close();
  }
});

test('embedded auth is behind bearer and generation requires ChatGPT login', async t => {
  const token = 'a'.repeat(64);
  let checks = 0;
  const server = createTravelServer({ token, pairingCode: '12345678', embeddedAuth: {
    busy: false, close() {}, async status() { checks++; return { connected: false }; },
    async handle(req, _body, send) { if (req.url.endsWith('/auth/status')) { checks++; send(200, { connected: false }); return true; } return false; }
  }});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.close(); server.closeAllConnections(); });
  const base = `http://127.0.0.1:${server.address().port}/api/travel/`;
  const headers = { Origin: 'https://appassets.androidplatform.net', 'Content-Type': 'application/json' };
  assert.equal((await fetch(base + 'auth/status', { headers })).status, 401); assert.equal(checks, 0);
  headers.Authorization = `Bearer ${token}`;
  assert.equal((await fetch(base + 'auth/status', { headers })).status, 200);
  const response = await fetch(base + 'jobs', { method: 'POST', headers, body: '{}' });
  assert.equal(response.status, 401); assert.match((await response.json()).error, /ChatGPT/);
});
