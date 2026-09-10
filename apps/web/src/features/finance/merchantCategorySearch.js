import { orbitStorage } from '../../utils/orbitIndexedDbStorage.js';
import { normalizeFinanceCategorySettings } from './financeCategories.js';
import { categoryFromExistingData, merchantKey, publicMerchantName } from './merchantCategoryModel.js';
import { travelApi } from '../travel/travelApi.js';

export async function searchMerchantCategories(merchants, categories, { api = travelApi, isCurrent = () => true, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const id = globalThis.crypto.randomUUID();
  await api('merchant-create', { id, merchants, categories });
  const deadline = Date.now() + 190000;
  while (isCurrent() && Date.now() < deadline) {
    if (globalThis.document?.visibilityState === 'hidden') { await wait(2000); continue; }
    const job = await api('merchant-poll', { id });
    if (job.state === 'completed') return job.results;
    if (job.state === 'failed') throw Error('검색 분류를 완료하지 못했어요.');
    await wait(2000);
  }
  throw Error('검색 분류를 다음에 다시 시도해주세요.');
}

export async function enrichImportedCategories({ owner, selectedSources, readBudget, saveBudget, getSettings,
  isCurrent = () => true, onSaved = () => {}, onSearching = () => {}, storage = orbitStorage, lookup = searchMerchantCategories }) {
  const key = `orbit-merchant-categories:v1:${owner}`;
  let cache = {};
  try { const value = JSON.parse(storage.getItem(key) || '{}'); if (value && typeof value === 'object' && !Array.isArray(value)) cache = value; } catch {}
  const eligible = entry => entry?.source === 'card-notification' && entry.origin?.kind === 'card-notification'
    && selectedSources.includes(entry.origin.source) && entry.category === '기타';
  if (!isCurrent()) return { changed: 0 };
  let current = readBudget();
  const settings = getSettings();
  const categories = normalizeFinanceCategorySettings(settings).categories;
  let changed = 0;
  const local = current.map(entry => {
    if (!eligible(entry)) return entry;
    const category = categoryFromExistingData(entry.memo, current, settings);
    const record = cache[merchantKey(entry.memo)];
    const cached = record?.expires > Date.now() && categories.includes(record.category) ? record.category : '기타';
    const next = category !== '기타' ? category : cached;
    if (next === '기타') return entry;
    changed++; return { ...entry, category: next };
  });
  if (changed) {
    if (!isCurrent() || saveBudget(local)?.saved !== true) return { changed: 0, failed: true };
    onSaved();
  }
  current = readBudget();
  const names = [...new Set(current.filter(eligible).map(entry => publicMerchantName(entry.memo)).filter(Boolean))]
    .filter(name => !(cache[merchantKey(name)]?.expires > Date.now() && categories.includes(cache[merchantKey(name)]?.category))).slice(0, 8);
  if (!names.length || !isCurrent()) return { changed };
  const targets = new Map(current.filter(entry => eligible(entry) && names.includes(publicMerchantName(entry.memo)))
    .map(entry => [entry.id, entry.memo]));
  onSearching(names.length);
  let results;
  try { results = await lookup(names, categories, { isCurrent }); }
  catch {
    // Do not keep waking Codex on every focus event when the connection is unavailable.
    if (isCurrent()) {
      for (const name of names) cache[merchantKey(name)] = { category: '기타', expires: Date.now() + 10 * 60 * 1000 };
      try { storage.setItem(key, JSON.stringify(cache)); } catch {}
    }
    return { changed, deferred: true };
  }
  if (!isCurrent()) return { changed };
  const allowed = normalizeFinanceCategorySettings(getSettings()).categories;
  const resolved = new Map();
  for (const name of names) {
    const row = Array.isArray(results) ? results.find(item => item.merchant === name) : null;
    const category = allowed.includes(row?.category) && /^https:\/\//.test(row?.source || '') ? row.category : '기타';
    resolved.set(merchantKey(name), category);
    cache[merchantKey(name)] = { category, source: typeof row?.source === 'string' ? row.source.slice(0, 1000) : '', expires: Date.now() + (category === '기타' ? 1 : 30) * 86400000 };
  }
  cache = Object.fromEntries(Object.entries(cache).filter(([, value]) => value?.expires > Date.now()).slice(-300));
  try { storage.setItem(key, JSON.stringify(cache)); } catch {}
  // Re-read after network I/O: never restore a deleted record or replace the user's edit.
  const latest = readBudget(); let searchedChanges = 0;
  const items = latest.map(entry => {
    if (!eligible(entry) || targets.get(entry.id) !== entry.memo) return entry;
    const category = categoryFromExistingData(entry.memo, latest, getSettings());
    const next = category !== '기타' ? category : resolved.get(merchantKey(entry.memo));
    if (!next || next === '기타') return entry;
    searchedChanges++; return { ...entry, category: next };
  });
  if (searchedChanges && isCurrent()) {
    if (saveBudget(items)?.saved !== true) return { changed, failed: true };
    changed += searchedChanges; onSaved();
  }
  return { changed };
}
