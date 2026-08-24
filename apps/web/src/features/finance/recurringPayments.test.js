import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyDueRecurringPayments,
  markRecurringPaymentsProcessed,
  normalizeRecurringPayment,
  postRecurringPayment,
  readRecurringPayments,
  recurringPaymentDueDate,
  recurringPaymentOccurrences,
  recurringPaymentsStorageKey,
  saveRecurringPayments
} from './recurringPayments.js';

class MemoryStorage {
  #items = new Map();

  getItem(key) {
    return this.#items.get(key) ?? null;
  }

  setItem(key, value) {
    this.#items.set(key, String(value));
  }
}

const now = new Date('2026-08-23T03:00:00.000Z');

function rule(overrides = {}) {
  return normalizeRecurringPayment({
    id: 'phone',
    name: '휴대폰 요금',
    amount: 55000,
    billingDay: '25',
    category: '통신',
    startMonth: '2026-08',
    autoPost: false,
    active: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides
  }, 0, now);
}

test('정기 결제 규칙은 사용자별 저장소에 정규화해 보존한다', () => {
  const storage = new MemoryStorage();
  const saved = saveRecurringPayments('User.Name', [{
    id: 'music',
    name: ' 음악 ',
    amount: '-10900',
    billingDay: 40,
    category: '구독',
    startMonth: '2026-08',
    endMonth: '2026-07'
  }], storage);

  assert.equal(saved.saved, true);
  assert.equal(recurringPaymentsStorageKey('User.Name'), 'lifehub-recurring-payments:v1:user.name');
  assert.deepEqual(readRecurringPayments('User.Name', storage).map((item) => ({
    id: item.id,
    name: item.name,
    amount: item.amount,
    billingDay: item.billingDay,
    endMonth: item.endMonth
  })), [{ id: 'music', name: '음악', amount: 10900, billingDay: '31', endMonth: '' }]);
});

test('29~31일과 말일 규칙은 짧은 달의 마지막 날로 보정한다', () => {
  assert.equal(recurringPaymentDueDate(rule({ billingDay: '31' }), '2026-09'), '2026-09-30');
  assert.equal(recurringPaymentDueDate(rule({ billingDay: '31' }), '2028-02'), '2028-02-29');
  assert.equal(recurringPaymentDueDate(rule({ billingDay: 'last', startMonth: '2026-01' }), '2027-02'), '2027-02-28');
});

test('시작월·종료월과 사용 중 상태 밖에서는 발생하지 않는다', () => {
  const limited = rule({ startMonth: '2026-08', endMonth: '2026-10' });
  assert.equal(recurringPaymentDueDate(limited, '2026-07'), '');
  assert.equal(recurringPaymentDueDate(limited, '2026-09'), '2026-09-25');
  assert.equal(recurringPaymentDueDate(limited, '2026-11'), '');
  assert.equal(recurringPaymentDueDate(rule({ active: false }), '2026-08'), '');
});

test('이번 달 예정액과 실제 기록 상태를 분리한다', () => {
  const rules = [rule(), rule({ id: 'rent', name: '월세', amount: 600000, billingDay: '1', category: '주거' })];
  const first = postRecurringPayment(rules[1], [], { month: '2026-08', now });
  const occurrences = recurringPaymentOccurrences(rules, first.entries, {
    month: '2026-08',
    today: '2026-08-23'
  });

  assert.equal(occurrences.length, 2);
  assert.deepEqual(occurrences.map((item) => item.status), ['posted', 'upcoming']);
  assert.equal(occurrences.reduce((sum, item) => sum + item.rule.amount, 0), 655000);
  assert.equal(occurrences.filter((item) => item.postedEntry).length, 1);
});

test('자동 반영은 현재 달의 도래한 규칙만 한 번 생성한다', () => {
  const rules = [
    rule({ autoPost: true, billingDay: '20' }),
    rule({ id: 'future', name: '미래 결제', autoPost: true, billingDay: '25' }),
    rule({ id: 'manual', name: '수동 결제', autoPost: false, billingDay: '1' })
  ];
  const first = applyDueRecurringPayments(rules, [], { today: '2026-08-23', now });
  assert.equal(first.created.length, 1);
  assert.equal(first.created[0].memo, '휴대폰 요금');
  assert.equal(first.created[0].source, 'recurring-payment');
  assert.deepEqual(first.created[0].origin, {
    kind: 'recurring-payment',
    ruleId: 'phone',
    occurrenceMonth: '2026-08'
  });

  const second = applyDueRecurringPayments(rules, first.entries, { today: '2026-08-23', now });
  assert.equal(second.created.length, 0);
  assert.equal(second.entries.length, 1);

  const processedRules = markRecurringPaymentsProcessed(rules, ['phone'], '2026-08', now);
  const afterUserDelete = applyDueRecurringPayments(processedRules, [], { today: '2026-08-23', now });
  assert.equal(afterUserDelete.created.length, 0);
});

test('수동 반영도 같은 규칙·월에는 최대 한 건만 생성한다', () => {
  const first = postRecurringPayment(rule(), [], { month: '2026-08', now });
  const second = postRecurringPayment(rule(), first.entries, { month: '2026-08', now });
  const nextMonth = postRecurringPayment(rule(), first.entries, { month: '2026-09', now });

  assert.equal(first.created.length, 1);
  assert.equal(second.created.length, 0);
  assert.equal(nextMonth.created.length, 1);
  assert.notEqual(first.created[0].id, nextMonth.created[0].id);
});
