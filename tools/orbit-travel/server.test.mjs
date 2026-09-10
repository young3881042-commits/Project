import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createTravelServer } from './server.mjs';
import { newTravelDraft } from '../../apps/web/src/features/travel/travelModel.js';

const input = { ...newTravelDraft('2026-10-10'), destination: '서울', days: 1 };
const plan = { title: '서울', summary: '산책', days: [{ day: 1, title: '공원', items: [{ time: '10:00', title: '산책', place: '서울숲', description: '쉬어가기', transport: '', estimatedCost: '' }] }], tips: [], sources: [] };
async function setup(t, options = {}) {
  const token = 'a'.repeat(64);
  const server = createTravelServer({ token, pairingCode: '12345678', generate: async () => plan, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.close(); server.closeAllConnections(); });
  const request = (path, { method = 'GET', body, headers = {} } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: `/api/travel/${path}`, method, headers: { Origin: 'https://appassets.androidplatform.net', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers } }, res => {
      let data = ''; res.setEncoding('utf8'); res.on('data', chunk => { data += chunk; }); res.on('end', () => resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {}, headers: res.headers }));
    }); req.on('error', reject); req.end(body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
  });
  return { request, server };
}
test('local API rejects untrusted Host, Origin, forwarded requests and wrong credentials', async t => {
  const { request } = await setup(t);
  assert.equal((await request('status')).status, 200);
  for (const headers of [{ Host: 'evil.example' }, { Origin: 'https://evil.example' }, { 'X-Forwarded-For': '127.0.0.1' }, { Origin: 'null' }]) assert.equal((await request('status', { headers })).status, 403);
  assert.equal((await request('status', { headers: { Authorization: '' } })).status, 401);
  assert.equal((await request('status')).headers['cache-control'], 'no-store');
});
test('pairing is single use, expires, limits attempts and handles non-ASCII guesses safely', async t => {
  const { request } = await setup(t);
  assert.equal((await request('pair', { method: 'POST', body: { code: '가나다라마바사아' } })).status, 401);
  assert.equal((await request('pair', { method: 'POST', body: { code: '12345678' } })).data.token.length, 64);
  assert.equal((await request('pair', { method: 'POST', body: { code: '12345678' } })).status, 429);
  assert.equal((await request('pair-code', { method: 'POST', body: {}, headers: { Authorization: '' } })).status, 401);
  const refreshed = await request('pair-code', { method: 'POST', body: {} });
  assert.match(refreshed.data.code, /^\d{8}$/);
  assert.equal((await request('pair', { method: 'POST', body: { code: refreshed.data.code } })).status, 200);
  let time = 0; const expiring = await setup(t, { now: () => time }); time = 600001;
  assert.equal((await expiring.request('pair', { method: 'POST', body: { code: '12345678' } })).status, 429);
  const limited = await setup(t);
  for (let i = 0; i < 10; i++) await limited.request('pair', { method: 'POST', body: { code: '00000000' } });
  assert.equal((await limited.request('pair', { method: 'POST', body: { code: '12345678' } })).status, 429);
});
test('create/poll sanitizes input, validates output, and duplicate requests never spawn twice', async t => {
  let calls = 0;
  const { request } = await setup(t, { generate: async received => { calls += 1; assert.equal(received.secret, undefined); return plan; } });
  const requestId = randomUUID(), body = { requestId, input: { ...input, secret: 'private' } };
  assert.equal((await request('jobs', { method: 'POST', body })).status, 202);
  const polled = await request(`jobs/${requestId}`);
  assert.equal(polled.data.state, 'completed'); assert.equal(polled.data.result.days[0].date, input.startDate);
  assert.equal((await request('jobs', { method: 'POST', body })).status, 200); assert.equal(calls, 1);
  assert.equal((await request('jobs', { method: 'POST', body: { ...body, input: { ...input, days: 2 } } })).status, 409);
});
test('generation is bounded to one active job and supports cancellation', async t => {
  let aborted = false;
  const { request } = await setup(t, { generate: async (_, { signal }) => new Promise(resolve => { signal.addEventListener('abort', () => { aborted = true; resolve(plan); }); }) });
  const id = randomUUID(); await request('jobs', { method: 'POST', body: { requestId: id, input } });
  assert.equal((await request('jobs', { method: 'POST', body: { requestId: randomUUID(), input } })).status, 409);
  assert.equal((await request(`jobs/${id}`, { method: 'DELETE' })).data.state, 'cancelled');
  assert.equal(aborted, true); assert.equal((await request(`jobs/${id}`)).data.result, undefined);
});
test('API rejects oversized, malformed, out-of-scope and invalid travel requests', async t => {
  const { request } = await setup(t);
  assert.equal((await request('jobs', { method: 'POST', body: '{' })).status, 400);
  assert.equal((await request('jobs', { method: 'POST', body: 'x'.repeat(17000) })).status, 413);
  assert.equal((await request('jobs', { method: 'POST', body: {}, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await request('jobs', { method: 'POST', body: { requestId: randomUUID(), input: { ...input, days: 100 } } })).status, 400);
  assert.equal((await request('exec', { method: 'POST', body: { command: 'echo' } })).status, 404);
  assert.equal((await request(`jobs/${randomUUID()}`)).status, 404);
});
test('invalid generation output is never exposed as a completed plan', async t => {
  const { request } = await setup(t, { generate: async () => ({ ...plan, days: [] }) });
  const id = randomUUID(); await request('jobs', { method: 'POST', body: { requestId: id, input } });
  const response = await request(`jobs/${id}`);
  assert.equal(response.data.state, 'failed'); assert.equal(response.data.result, undefined);
});

test('on-demand server sleeps when idle but keeps active and unread results alive', async t => {
  let time = 0, complete;
  const { request, server } = await setup(t, { now: () => time, idleMs: 20,
    generate: () => new Promise(resolve => { complete = resolve; }) });
  const id = randomUUID();
  await request('jobs', { method: 'POST', body: { requestId: id, input } });
  time = 100;
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(server.listening, 'active generation must survive idle deadline');
  complete(plan);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(server.listening, 'unread result must survive idle deadline');
  assert.equal((await request(`jobs/${id}`)).data.state, 'completed');
  const closed = new Promise(resolve => server.once('close', resolve));
  time = 200;
  await closed;
  assert.equal(server.listening, false);
});

test('the same saved credential authenticates after server restart without pairing again', async t => {
  const first = await setup(t);
  const credential = (await first.request('pair', { method: 'POST', body: { code: '12345678' } })).data.token;
  first.server.close(); first.server.closeAllConnections();
  const restarted = await setup(t, { token: credential, pairingCode: '87654321' });
  assert.equal((await restarted.request('status', { headers: { Authorization: `Bearer ${credential}` } })).status, 200);
  assert.equal((await restarted.request('status', { headers: { Authorization: 'Bearer wrong' } })).status, 401);
});
