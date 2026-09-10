import test from 'node:test';
import assert from 'node:assert/strict';
import { validChatEffort, modelEfforts, mainQuotaWindows } from './chatModelOptions.js';
test('model effort options follow discovered capabilities without inventing unsupported levels', () => {
  assert.deepEqual(modelEfforts({ supportedReasoningEfforts: [{ reasoningEffort: 'low' }, { reasoningEffort: 'ultra' }, { reasoningEffort: 'low' }, { reasoningEffort: '--bad' }, null] }), ['low', 'ultra']);
  assert.deepEqual(modelEfforts(null), []);
  assert.equal(validChatEffort('max'), true); assert.equal(validChatEffort({}), false);
});
test('five-hour and weekly windows stay separate and missing usage never becomes zero', () => {
  const limits = [{ bucket: 'Codex', kind: 'secondary', windowMinutes: 10080, remainingPercent: 0 }, { bucket: 'Codex', kind: 'primary', windowMinutes: 300, remainingPercent: 74 }];
  const windows = mainQuotaWindows(limits);
  assert.deepEqual(windows.map(row => [row.label, row.limit.remainingPercent]), [['5시간', 74], ['주간', 0]]);
  assert.equal(mainQuotaWindows([])[0].limit, undefined);
  assert.equal(mainQuotaWindows([{ bucket: 'A', windowMinutes: 300 }, { bucket: 'B', windowMinutes: 10080 }])[1].limit, undefined);
  assert.equal(mainQuotaWindows([{ bucket: 'Codex', windowMinutes: 180 }])[0].limit, undefined);
});
