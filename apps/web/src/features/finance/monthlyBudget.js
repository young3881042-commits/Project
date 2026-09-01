import { orbitStorage } from '../../utils/orbitIndexedDbStorage.js';

export const MONTHLY_BUDGET_STORAGE_KEY = 'orbit.finance-budget:v1';

function ownerName(owner) {
  const username = typeof owner === 'string' ? owner : owner?.username;
  return String(username || 'guestuser').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'guestuser';
}

function storageKey(owner) {
  return MONTHLY_BUDGET_STORAGE_KEY + ':' + ownerName(owner);
}

export function normalizeMonthlyBudget(value = {}) {
  const amount = Math.round(Math.max(0, Number(value?.amount) || 0));
  return {
    amount: Math.min(amount, 999999999999),
    updatedAt: value?.updatedAt ? String(value.updatedAt) : ''
  };
}

export function readMonthlyBudget(owner, storage = orbitStorage) {
  try {
    return normalizeMonthlyBudget(JSON.parse(storage?.getItem(storageKey(owner)) || '{}'));
  } catch {
    return normalizeMonthlyBudget();
  }
}

export function saveMonthlyBudget(owner, value, storage = orbitStorage, now = new Date()) {
  const settings = normalizeMonthlyBudget({
    ...value,
    updatedAt: now instanceof Date && !Number.isNaN(now.getTime())
      ? now.toISOString()
      : new Date().toISOString()
  });
  try {
    storage?.setItem(storageKey(owner), JSON.stringify(settings));
    return { saved: true, settings };
  } catch {
    return { saved: false, settings };
  }
}

export function monthlyBudgetProgress(expense, amount) {
  const normalizedExpense = Math.max(0, Math.round(Number(expense) || 0));
  const normalizedAmount = Math.max(0, Math.round(Number(amount) || 0));
  if (!normalizedAmount) {
    return { configured: false, usage: null, remaining: null, exceeded: 0 };
  }
  return {
    configured: true,
    usage: Math.min(999, Math.round((normalizedExpense / normalizedAmount) * 100)),
    remaining: Math.max(0, normalizedAmount - normalizedExpense),
    exceeded: Math.max(0, normalizedExpense - normalizedAmount)
  };
}
