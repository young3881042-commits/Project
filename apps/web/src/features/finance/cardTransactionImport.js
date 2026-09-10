import { orbitStorage } from '../../utils/orbitIndexedDbStorage.js';
import {
  CARD_IMPORT_SOURCES,
  normalizeCardImportOwner,
  normalizeCardImportSources,
  normalizeNativeCardCandidate
} from './nativeCardTransactions.js';
import { categoryFromExistingData } from './merchantCategoryModel.js';
import { normalizeKakaoPayMerchant } from './kakaoPayMerchant.js';

export const CARD_IMPORT_SOURCE_STORAGE_KEY = 'lifehub-card-import-sources:v1';

function storageKey(owner) {
  return `${CARD_IMPORT_SOURCE_STORAGE_KEY}:${normalizeCardImportOwner(owner)}`;
}

export function readCardImportSources(owner, storage = orbitStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(storageKey(owner)) || '[]');
    return normalizeCardImportSources(parsed);
  } catch {
    return [];
  }
}

export function saveCardImportSources(owner, sources, storage = orbitStorage) {
  const normalized = normalizeCardImportSources(sources);
  try {
    storage?.setItem(storageKey(owner), JSON.stringify(normalized));
    return { saved: true, sources: normalized };
  } catch {
    return { saved: false, sources: normalized };
  }
}

export function cardImportSourceLabel(sourceId) {
  return CARD_IMPORT_SOURCES.find((source) => source.id === sourceId)?.label || '카드 앱';
}

function localDateKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function importedEventId(entry) {
  return entry?.source === 'card-notification'
    && entry?.origin?.kind === 'card-notification'
    ? String(entry.origin.eventId || '')
    : '';
}

export function cardBudgetEntry(candidate, categorySettings, existingEntries = []) {
  const normalized = normalizeNativeCardCandidate(candidate);
  if (!normalized) return null;
  const merchant = normalized.source === 'kakao-pay'
    ? normalizeKakaoPayMerchant(normalized.merchant)
    : normalized.merchant;
  if (!merchant) return null;
  return {
    id: `budget-card-${normalized.eventId}`,
    type: 'withdraw',
    amount: normalized.amount,
    date: localDateKey(normalized.occurredAt),
    category: categoryFromExistingData(merchant, existingEntries, categorySettings),
    memo: merchant,
    createdAt: new Date(normalized.occurredAt).toISOString(),
    source: 'card-notification',
    origin: {
      kind: 'card-notification',
      eventId: normalized.eventId,
      source: normalized.source
    }
  };
}

export function recategorizeImportedCardEntries(entries, categorySettings) {
  let changed = 0;
  const items = (Array.isArray(entries) ? entries : []).map((entry) => {
    if (entry?.source !== 'card-notification'
        || entry?.origin?.kind !== 'card-notification'
        || typeof entry?.memo !== 'string' || (entry.category && entry.category !== '기타')) {
      return entry;
    }
    const category = categoryFromExistingData(entry.memo, entries, categorySettings);
    if (entry.category === category) return entry;
    changed += 1;
    return { ...entry, category };
  });
  return { items, changed };
}

async function acknowledge(acknowledgeDecisions, eventIds, status) {
  if (!eventIds.length) return { acknowledged: true, count: 0 };
  try {
    const result = await acknowledgeDecisions(eventIds.map((eventId) => ({ eventId, status })));
    return { acknowledged: result?.ok === true || result === true, count: eventIds.length };
  } catch {
    return { acknowledged: false, count: 0 };
  }
}

export async function importCardTransactionBatch(candidates, {
  categorySettings,
  selectedSources,
  readBudget,
  normalizeBudget,
  saveBudget,
  acknowledgeDecisions
} = {}) {
  const allowedSources = new Set(normalizeCardImportSources(selectedSources));
  if (!allowedSources.size) {
    return { status: 'disabled', imported: 0, duplicates: 0, acknowledged: true };
  }
  if (typeof readBudget !== 'function'
      || typeof normalizeBudget !== 'function'
      || typeof saveBudget !== 'function'
      || typeof acknowledgeDecisions !== 'function') {
    return { status: 'failed', imported: 0, duplicates: 0, acknowledged: false };
  }

  const normalizedCandidates = [];
  const seenBatch = new Set();
  for (const value of Array.isArray(candidates) ? candidates : []) {
    const candidate = normalizeNativeCardCandidate(value);
    if (!candidate || !allowedSources.has(candidate.source) || seenBatch.has(candidate.eventId)) continue;
    seenBatch.add(candidate.eventId);
    normalizedCandidates.push(candidate);
  }
  if (!normalizedCandidates.length) {
    return { status: 'empty', imported: 0, duplicates: 0, acknowledged: true };
  }

  let current;
  try {
    current = readBudget();
  } catch {
    return { status: 'failed', imported: 0, duplicates: 0, acknowledged: false };
  }
  if (!Array.isArray(current)) {
    return { status: 'failed', imported: 0, duplicates: 0, acknowledged: false };
  }

  const existingEventIds = new Set(current.map(importedEventId).filter(Boolean));
  const duplicateIds = normalizedCandidates
    .filter((candidate) => existingEventIds.has(candidate.eventId))
    .map((candidate) => candidate.eventId);
  const newCandidates = normalizedCandidates.filter((candidate) => !existingEventIds.has(candidate.eventId));
  const duplicateAck = await acknowledge(acknowledgeDecisions, duplicateIds, 'duplicate');

  if (!newCandidates.length) {
    return {
      status: duplicateAck.acknowledged ? 'duplicates' : 'ack_failed',
      imported: 0,
      duplicates: duplicateIds.length,
      acknowledged: duplicateAck.acknowledged
    };
  }

  const entries = newCandidates
    .map((candidate) => cardBudgetEntry(candidate, categorySettings, current))
    .map(normalizeBudget);
  if (entries.some((entry) => !entry)) {
    return {
      status: 'failed',
      imported: 0,
      duplicates: duplicateIds.length,
      acknowledged: duplicateAck.acknowledged
    };
  }

  let saveResult;
  try {
    saveResult = saveBudget([...entries, ...current]);
  } catch {
    saveResult = null;
  }
  if (saveResult?.saved !== true) {
    return {
      status: 'failed',
      imported: 0,
      duplicates: duplicateIds.length,
      acknowledged: duplicateAck.acknowledged
    };
  }

  const savedAck = await acknowledge(
    acknowledgeDecisions,
    newCandidates.map((candidate) => candidate.eventId),
    'saved'
  );
  return {
    status: savedAck.acknowledged ? 'imported' : 'ack_failed',
    imported: entries.length,
    duplicates: duplicateIds.length,
    acknowledged: savedAck.acknowledged && duplicateAck.acknowledged,
    items: entries
  };
}

export function cardImportSummary(entries, today) {
  const imported = (Array.isArray(entries) ? entries : []).filter((entry) => (
    entry?.source === 'card-notification'
    && entry?.origin?.kind === 'card-notification'
  ));
  return {
    total: imported.length,
    today: imported.filter((entry) => entry.date === today).length,
    recent: imported.slice(0, 3).map((entry) => ({
      id: String(entry.id || ''),
      merchant: String(entry.memo || '').slice(0, 80),
      amount: Number(entry.amount) || 0,
      date: String(entry.date || ''),
      source: String(entry.origin?.source || '')
    }))
  };
}
