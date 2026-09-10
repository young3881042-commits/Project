import test from 'node:test';
import assert from 'node:assert/strict';
import { publicModels, publicLimits, validChatModel, createCodexInfo } from './codex-info.mjs';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
test('model discovery and quota expose only display fields, never invented token counts or credentials', () => {
  assert.deepEqual(publicModels({ data: [{ model: 'gpt-test', displayName: 'Test', isDefault: true, defaultReasoningEffort: 'low', supportedReasoningEfforts: [{ reasoningEffort: 'low' }, { reasoningEffort: 'ultra' }, { reasoningEffort: '--bad' }], secret: 'private' }, { model: '--bad' }, { model: 'hidden', hidden: true }] }), [{ id: 'gpt-test', name: 'Test', isDefault: true, efforts: ['low', 'ultra'], defaultEffort: 'low' }]);
  assert.equal(validChatModel('https://example.com'), false);
  const rows = publicLimits({ rateLimits: { primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: 1900000000 }, secondary: { usedPercent: 120 } } });
  assert.equal(rows[0].remainingPercent, 75); assert.equal(rows[1].remainingPercent, 0);
  assert.deepEqual(publicLimits(null), []); assert.deepEqual(publicLimits({ rateLimits: { primary: { usedPercent: null } } }), []);
});
test('read-only metadata RPC closes the process and keeps unavailable quota distinct from zero', async () => {
  const methods = []; const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin = new Writable({ write(bytes, encoding, done) { const message = JSON.parse(bytes.toString()); methods.push(message.method);
    if (message.id != null) queueMicrotask(() => child.stdout.write(JSON.stringify(message.method === 'account/rateLimits/read' ? { id: message.id, error: { message: 'private failure' } } : { id: message.id, result: message.method === 'model/list' ? { data: [{ model: 'gpt-test' }] } : {} }) + '\n')); done(); } });
  child.kill = () => { child.killed = true; };
  const info = createCodexInfo({ resolveCommand: () => ({ command: 'fake', argsPrefix: [] }), spawnProcess: () => child });
  const result = await info.read(); assert.equal(result.models.length, 1); assert.deepEqual(result.limits, []); assert.equal(result.exactRemainingTokens, null);
  assert.ok(result.limitsError); assert.equal(JSON.stringify(result).includes('private'), false); assert.equal(child.killed, true);
  assert.deepEqual(methods, ['initialize', 'initialized', 'model/list', 'account/rateLimits/read']);
});
