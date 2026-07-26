import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScheduleCreateRequest, scheduleConfirmationText } from './scheduleChatAction.js';

const TODAY = '2026-07-15';

test('사용자가 실제로 요청한 테스트 일정 문장을 오늘 종일 일정으로 만든다', () => {
  assert.deepEqual(parseScheduleCreateRequest('테스트로 일정 하나만 등록해줘', { today: TODAY }), {
    status: 'ready',
    draft: { title: '테스트 일정', date: TODAY, time: '', category: 'etc' }
  });
});

test('상대 날짜와 오전·오후 시간을 일정 초안으로 파싱한다', () => {
  assert.deepEqual(parseScheduleCreateRequest('내일 오후 3시 30분에 치과 일정 추가해줘', { today: TODAY }), {
    status: 'ready',
    draft: { title: '치과', date: '2026-07-16', time: '15:30', category: 'etc' }
  });
  assert.deepEqual(parseScheduleCreateRequest('모레 오전 12시에 운동 약속 잡아줘', { today: TODAY }), {
    status: 'ready',
    draft: { title: '운동', date: '2026-07-17', time: '00:00', category: 'exercise' }
  });
  assert.equal(parseScheduleCreateRequest('내일15:30에 치과 일정 추가해줘', { today: TODAY }).draft.time, '15:30');
  assert.equal(parseScheduleCreateRequest('내일 밤 12시에 야식 일정 추가해줘', { today: TODAY }).draft.time, '00:00');
});

test('연도 없는 월일과 다음 주 요일을 미래 날짜로 계산한다', () => {
  assert.equal(parseScheduleCreateRequest('7월 20일 회의 일정 등록해줘', { today: TODAY }).draft.date, '2026-07-20');
  assert.deepEqual(parseScheduleCreateRequest('7/20 병원 일정 등록해줘', { today: TODAY }).draft, {
    title: '병원', date: '2026-07-20', time: '', category: 'etc'
  });
  assert.equal(parseScheduleCreateRequest('다음 주 월요일 회의 일정 등록해줘', { today: TODAY }).draft.date, '2026-07-20');
  assert.equal(parseScheduleCreateRequest('1월 2일 여행 일정 등록해줘', { today: TODAY }).draft.date, '2027-01-02');
  assert.equal(parseScheduleCreateRequest('다음 달 3일 치과 일정 등록해줘', { today: TODAY }).draft.date, '2026-08-03');
});

test('모호한 시각은 오전·오후를 확인한 뒤 완성한다', () => {
  const first = parseScheduleCreateRequest('내일 3시에 병원 일정 추가해줘', { today: TODAY });
  assert.equal(first.status, 'need-more');
  assert.equal(first.missing, 'meridiem');
  assert.match(first.question, /오전인가요, 오후인가요/);
  const completed = parseScheduleCreateRequest('오후', { today: TODAY, pending: first });
  assert.equal(completed.status, 'ready');
  assert.equal(completed.draft.time, '15:00');
  assert.equal(completed.draft.title, '병원');
});

test('제목이 없으면 재질문하고 다음 메시지로 완성한다', () => {
  const first = parseScheduleCreateRequest('내일 일정 하나 추가해줘', { today: TODAY });
  assert.equal(first.status, 'need-more');
  assert.equal(first.missing, 'title');
  const completed = parseScheduleCreateRequest('장보기', { today: TODAY, pending: first });
  assert.deepEqual(completed.draft, { title: '장보기', date: '2026-07-16', time: '', category: 'etc' });
  const fullReply = parseScheduleCreateRequest('장보기 일정 추가해줘', { today: TODAY, pending: first });
  assert.deepEqual(fullReply.draft, { title: '장보기', date: '2026-07-16', time: '', category: 'etc' });
});

test('기능 수정·설명·부정 문장은 사용자 일정으로 오인하지 않는다', () => {
  for (const input of [
    '일정 추가 버튼 만들어줘',
    '일정 추가 기능 고쳐줘',
    '일정 추가 방법 알려줘',
    '일정 추가해줘라고 말하면 돼?',
    '일정 추가하지 마',
    '일정 추가해달라고 했는데 안 생겼어'
  ]) {
    assert.equal(parseScheduleCreateRequest(input, { today: TODAY }).status, 'not-action', input);
  }
  for (const input of ['내일 개발 회의 일정 추가해줘', '내일 코드 리뷰 일정 추가해줘', '내일 UI 회의 일정 추가해줘']) {
    assert.equal(parseScheduleCreateRequest(input, { today: TODAY }).status, 'ready', input);
  }
});

test('잘못된 날짜와 시간을 저장 가능한 초안으로 만들지 않는다', () => {
  assert.equal(parseScheduleCreateRequest('2026-02-30 병원 일정 추가해줘', { today: TODAY }).status, 'invalid');
  assert.equal(parseScheduleCreateRequest('내일 오후 25시 병원 일정 추가해줘', { today: TODAY }).status, 'invalid');
  assert.equal(parseScheduleCreateRequest('내일 오후 13시 병원 일정 추가해줘', { today: TODAY }).status, 'invalid');
  assert.equal(parseScheduleCreateRequest('24:00 병원 일정 추가해줘', { today: TODAY }).status, 'invalid');
  assert.equal(parseScheduleCreateRequest('매주 월요일 운동 일정 추가해줘', { today: TODAY }).status, 'invalid');
  assert.equal(parseScheduleCreateRequest('내일 7월 20일 병원 일정 추가해줘', { today: TODAY }).status, 'invalid');
  assert.equal(parseScheduleCreateRequest('내일 오후 3시 15:30 병원 일정 추가해줘', { today: TODAY }).status, 'invalid');
});

test('저장 확인 문구는 일정 편집 링크와 중복 안내를 포함한다', () => {
  const text = scheduleConfirmationText({ id: 'schedule-1', title: '치과', date: '2026-07-16', time: '15:00' });
  assert.match(text, /일정을 추가했어요/);
  assert.match(text, /2026년 07월 16일 15:00/);
  assert.match(text, /\/schedule\?edit=schedule-1/);
  assert.match(scheduleConfirmationText({ id: 'schedule-1', title: '치과', date: TODAY }, true), /이미 있어요/);
});
