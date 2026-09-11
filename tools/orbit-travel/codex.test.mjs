import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { generateTravelPlan, travelCodexArgs, travelPrompt } from './codex.mjs';
import { newTravelDraft } from '../../apps/web/src/features/travel/travelModel.js';
const input = { ...newTravelDraft('2026-10-10'), destination: '서울', days: 1 };
const result = { title: '한글 여행', summary: '한글을 보존해요', days: [{ day: 1, title: '산책', items: [{ time: '10:00', title: '공원', place: '서울숲', description: '쉬어가기', transport: '', estimatedCost: '' }] }], tips: [], sources: [] };
function fakeSpawn(events, capture = () => {}) {
  return (command, args, options) => {
    capture(command, args, options);
    const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    let closed = false;
    child.kill = () => { if (!closed) { closed = true; queueMicrotask(() => child.emit('close', 1)); } };
    child.stdin.on('finish', () => { queueMicrotask(() => {
      const bytes = Buffer.from(events.map(event => JSON.stringify(event)).join('\n') + '\n');
      for (const byte of bytes) child.stdout.write(Buffer.from([byte]));
      if (!closed) { closed = true; child.stdout.end(); child.emit('close', 0); }
    }); });
    return child;
  };
}
test('Codex invokes isolated read-only structured output with shell/apps/MCP disabled', () => {
  const args = travelCodexArgs('/tmp/schema', '/tmp/isolated');
  for (const flag of ['--ignore-user-config', '--ignore-rules', '--ephemeral', '--output-schema', 'read-only', 'features.shell_tool=false', 'features.apps=false', 'mcp_servers={}']) assert.ok(args.includes(flag));
  assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
  assert.match(travelPrompt(input), /10:00 to 22:00/);
  for (const requirement of ['Research in Korean', 'map.naver.com', 'blog.naver.com', 'official Korean', 'Never invent Naver links', 'Do not bypass access restrictions']) assert.ok(travelPrompt(input).includes(requirement));
  assert.ok(!travelPrompt({ ...input, finance: 'SENSITIVE_RECORD' }).includes('SENSITIVE_RECORD'));
});
test('JSONL decoding preserves Korean across arbitrary UTF-8 chunk boundaries', async () => {
  const plan = await generateTravelPlan(input, { resolveCommand: () => ({ command: 'fake-codex', argsPrefix: [] }), spawnProcess: fakeSpawn([{ type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(result) } }], (_, args, options) => { assert.equal(options.shell, false); assert.equal(args.at(-1), '-'); assert.equal(options.env.OPENAI_API_KEY, undefined); }) });
  assert.equal(plan.title, '한글 여행');
});
test('unexpected command execution events are blocked, and pre-cancelled jobs do not spawn', async () => {
  await assert.rejects(generateTravelPlan(input, { resolveCommand: () => ({ command: 'fake', argsPrefix: [] }), spawnProcess: fakeSpawn([{ type: 'item.started', item: { type: 'command_execution', command: 'no' } }]) }), /범위 밖/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(generateTravelPlan(input, { signal: controller.signal, spawnProcess: () => { assert.fail('must not spawn'); } }), /취소/);
});
test('an active cancellation stops its isolated child without touching other sessions', async () => {
  const controller = new AbortController();
  await assert.rejects(generateTravelPlan(input, {
    signal: controller.signal,
    resolveCommand: () => ({ command: 'fake', argsPrefix: [] }),
    spawnProcess: fakeSpawn([], (_, __, options) => assert.equal(options.detached, process.platform !== 'win32')),
    onProgress: () => controller.abort()
  }), /취소/);
});

test('selected reasoning effort is passed verbatim without overriding model defaults', () => {
  for (const effort of ['low', 'medium', 'high', 'xhigh', 'max', 'ultra']) {
    const args = travelCodexArgs('/tmp/schema', '/tmp/isolated', 'gpt-6-astra', '', effort);
    assert.ok(args.includes(`model_reasoning_effort="${effort}"`));
    assert.equal(args.filter(arg => arg.startsWith('model_reasoning_effort=')).length, 1);
    assert.equal(args[args.indexOf('--model') + 1], 'gpt-6-astra');
  }
  assert.ok(!travelCodexArgs('/tmp/schema', '/tmp/isolated', 'gpt-6-astra').some(arg => arg.startsWith('model_reasoning_effort=')));
  assert.throws(() => travelCodexArgs('/tmp/schema', '/tmp/isolated', 'gpt-6-astra', '', '--bad'), /추론 강도/);
});
test('duplicate venues trigger one complete repair and are never silently saved', async () => {
  let calls=0;
  const duplicate={...result,days:[{day:1,title:'하루',items:[...result.days[0].items,{...result.days[0].items[0],time:'12:00',title:'다른 활동'}]}]};
  const options={ resolveCommand:()=>({command:'fake',argsPrefix:[]}), spawnProcess:(...args)=>{calls++;return fakeSpawn([{type:'item.completed',item:{type:'agent_message',text:JSON.stringify(calls===1?duplicate:result)}}])(...args);} };
  const plan=await generateTravelPlan(input,options);assert.equal(calls,2);assert.equal(plan.days[0].items.length,1);
  await assert.rejects(generateTravelPlan(input,{...options,spawnProcess:fakeSpawn([{type:'item.completed',item:{type:'agent_message',text:JSON.stringify(duplicate)}}])}),/같은 장소가 반복/);
});

test('image input becomes a private JPEG argument and is removed after execution', async()=>{
 const {photo}=await import('../../apps/web/src/features/ai-chat/chatPhotoFixture.test-data.js');
 const {runStructuredCodex}=await import('./codex.mjs');const {readFileSync,statSync,existsSync}=await import('node:fs');let path;
 await runStructuredCodex({schemaValue:{},prompt:'inspect image',images:[photo],validate:x=>x,resolveCommand:()=>({command:'fake',argsPrefix:[]}),
 spawnProcess:fakeSpawn([{type:'item.completed',item:{type:'agent_message',text:'{"ok":true}'}}],(_,args)=>{
 path=args[args.indexOf('--image')+1];assert.equal(readFileSync(path).toString('base64'),photo.dataUrl.slice(23));assert.equal(statSync(path).mode&0o777,0o600);assert.equal(args.at(-1),'-');})});
 assert.equal(existsSync(path),false);
});
