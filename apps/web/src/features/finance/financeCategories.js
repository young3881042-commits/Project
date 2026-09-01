import { orbitStorage } from '../../utils/orbitIndexedDbStorage.js';
export const FINANCE_CATEGORY_SETTINGS_STORAGE_KEY = 'lifehub-finance-category-settings:v1';

export const DEFAULT_FINANCE_CATEGORIES = Object.freeze([
  '식비',
  '교통',
  '커피',
  '쇼핑',
  '기타'
]);

const MAX_CATEGORY_COUNT = 32;
const MAX_CATEGORY_LENGTH = 30;
const MAX_KEYWORD_COUNT = 80;
const MAX_KEYWORD_LENGTH = 40;

function normalizeOwner(owner) {
  const value = typeof owner === 'string' ? owner : owner?.username;
  return String(value || 'guestuser')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .slice(0, 128) || 'guestuser';
}

function compactText(value, maximumLength) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength)
    .trim();
}

function categoryKey(value) {
  return normalizeFinanceCategoryName(value).toLocaleLowerCase('ko-KR');
}

function keywordKey(value) {
  return normalizeFinanceCategoryKeyword(value).toLocaleLowerCase('ko-KR');
}

function uniqueCategories(values) {
  const categories = [];
  const seen = new Set();
  for (const value of values) {
    const category = normalizeFinanceCategoryName(value);
    const key = categoryKey(category);
    if (!category || seen.has(key) || categories.length >= MAX_CATEGORY_COUNT) continue;
    seen.add(key);
    categories.push(category);
  }
  return categories;
}

function splitKeywords(value) {
  if (Array.isArray(value)) return value.flatMap(splitKeywords);
  return String(value || '').split(/[\n,，]/g);
}

function normalizedRules(values, categories) {
  const available = new Map(categories.map((category) => [categoryKey(category), category]));
  const rules = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const category = available.get(categoryKey(value?.category));
    const keyword = normalizeFinanceCategoryKeyword(value?.keyword);
    const key = `${categoryKey(category)}\u0000${keywordKey(keyword)}`;
    if (!category || !keyword || seen.has(key) || rules.length >= MAX_KEYWORD_COUNT) continue;
    seen.add(key);
    rules.push({ category, keyword });
  }
  return rules;
}

function normalizedMerchant(value) {
  return compactText(value, 80).toLocaleLowerCase('ko-KR');
}

export function normalizeFinanceCategoryName(value) {
  return compactText(value, MAX_CATEGORY_LENGTH);
}

export function normalizeFinanceCategoryKeyword(value) {
  return compactText(value, MAX_KEYWORD_LENGTH);
}

export function financeCategorySettingsStorageKey(owner) {
  return `${FINANCE_CATEGORY_SETTINGS_STORAGE_KEY}:${normalizeOwner(owner)}`;
}

export function normalizeFinanceCategorySettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const categories = uniqueCategories([
    ...DEFAULT_FINANCE_CATEGORIES,
    ...(Array.isArray(source.categories) ? source.categories : [])
  ]);
  return {
    categories,
    rules: normalizedRules(source.rules, categories)
  };
}

export function readFinanceCategorySettings(owner, storage = orbitStorage) {
  try {
    const value = storage?.getItem(financeCategorySettingsStorageKey(owner));
    return normalizeFinanceCategorySettings(value ? JSON.parse(value) : null);
  } catch {
    return normalizeFinanceCategorySettings(null);
  }
}

export function saveFinanceCategorySettings(owner, value, storage = orbitStorage) {
  const settings = normalizeFinanceCategorySettings(value);
  try {
    storage?.setItem(financeCategorySettingsStorageKey(owner), JSON.stringify(settings));
    return { saved: true, settings };
  } catch {
    return { saved: false, settings };
  }
}

export function financeCategoriesForSelection(settings, currentCategory = '', extraCategories = []) {
  const normalized = normalizeFinanceCategorySettings(settings);
  return uniqueCategories([
    ...normalized.categories,
    ...extraCategories,
    currentCategory
  ]);
}

export function customFinanceCategories(settings) {
  const defaults = new Set(DEFAULT_FINANCE_CATEGORIES.map(categoryKey));
  return normalizeFinanceCategorySettings(settings).categories
    .filter((category) => !defaults.has(categoryKey(category)));
}

export function managedFinanceCategories(settings) {
  const normalized = normalizeFinanceCategorySettings(settings);
  const defaults = new Set(DEFAULT_FINANCE_CATEGORIES.map(categoryKey));
  const categoriesWithKeywords = new Set(
    normalized.rules.map((rule) => categoryKey(rule.category))
  );
  return normalized.categories.filter((category) => (
    !defaults.has(categoryKey(category)) || categoriesWithKeywords.has(categoryKey(category))
  ));
}

export function keywordsForFinanceCategory(settings, category) {
  const target = categoryKey(category);
  return normalizeFinanceCategorySettings(settings).rules
    .filter((rule) => categoryKey(rule.category) === target)
    .map((rule) => rule.keyword);
}

export function addFinanceCategory(settings, { category, keywords } = {}) {
  const normalized = normalizeFinanceCategorySettings(settings);
  const requestedCategory = normalizeFinanceCategoryName(category);
  if (!requestedCategory) {
    return { changed: false, error: '분류 이름을 입력해주세요.', settings: normalized };
  }

  const existing = normalized.categories.find((item) => categoryKey(item) === categoryKey(requestedCategory));
  const nextCategory = existing || requestedCategory;
  if (!existing && normalized.categories.length >= MAX_CATEGORY_COUNT) {
    return { changed: false, error: '분류는 최대 32개까지 추가할 수 있어요.', settings: normalized };
  }

  const nextCategories = existing
    ? normalized.categories
    : [...normalized.categories, nextCategory];
  const nextRules = [...normalized.rules];
  const knownRules = new Set(nextRules.map((rule) => `${categoryKey(rule.category)}\u0000${keywordKey(rule.keyword)}`));
  let addedRules = 0;
  for (const rawKeyword of splitKeywords(keywords)) {
    const keyword = normalizeFinanceCategoryKeyword(rawKeyword);
    const key = `${categoryKey(nextCategory)}\u0000${keywordKey(keyword)}`;
    if (!keyword || knownRules.has(key) || nextRules.length >= MAX_KEYWORD_COUNT) continue;
    knownRules.add(key);
    nextRules.push({ category: nextCategory, keyword });
    addedRules += 1;
  }
  const next = normalizeFinanceCategorySettings({ categories: nextCategories, rules: nextRules });
  return {
    changed: !existing || addedRules > 0,
    addedCategory: !existing,
    addedRules,
    settings: next
  };
}

export function removeFinanceCategory(settings, category) {
  const normalized = normalizeFinanceCategorySettings(settings);
  const target = categoryKey(category);
  const defaults = new Set(DEFAULT_FINANCE_CATEGORIES.map(categoryKey));
  if (!target || defaults.has(target)) {
    return { changed: false, protected: true, settings: normalized };
  }
  const categories = normalized.categories.filter((item) => categoryKey(item) !== target);
  if (categories.length === normalized.categories.length) {
    return { changed: false, settings: normalized };
  }
  return {
    changed: true,
    settings: normalizeFinanceCategorySettings({
      categories,
      rules: normalized.rules.filter((rule) => categoryKey(rule.category) !== target)
    })
  };
}

export function removeFinanceCategoryKeyword(settings, category, keyword) {
  const normalized = normalizeFinanceCategorySettings(settings);
  const targetCategory = categoryKey(category);
  const targetKeyword = keywordKey(keyword);
  const rules = normalized.rules.filter((rule) => (
    categoryKey(rule.category) !== targetCategory || keywordKey(rule.keyword) !== targetKeyword
  ));
  if (rules.length === normalized.rules.length) {
    return { changed: false, settings: normalized };
  }
  return {
    changed: true,
    settings: normalizeFinanceCategorySettings({ categories: normalized.categories, rules })
  };
}

export function financeCategoryForMerchant(merchant, settings) {
  const text = normalizedMerchant(merchant);
  if (!text) return '기타';
  const rules = [...normalizeFinanceCategorySettings(settings).rules]
    .sort((left, right) => right.keyword.length - left.keyword.length);
  const matchedRule = rules.find((rule) => text.includes(keywordKey(rule.keyword)));
  if (matchedRule) return matchedRule.category;

  if (text.includes('코레일') || text.includes('티머니')) return '교통';
  if (text.includes('커피')) return '커피';
  if (text.includes('다이소')) return '기타';
  return '기타';
}
