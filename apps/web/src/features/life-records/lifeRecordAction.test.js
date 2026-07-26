import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLifeRecordAction } from './lifeRecordAction.js';

const TODAY = '2026-07-16';

function parse(text, options = {}) {
  return parseLifeRecordAction(text, { today: TODAY, ...options });
}

test('명시적인 메모 접두어만 메모 초안으로 만든다', () => {
  const action = parse('메모: 장보기 전에 우유 확인');
  assert.equal(action.kind, 'memo');
  assert.deepEqual(action.draft, {
    title: '',
    body: '장보기 전에 우유 확인',
    tags: []
  });
  assert.match(action.confirmationText, /메모로 기록할게요/);
  assert.match(action.fingerprint, /^life-record:v1:memo:[0-9a-f]{8}$/);

  assert.equal(parse('장보기 전에 우유 확인'), null);
  assert.equal(parse('메모:'), null);
});

test('원·만원 표기의 지출과 수입을 현재 가계부 초안으로 정규화한다', () => {
  const expense = parse('커피 4500원 지출');
  assert.equal(expense.kind, 'expense');
  assert.deepEqual(expense.draft, {
    type: 'withdraw',
    amount: 4500,
    category: '카페',
    memo: '커피',
    date: TODAY
  });
  assert.match(expense.confirmationText, /4,500원을 지출/);

  const income = parse('월급 300만원 수입');
  assert.equal(income.kind, 'income');
  assert.deepEqual(income.draft, {
    type: 'deposit',
    amount: 3000000,
    category: '수입',
    memo: '월급',
    date: TODAY
  });
  assert.match(income.confirmationText, /3,000,000원을 수입/);
});

test('접두어 금액 형식과 소수 만원 표기도 보수적으로 지원한다', () => {
  assert.deepEqual(parse('지출: 버스 1,450원').draft, {
    type: 'withdraw',
    amount: 1450,
    category: '교통',
    memo: '버스',
    date: TODAY
  });
  assert.equal(parse('성과급 1.5만원 수입').draft.amount, 15000);
  assert.equal(parse('커피 4,50원 지출'), null);
  assert.equal(parse('커피 0원 지출'), null);
  assert.equal(parse('상금 1000000001원 수입'), null);
});

test('알려진 운동명과 분 단위가 모두 있을 때만 운동 초안을 만든다', () => {
  const action = parse('러닝 30분');
  assert.equal(action.kind, 'workout');
  assert.deepEqual(action.draft, {
    templateId: 'cardio',
    workoutKind: 'cardio',
    title: '러닝',
    activity: '러닝',
    activityId: 'running',
    durationMinutes: 30,
    date: TODAY
  });
  assert.match(action.confirmationText, /러닝 30분/);

  assert.equal(parse('운동 30분'), null);
  assert.equal(parse('러닝'), null);
  assert.equal(parse('러닝 0분'), null);
  assert.equal(parse('러닝 601분'), null);
});

test('식사 구분·음식명·열량이 모두 있을 때만 식단 초안을 만든다', () => {
  const action = parse('점심 김밥 650kcal');
  assert.equal(action.kind, 'diet');
  assert.deepEqual(action.draft, {
    mealType: 'lunch',
    food: '김밥',
    calories: 650,
    date: TODAY
  });
  assert.match(action.confirmationText, /점심 김밥/);

  assert.equal(parse('김밥 650kcal'), null);
  assert.equal(parse('점심 650kcal'), null);
  assert.equal(parse('점심 김밥 0kcal'), null);
  assert.equal(parse('점심 김밥 10001kcal'), null);
});

test('부정·기능 수정·설명·일정 문장은 생활 기록으로 오인하지 않는다', () => {
  for (const input of [
    '커피 4500원 지출하지 마',
    '월급 300만원 수입 아님',
    '러닝 30분 안 했어',
    '점심 김밥 650kcal 안 먹었어',
    '메모 추가 기능 고쳐줘',
    '메모: 지출 기능 수정해줘',
    '지출 기록 방법 알려줘',
    '내일 치과 일정 추가해줘'
  ]) {
    assert.equal(parse(input), null, input);
  }
});

test('둘 이상의 기록 신호나 여러 줄 입력은 안전하게 거부한다', () => {
  for (const input of [
    '점심 김밥 650kcal 4500원 지출',
    '월급 300만원 수입 4500원 지출',
    '러닝 30분 500kcal',
    '커피 4500원 지출\n메모: 영수증 확인'
  ]) {
    assert.equal(parse(input), null, input);
  }
});

test('fingerprint는 표기 차이를 정규화하고 날짜나 값 차이는 구분한다', () => {
  const compact = parse('커피 4500원 지출');
  const formatted = parse('커피   4,500원   지출');
  assert.equal(compact.fingerprint, formatted.fingerprint);
  assert.notEqual(
    compact.fingerprint,
    parse('커피 5000원 지출').fingerprint
  );
  assert.notEqual(
    compact.fingerprint,
    parse('커피 4500원 지출', { today: '2026-07-17' }).fingerprint
  );
});
