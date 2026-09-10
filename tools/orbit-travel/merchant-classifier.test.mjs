import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTravelServer } from './server.mjs';
import { classifyMerchants } from './merchant-classifier.mjs';

test('classifier requires search evidence, allowed category and public source', async () => {
  const input = { merchants: ['새상점'], categories: ['기타', '식비'] };
  const answer = { results: [{ merchant: '새상점', category: '식비', confidence: 'high', source: 'https://example.com' }] };
  const run = async options => { assert.deepEqual(JSON.parse(options.prompt), input); return options.validate(answer); };
  assert.equal((await classifyMerchants(input, { run }))[0].category, '기타');
  const searched = async options => { options.onProgress('여행 장소와 참고 정보를 확인하고 있어요.'); return run(options); };
  assert.equal((await classifyMerchants(input, { run: searched }))[0].category, '식비');
  answer.results[0].source = '[공식 안내](https://example.com/business)';
  assert.equal((await classifyMerchants(input, { run: searched }))[0].category, '식비');
  answer.results[0].confidence = 'low'; assert.equal((await classifyMerchants(input, { run: searched }))[0].category, '기타');
  answer.results[0].confidence = 'high'; answer.results[0].source = 'http://127.0.0.1';
  assert.equal((await classifyMerchants(input, { run: searched }))[0].category, '기타');
});
test('merchant API authenticates, limits input, serializes work and deduplicates requests', async t => {
  let calls = 0, finish;
  const server = createTravelServer({ token: 'a'.repeat(64), pairingCode: '12345678', merchantClassify: async input => {
    calls++; assert.deepEqual(Object.keys(input).sort(), ['categories', 'merchants']);
    await new Promise(resolve => { finish = resolve; });
    return [{ merchant: '새상점', category: '식비', source: 'https://example.com' }];
  } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { finish?.(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); });
  const call = async (path, body, auth = true) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/travel/${path}`, { method: body ? 'POST' : 'GET', headers: { Origin: 'https://appassets.androidplatform.net', Authorization: auth ? `Bearer ${'a'.repeat(64)}` : '', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, value: await response.json() };
  };
  const body = { id: randomUUID(), merchants: ['새상점'], categories: ['기타', '식비'] };
  assert.equal((await call('merchant/jobs', body, false)).status, 401);
  assert.equal((await call('merchant/jobs', { ...body, merchants: ['계좌 123456789'] })).status, 400);
  assert.equal((await call('merchant/jobs', { ...body, amount: 'must not forward' })).status, 202);
  assert.equal((await call('merchant/jobs', body)).status, 200); assert.equal(calls, 1);
  assert.equal((await call('merchant/jobs', { ...body, id: randomUUID() })).status, 409);
  assert.equal((await call('status')).value.busy, true);
  finish(); await new Promise(resolve => setTimeout(resolve, 20));
  const result = await call('merchant/jobs/' + body.id);
  assert.equal(result.value.state, 'completed'); assert.equal(result.value.results[0].category, '식비');
  assert.equal((await call('status')).value.busy, false);
});
