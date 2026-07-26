import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAssistantScheduleChange } from './assistantScheduleChange.js';
import { parseScheduleCreateRequest } from './scheduleChatAction.js';

const normalize = (item) => item?.title && item?.date ? item : null;
const draft = { title: '치과', category: 'etc', date: '2026-07-16', time: '15:00' };

test('AI 일정 변경안에 안전한 기본값과 재실행 식별자를 넣는다', () => {
  const result = prepareAssistantScheduleChange([], draft, 'request-1', { normalize, createId: () => 'schedule-1' });

  assert.equal(result.status, 'created');
  assert.equal(result.item.id, 'schedule-1');
  assert.equal(result.item.source, 'ai-chat');
  assert.deepEqual(result.item.origin, { kind: 'ai-chat', requestId: 'request-1' });
  assert.equal(result.item.repeat, 'none');
  assert.equal(result.items.length, 1);
});

test('같은 요청 또는 같은 제목·날짜·시간은 중복 저장하지 않는다', () => {
  const existing = {
    ...draft,
    id: 'schedule-1',
    origin: { kind: 'ai-chat', requestId: 'request-1' }
  };
  assert.equal(prepareAssistantScheduleChange([existing], draft, 'request-1', { normalize }).status, 'duplicate');
  assert.equal(prepareAssistantScheduleChange([{ ...existing, origin: undefined }], { ...draft, title: '  치과  ' }, 'request-2', { normalize }).status, 'duplicate');
});

test('고정 개수 제한 없이 일정을 추가하고 정규화 실패에서는 저장하지 않는다', () => {
  const full = Array.from({ length: 300 }, (_, index) => ({ id: String(index), title: `일정 ${index}`, date: '2026-07-15', time: '' }));
  const expanded = prepareAssistantScheduleChange(full, draft, 'request-1', { normalize });
  assert.equal(expanded.status, 'created');
  assert.equal(expanded.items.length, 301);
  assert.equal(prepareAssistantScheduleChange([], draft, 'request-1', { normalize: () => null }).status, 'failed');
});

test('실패했던 실제 채팅 문장을 오늘 일정 변경안까지 연결한다', () => {
  const action = parseScheduleCreateRequest('테스트로 일정 하나만 등록해줘', { today: '2026-07-15' });
  const change = prepareAssistantScheduleChange([], action.draft, 'failed-thread-retry', {
    normalize,
    createId: () => 'schedule-recovered'
  });

  assert.equal(action.status, 'ready');
  assert.equal(change.status, 'created');
  assert.deepEqual(
    { title: change.item.title, date: change.item.date, time: change.item.time },
    { title: '테스트 일정', date: '2026-07-15', time: '' }
  );
});
