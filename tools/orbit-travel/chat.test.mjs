import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createTravelServer } from './server.mjs';

async function fixture(t, options = {}) {
  const directory = options.chatDirectory || await mkdtemp(join(tmpdir(), 'orbit-chat-test-'));
  const server = createTravelServer({ token: 'a'.repeat(64), pairingCode: '12345678', chatDirectory: directory, chatReply: async () => '저장되는 한글 답변', ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); if (!options.chatDirectory) await rm(directory, { recursive: true, force: true }); });
  const call = async (path, body, auth = true) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/travel/chat/${path}`, {
      method: body ? 'POST' : 'GET', headers: { Origin: 'https://appassets.androidplatform.net', Authorization: auth ? `Bearer ${'a'.repeat(64)}` : '', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {})
    }); return { status: response.status, value: await response.json() };
  };
  const done = async id => { for (let i = 0; i < 100; i++) { const value = (await call('threads/' + id)).value; if (value.state !== 'running') return value; await new Promise(resolve => setTimeout(resolve, 20)); } throw Error('Chat did not settle'); };
  return { call, done, directory };
}
test('chat requires existing authentication and saves purpose, JSON and Markdown across restart', async t => {
  const f = await fixture(t), id = randomUUID();
  assert.equal((await f.call('threads', null, false)).status, 401);
  assert.equal((await f.call('threads', { id, title: '공부 기록', purpose: '영어' })).status, 201);
  await f.call(`threads/${id}/messages`, { requestId: randomUUID(), text: '오늘 배울 내용' });
  const thread = await f.done(id);
  assert.equal(thread.messages.length, 2);
  assert.match(await readFile(join(f.directory, id + '.md'), 'utf8'), /목적: 영어[\s\S]*오늘 배울 내용[\s\S]*한글 답변/);
  assert.equal(JSON.parse(await readFile(join(f.directory, id + '.json'), 'utf8')).messages.length, 2);
  const restored = await fixture(t, { chatDirectory: f.directory });
  assert.equal((await restored.call('threads/' + id)).value.messages.length, 2);
  assert.equal((await restored.call('threads')).value.threads[0].purpose, '영어');
});
test('repeated request IDs do not duplicate messages and selected conversations retain separate context', async t => {
  let calls = 0;
  const f = await fixture(t, { chatReply: async thread => { calls++; assert.ok(!thread.messages.some(m => m.text === '다른 대화 비밀')); return '답변'; } });
  const first = randomUUID(), second = randomUUID(), requestId = randomUUID();
  await f.call('threads', { id: first, purpose: '일상' }); await f.call('threads', { id: second, purpose: '업무' });
  await f.call(`threads/${first}/messages`, { requestId, text: '계획' }); await f.done(first);
  await f.call(`threads/${first}/messages`, { requestId, text: '계획' });
  assert.equal(calls, 1); assert.equal((await f.call('threads/' + first)).value.messages.length, 2);
  assert.equal((await f.call(`threads/${first}/messages`, { requestId, text: '바뀜' })).status, 409);
  assert.equal((await f.call('threads/' + second)).value.messages.length, 0);
  await f.call(`threads/${first}/meta`, { title: '바뀐 제목', purpose: '공부' });
  assert.match(await readFile(join(f.directory, first + '.md'), 'utf8'), /바뀐 제목[\s\S]*목적: 공부/);
});
test('cancellation keeps saved user text and retry reuses it without duplication', async t => {
  let first = true;
  const f = await fixture(t, { chatReply: (_, { signal }) => first ? new Promise((_, reject) => { first = false; signal.addEventListener('abort', () => reject(Error('cancelled'))); }) : Promise.resolve('복구 답변') });
  const id = randomUUID(), requestId = randomUUID(), text = '기억할 메시지';
  await f.call('threads', { id }); await f.call(`threads/${id}/messages`, { requestId, text });
  assert.equal((await f.call(`threads/${id}/cancel`, {})).value.state, 'failed');
  await new Promise(resolve => setTimeout(resolve, 30));
  await f.call(`threads/${id}/messages`, { requestId, text });
  const done = await f.done(id); assert.equal(done.messages.length, 2); assert.equal(done.messages[1].text, '복구 답변');
});
test('invalid IDs and oversized text are rejected; interrupted saved turns recover as retryable failures', async t => {
  const f = await fixture(t), id = randomUUID();
  assert.equal((await f.call('threads', { id: '../../auth' })).status, 400);
  await f.call('threads', { id });
  assert.equal((await f.call(`threads/${id}/messages`, { requestId: randomUUID(), text: 'x'.repeat(4001) })).status, 400);
  const json = JSON.parse(await readFile(join(f.directory, id + '.json'), 'utf8')); json.state = 'running';
  await writeFile(join(f.directory, id + '.json'), JSON.stringify(json));
  const restored = await fixture(t, { chatDirectory: f.directory });
  assert.equal((await restored.call('threads/' + id)).value.state, 'failed');
});
test('unreadable conversation storage fails without starting AI or claiming a save', async t => {
  let calls = 0;
  const f = await fixture(t, { chatReply: async () => { calls++; return 'must not run'; } });
  const id = randomUUID(); await mkdir(join(f.directory, id + '.json'));
  assert.equal((await f.call('threads', { id })).status, 500);
  assert.equal(calls, 0);
});

test('HTTP chat retrieves same-folder history, persists sources, and never searches on polling', async t => {
  const observed = [];
  const f = await fixture(t, { chatReply: async (thread, options) => { observed.push(options.memory); return options.memory.length ? '기억을 참고한 답변 [기억 1]' : '새 답변'; } });
  const first = randomUUID(), secret = randomUUID(), next = randomUUID();
  for (const [id, purpose] of [[first, '일상'], [secret, '업무'], [next, '일상']]) await f.call('threads', { id, purpose });
  await f.call(`threads/${first}/messages`, { requestId: randomUUID(), text: '달빛 여행 예산은 37만원이에요.' }); await f.done(first);
  await f.call(`threads/${secret}/messages`, { requestId: randomUUID(), text: '달빛 프로젝트의 비밀은 99만원' }); await f.done(secret);
  const request = { requestId: randomUUID(), text: '달빛 여행 예산 기억해?' };
  await f.call(`threads/${next}/messages`, request); const result = await f.done(next);
  assert.equal(observed[2].length, 1); assert.equal(observed[2][0].threadId, first);
  assert.ok(!JSON.stringify(observed[2]).includes('99만원'));
  assert.equal(result.messages[1].memorySources[0].messageId, (await f.call('threads/' + first)).value.messages[0].id);
  assert.match(result.messages[1].text, /기억 1/);
  assert.ok(!('user' in result.messages[1].memorySources[0]));
  await f.call('threads/' + next); await f.call('threads'); await f.call(`threads/${next}/messages`, request);
  assert.equal(observed.length, 3);
  const persisted = JSON.parse(await readFile(join(f.directory, next + '.json'), 'utf8'));
  assert.deepEqual(persisted.messages[1].memorySources, result.messages[1].memorySources);
});
test('index failure leaves JSON saves and normal chat usable with a visible notice', async t => {
  const f = await fixture(t);
  await mkdir(join(f.directory, 'search-v1.sqlite'));
  const id = randomUUID(); assert.equal((await f.call('threads', { id })).status, 201);
  await f.call(`threads/${id}/messages`, { requestId: randomUUID(), text: '검색 실패해도 저장해주세요.' });
  const done = await f.done(id);
  assert.equal(done.state, 'idle'); assert.match(done.messages[1].memoryNotice, /검색을 사용하지 못/);
  assert.equal(JSON.parse(await readFile(join(f.directory, id + '.json'), 'utf8')).messages.length, 2);
});

test('attachment content/model persist across retry/restart, reach the prompt, export and local search', async t => {
  const { chatPrompt } = await import('./chat.mjs');
  const { parseChatTurns } = await import('./chat-memory.mjs');
  let received, calls = 0;
  const f = await fixture(t, { chatReply: async thread => { received = thread; calls++; return '문서 확인'; } });
  const id = randomUUID(), requestId = randomUUID();
  await f.call('threads', { id });
  const attachments = [{ name: '여행.csv', text: '가족 공동 예산 370000원', size: 40, truncated: false }];
  const body = { requestId, text: '요약', attachments, model: 'gpt-test', effort: 'high' };
  assert.equal((await f.call(`threads/${id}/messages`, body)).status, 202);
  const done = await f.done(id); assert.equal(done.messages[0].attachments[0].text, attachments[0].text);
  assert.equal(received.messages[0].model, 'gpt-test'); assert.equal(done.messages[1].model, 'gpt-test');
  assert.equal(received.messages[0].effort, 'high'); assert.equal(done.messages[1].effort, 'high');
  assert.equal((await f.call(`threads/${id}/messages`, { ...body, effort: 'low' })).status, 409);
  assert.match(chatPrompt(received), /370000/); assert.match(parseChatTurns(done)[0].user, /370000/);
  assert.match(await readFile(join(f.directory, id + '.md'), 'utf8'), /첨부: 여행.csv/);
  await f.call(`threads/${id}/messages`, body); assert.equal(calls, 1);
  assert.equal((await f.call(`threads/${id}/messages`, { ...body, model: 'other-model' })).status, 409);
  assert.equal((await f.call(`threads/${id}/messages`, { ...body, attachments: [] })).status, 409);
  const restored = await fixture(t, { chatDirectory: f.directory });
  assert.deepEqual((await restored.call('threads/' + id)).value.messages[0].attachments, attachments);
  assert.equal((await restored.call('threads/' + id)).value.messages[0].effort, 'high');
});

test('chat attachment payload limit expands only the message route and rejects invalid attachments/models', async t => {
  const f = await fixture(t), id = randomUUID(); await f.call('threads', { id });
  const attachment = { name: '한글.txt', size: 36000, text: '가'.repeat(12000), truncated: false };
  assert.equal((await f.call(`threads/${id}/messages`, { requestId: randomUUID(), text: '요약', attachments: [attachment] })).status, 202);
  await f.done(id);
  assert.equal((await f.call('threads', { id: randomUUID(), title: 'x'.repeat(20000) })).status, 413);
  for (const extra of [{ effort: '--evil' }, { effort: 'ultra' }, { model: '--evil' }, { attachments: [{ ...attachment, name: '../auth.json' }] }, { attachments: [attachment, attachment, attachment] }]) {
    assert.equal((await f.call(`threads/${id}/messages`, { requestId: randomUUID(), text: 'test', ...extra })).status, 400);
  }
});

test('photo bytes reach the reply runner, survive restart and stay outside textual prompts/exports', async t => {
  const {photo}=await import('../../apps/web/src/features/ai-chat/chatPhotoFixture.test-data.js');
  const {chatPrompt,chatVisionImages}=await import('./chat.mjs');
  let supplied;
  const f=await fixture(t,{chatReply:async thread=>{supplied=thread;return '사진 확인';}}),id=randomUUID();
  await f.call('threads',{id});
  assert.equal((await f.call(`threads/${id}/messages`,{requestId:randomUUID(),text:'사진 설명',attachments:[photo]})).status,202);
  await f.done(id);assert.equal(chatVisionImages(supplied)[0].dataUrl,photo.dataUrl);assert.doesNotMatch(chatPrompt(supplied),/base64/);
  assert.doesNotMatch(await readFile(join(f.directory,id+'.md'),'utf8'),/base64/);
  const restored=await fixture(t,{chatDirectory:f.directory});assert.equal((await restored.call('threads/'+id)).value.messages[0].attachments[0].dataUrl,photo.dataUrl);
});

test('schedule capability returns a request-bound action, persists it, and rejects changed retry context', async t => {
  const { generateChatReply } = await import('./chat.mjs');
  const f = await fixture(t, { chatReply: generateChatReply }), id = randomUUID(), requestId = randomUUID();
  await f.call('threads', { id });
  const assistantContext = { version: 1, today: '2026-09-17', timeZone: 'Asia/Seoul', pending: null };
  const body = { requestId, text: '내일 오전 9시 회의 등록해줘', assistantContext };
  assert.equal((await f.call(`threads/${id}/messages`, body)).status, 202);
  const thread = await f.done(id), result = thread.messages.at(-1);
  assert.equal(result.requestId, requestId);
  assert.equal(result.actions[0].type, 'schedule.create');
  assert.equal(result.actions[0].draft.date, '2026-09-18');
  assert.equal(result.actions[0].draft.time, '09:00');
  assert.doesNotMatch(result.text, /추가했어요|저장했어요/);
  assert.equal((await f.call(`threads/${id}/messages`, body)).value.messages.length, 2);
  assert.equal((await f.call(`threads/${id}/messages`, {...body,assistantContext:{...assistantContext,today:'2026-09-18'}})).status,409);
  const restored = await fixture(t,{chatDirectory:f.directory});
  assert.deepEqual((await restored.call('threads/'+id)).value.messages.at(-1).actions,result.actions);
});
test('ambiguous schedule asks only for meridiem and does not produce an action until clarified', async t => {
  const { generateChatReply } = await import('./chat.mjs');
  const f = await fixture(t,{chatReply:generateChatReply}), id=randomUUID();
  await f.call('threads',{id});
  const context={version:1,today:'2026-09-17',timeZone:'Asia/Seoul',pending:null};
  await f.call(`threads/${id}/messages`,{requestId:randomUUID(),text:'내일 9시 회의 등록해줘',assistantContext:context});
  const question=(await f.done(id)).messages.at(-1);
  assert.deepEqual(question.actions,[]);assert.match(question.text,/오전인가요/);
  await f.call(`threads/${id}/messages`,{requestId:randomUUID(),text:'오후',assistantContext:{...context,pending:question.clarification}});
  const answer=(await f.done(id)).messages.at(-1);assert.equal(answer.actions[0].draft.time,'21:00');
});
