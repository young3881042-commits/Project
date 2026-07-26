import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendLocalScheduleExchange,
  createLocalScheduleThread,
  mergeLocalScheduleThreads
} from './localScheduleConversation.js';

test('로컬 일정 대화를 별도 스레드로 만들고 후속 답변을 이어 붙인다', () => {
  const first = createLocalScheduleThread({
    text: '내일 3시에 병원 일정 추가해줘',
    reply: '3시는 오전인가요, 오후인가요?',
    createdAt: '2026-07-15T10:00:00.000Z'
  });
  const completed = appendLocalScheduleExchange(first, {
    text: '오후',
    reply: '일정을 추가했어요.',
    createdAt: '2026-07-15T10:01:00.000Z'
  });

  assert.equal(first.localOnly, true);
  assert.equal(first.pendingScheduleRequest, null);
  assert.equal(first.messages.length, 2);
  assert.equal(completed.messages.length, 4);
  assert.equal(completed.messages.at(-1).content, '일정을 추가했어요.');
});

test('Bridge 새 목록을 받아도 로컬 일정 대화는 유지한다', () => {
  const local = createLocalScheduleThread({ text: '일정 등록해줘', reply: '저장했어요.', createdAt: '2026-07-15T10:00:00.000Z' });
  const remote = { id: 'remote-1', updatedAt: '2026-07-15T11:00:00.000Z' };
  const merged = mergeLocalScheduleThreads([remote], [local]);

  assert.deepEqual(merged.map((thread) => thread.id), ['remote-1', local.id]);
});
