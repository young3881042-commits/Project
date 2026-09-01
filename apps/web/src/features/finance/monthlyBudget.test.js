import assert from 'node:assert/strict';
import test from 'node:test';
import {
  monthlyBudgetProgress,
  readMonthlyBudget,
  saveMonthlyBudget
} from './monthlyBudget.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
}

test('monthly budget is stored per owner and normalized', () => {
  const storage = memoryStorage();
  const saved = saveMonthlyBudget('guestuser', { amount: 1500000 }, storage, new Date('2026-09-01T00:00:00.000Z'));
  assert.equal(saved.saved, true);
  assert.equal(readMonthlyBudget('guestuser', storage).amount, 1500000);
  assert.equal(readMonthlyBudget('another', storage).amount, 0);
});

test('monthly budget progress has no invented fallback amount', () => {
  assert.deepEqual(monthlyBudgetProgress(250000, 0), {
    configured: false,
    usage: null,
    remaining: null,
    exceeded: 0
  });
  assert.deepEqual(monthlyBudgetProgress(1200000, 1000000), {
    configured: true,
    usage: 120,
    remaining: 0,
    exceeded: 200000
  });
});
