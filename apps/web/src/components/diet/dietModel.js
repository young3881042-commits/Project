import { safeParse, safeRemoveItem, safeSetItem } from '../../utils/lifeHubStorage.js';

export const DIET_ENTRIES_KEY = 'ai-assistant-diet-entries';
export const KCAL_PER_KG_ESTIMATE = 7700;
export const DIET_MEAL_TYPES = [
  { value: 'breakfast', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
  { value: 'snack', label: '간식' }
];

const LIFEHUB_EVENT = 'lifehub:data-updated';

function storageUsername(session) {
  const username = typeof session === 'string' ? session : session?.username;
  return String(username || 'guestuser').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '_') || 'guestuser';
}

function scopedKey(session) {
  return DIET_ENTRIES_KEY + ':' + storageUsername(session);
}

function legacyStorageAllowed(session) {
  return !session || session.isGuest || session.username === 'guestuser';
}

function validDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return [year, month, day].join('-');
}

function positiveFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function mealTypeLabel(value) {
  return DIET_MEAL_TYPES.find((item) => item.value === value)?.label || '식사';
}

export function calculateCalorieTargetPercent(calories, targetCalories) {
  const consumed = Number(calories);
  const target = Number(targetCalories);
  if (!Number.isFinite(consumed) || consumed < 0 || !Number.isFinite(target) || target <= 0) return null;
  if (consumed === 0) return 0;
  return Math.max(1, Math.round((consumed / target) * 100));
}

function normalizeNutritionNumber(value, max = 2000, digits = 1) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) return null;
  const unit = 10 ** digits;
  return Math.round(number * unit) / unit;
}

export function normalizeDietEntry(entry, index = 0) {
  const calories = Math.round(Number(entry?.calories) || 0);
  if (calories <= 0 || calories > 10000) return null;
  const mealType = DIET_MEAL_TYPES.some((item) => item.value === entry?.mealType)
    ? entry.mealType
    : 'snack';
  const createdAt = entry?.createdAt || new Date().toISOString();
  const rawOrigin = entry?.origin && typeof entry.origin === 'object' ? entry.origin : null;
  const origin = rawOrigin
    ? {
        kind: String(rawOrigin.kind || '').slice(0, 40),
        requestId: String(rawOrigin.requestId || '').slice(0, 160),
        fingerprint: String(rawOrigin.fingerprint || '').slice(0, 160)
      }
    : null;
  return {
    schemaVersion: 2,
    id: String(entry?.id || ['diet', Date.now(), index].join('-')),
    date: validDateKey(entry?.date) ? entry.date : localDateKey(createdAt) || localDateKey(),
    mealType,
    food: String(entry?.food || '').trim().slice(0, 80),
    calories,
    carbohydratesGrams: normalizeNutritionNumber(entry?.carbohydratesGrams),
    proteinGrams: normalizeNutritionNumber(entry?.proteinGrams),
    fatGrams: normalizeNutritionNumber(entry?.fatGrams),
    confidence: normalizeNutritionNumber(entry?.confidence, 1, 2),
    notes: String(entry?.notes || '').trim().slice(0, 300),
    analysisSource: String(entry?.analysisSource || '').trim().slice(0, 40),
    ...(origin?.kind ? { origin } : {}),
    createdAt
  };
}

export function readDietEntries(session) {
  const key = scopedKey(session);
  const scoped = safeParse(localStorage.getItem(key), null);
  const legacy = legacyStorageAllowed(session)
    ? safeParse(localStorage.getItem(DIET_ENTRIES_KEY), null)
    : null;
  const source = Array.isArray(scoped) ? scoped : Array.isArray(legacy) ? legacy : [];
  const entries = source.map(normalizeDietEntry).filter(Boolean);
  if (!Array.isArray(scoped) && entries.length) safeSetItem(key, JSON.stringify(entries));
  return entries
    .sort((left, right) => (right.date + right.createdAt).localeCompare(left.date + left.createdAt));
}

export function saveDietEntries(session, entries) {
  const key = scopedKey(session);
  const normalized = entries.map(normalizeDietEntry).filter(Boolean);
  const saved = safeSetItem(key, JSON.stringify(normalized));
  if (saved && legacyStorageAllowed(session)) safeRemoveItem(DIET_ENTRIES_KEY);
  window.dispatchEvent(new CustomEvent(LIFEHUB_EVENT, { detail: { key } }));
  return { items: normalized, saved };
}

export function calculateDailyEnergySummary({
  bmr,
  date,
  dietEntries = [],
  workouts = []
} = {}) {
  const targetDate = validDateKey(date) ? date : localDateKey();
  const intakeCalories = dietEntries
    .filter((entry) => entry?.date === targetDate)
    .reduce((sum, entry) => sum + positiveFiniteNumber(entry?.calories), 0);
  const workoutCalories = workouts
    .filter((workout) => workout?.date === targetDate)
    .reduce((sum, workout) => sum + positiveFiniteNumber(workout?.caloriesBurned), 0);
  const restingCalories = Number.isFinite(Number(bmr)) && Number(bmr) > 0
    ? Math.round(Number(bmr))
    : null;
  const energyDeficitCalories = restingCalories === null
    ? null
    : Math.round(restingCalories + workoutCalories - intakeCalories);
  const estimatedWeightDeltaKg = energyDeficitCalories === null
    ? null
    : -(energyDeficitCalories / KCAL_PER_KG_ESTIMATE);

  return {
    date: targetDate,
    intakeCalories: Math.round(intakeCalories),
    workoutCalories: Math.round(workoutCalories),
    restingCalories,
    energyDeficitCalories,
    estimatedWeightDeltaKg
  };
}
