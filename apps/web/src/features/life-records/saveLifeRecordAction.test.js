import assert from 'node:assert/strict';
import test from 'node:test';
import { saveLifeRecordAction } from './saveLifeRecordAction.js';

const now = () => new Date('2026-07-16T12:00:00.000Z');

test('지출 기록은 같은 요청 재실행만 차단하고 별도 요청의 같은 실제 지출은 보존한다', () => {
  let rows = [];
  const action = {
    kind: 'expense',
    fingerprint: 'life-record:v1:expense:12345678',
    draft: { type: 'withdraw', amount: 4500, category: '카페', memo: '커피', date: '2026-07-16' }
  };
  const services = {
    now,
    readBudget: () => rows,
    normalizeBudget: (item) => item,
    saveBudget: (items) => { rows = items; return { saved: true }; }
  };
  const created = saveLifeRecordAction(action, 'request-1', services);
  assert.equal(created.status, 'created');
  assert.equal(rows[0].origin.requestId, 'request-1');
  assert.equal(rows[0].source, 'ai-chat');
  assert.equal(saveLifeRecordAction(action, 'request-1', services).status, 'duplicate');
  const repeated = saveLifeRecordAction(action, 'request-2', services);
  assert.equal(repeated.status, 'created');
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].id, rows[1].id);
});

test('식단 기록은 AI origin을 보존하고 저장 실패를 성공으로 말하지 않는다', () => {
  let written = null;
  const action = {
    kind: 'diet',
    fingerprint: 'life-record:v1:diet:abcdef12',
    draft: { mealType: 'lunch', food: '김밥', calories: 650, date: '2026-07-16' }
  };
  const result = saveLifeRecordAction(action, 'request-diet', {
    now,
    readDietEntries: () => [],
    saveDietEntries: (items) => { written = items; return { saved: false }; }
  });
  assert.equal(result.status, 'failed');
  assert.equal(written[0].origin.fingerprint, action.fingerprint);
  assert.equal(written[0].analysisSource, 'ai-chat');
});

test('필수 action 식별자가 없으면 저장 서비스를 호출하지 않는다', () => {
  let called = false;
  const result = saveLifeRecordAction({ kind: 'memo', draft: { body: '내용' } }, '', {
    saveNotes: () => { called = true; return { saved: true }; }
  });
  assert.equal(result.status, 'failed');
  assert.equal(called, false);
});
