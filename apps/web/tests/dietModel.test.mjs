import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DIET_ENTRIES_KEY,
  KCAL_PER_KG_ESTIMATE,
  calculateCalorieTargetPercent,
  calculateDailyEnergySummary,
  normalizeDietEntry,
  readDietEntries,
  saveDietEntries
} from '../src/components/diet/dietModel.js';
import {
  FOOD_PHOTO_ACCEPT,
  FOOD_PORTION_OPTIONS,
  adjustFoodPhotoAnalysisPortion,
  foodPhotoDataUrlByteLength,
  foodPhotoErrorMessage,
  fitFoodPhotoDimensions,
  normalizeFoodPhotoAnalysis,
  prepareFoodPhotoForAnalysis,
  validateFoodPhotoFile
} from '../src/components/diet/foodPhotoAnalysis.js';

class MemoryStorage {
  #items = new Map();

  clear() {
    this.#items.clear();
  }

  getItem(key) {
    return this.#items.has(key) ? this.#items.get(key) : null;
  }

  removeItem(key) {
    this.#items.delete(key);
  }

  setItem(key, value) {
    this.#items.set(key, String(value));
  }
}

globalThis.localStorage = new MemoryStorage();
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};
globalThis.window = { dispatchEvent() {} };

test('식단 기록은 유효한 양의 칼로리만 정규화한다', () => {
  assert.equal(normalizeDietEntry({ calories: '' }), null);
  assert.equal(normalizeDietEntry({ calories: 0 }), null);
  assert.equal(normalizeDietEntry({ calories: -120 }), null);
  assert.equal(normalizeDietEntry({ calories: 10001 }), null);

  const entry = normalizeDietEntry({
    id: 'meal-1',
    date: '2026-07-11',
    mealType: 'lunch',
    food: '  비빔밥  ',
    calories: '620',
    createdAt: '2026-07-11T04:00:00.000Z'
  });
  assert.deepEqual(entry, {
    schemaVersion: 2,
    id: 'meal-1',
    date: '2026-07-11',
    mealType: 'lunch',
    food: '비빔밥',
    calories: 620,
    carbohydratesGrams: null,
    proteinGrams: null,
    fatGrams: null,
    confidence: null,
    notes: '',
    analysisSource: '',
    createdAt: '2026-07-11T04:00:00.000Z'
  });
});

test('v1 식단을 읽고 AI 영양 분석 필드는 schemaVersion 2로 보존한다', () => {
  const legacy = normalizeDietEntry({
    schemaVersion: 1,
    id: 'legacy-meal',
    date: '2026-07-11',
    food: '김밥',
    calories: 430
  });
  assert.equal(legacy.schemaVersion, 2);
  assert.equal(legacy.carbohydratesGrams, null);

  const analyzed = normalizeDietEntry({
    id: 'analyzed-meal',
    date: '2026-07-11',
    food: '비빔밥',
    calories: 620,
    carbohydratesGrams: 85.24,
    proteinGrams: 23.05,
    fatGrams: 19,
    confidence: 0.784,
    notes: '사진 전체 1회 제공량 추정',
    analysisSource: 'food-photo-ai'
  });
  assert.deepEqual({
    carbohydratesGrams: analyzed.carbohydratesGrams,
    proteinGrams: analyzed.proteinGrams,
    fatGrams: analyzed.fatGrams,
    confidence: analyzed.confidence,
    notes: analyzed.notes,
    analysisSource: analyzed.analysisSource
  }, {
    carbohydratesGrams: 85.2,
    proteinGrams: 23.1,
    fatGrams: 19,
    confidence: 0.78,
    notes: '사진 전체 1회 제공량 추정',
    analysisSource: 'food-photo-ai'
  });
});

test('오늘 BMR·운동·섭취로 에너지 적자와 단순 체중 변화 추정치를 계산한다', () => {
  const summary = calculateDailyEnergySummary({
    bmr: 1700,
    date: '2026-07-11',
    dietEntries: [
      { date: '2026-07-11', calories: 500 },
      { date: '2026-07-11', calories: 700 },
      { date: '2026-07-11', calories: Number.POSITIVE_INFINITY },
      { date: '2026-07-11', calories: 'not-a-number' },
      { date: '2026-07-11', calories: -200 },
      { date: '2026-07-10', calories: 900 }
    ],
    workouts: [
      { date: '2026-07-11', caloriesBurned: 300 },
      { date: '2026-07-11', caloriesBurned: Number.POSITIVE_INFINITY },
      { date: '2026-07-11', caloriesBurned: -100 },
      { date: '2026-07-10', caloriesBurned: 400 }
    ]
  });

  assert.equal(summary.intakeCalories, 1200);
  assert.equal(summary.workoutCalories, 300);
  assert.equal(summary.energyDeficitCalories, 800);
  assert.equal(summary.estimatedWeightDeltaKg, -(800 / KCAL_PER_KG_ESTIMATE));
});

test('BMR이 없으면 섭취와 운동은 합산하되 체중 변화는 계산하지 않는다', () => {
  const summary = calculateDailyEnergySummary({
    bmr: null,
    date: '2026-07-11',
    dietEntries: [{ date: '2026-07-11', calories: 500 }],
    workouts: [{ date: '2026-07-11', caloriesBurned: 200 }]
  });

  assert.equal(summary.intakeCalories, 500);
  assert.equal(summary.workoutCalories, 200);
  assert.equal(summary.energyDeficitCalories, null);
  assert.equal(summary.estimatedWeightDeltaKg, null);
});

test('분석 음식 칼로리를 저장된 신체정보 기반 하루 기준의 퍼센트로 계산한다', () => {
  const summary = calculateDailyEnergySummary({
    bmr: 1700,
    date: '2026-07-11',
    workouts: [{ date: '2026-07-11', caloriesBurned: 300 }]
  });
  const targetCalories = summary.restingCalories + summary.workoutCalories;

  assert.equal(targetCalories, 2000);
  assert.equal(calculateCalorieTargetPercent(620, targetCalories), 31);
  assert.equal(calculateCalorieTargetPercent(1, targetCalories), 1);
  assert.equal(calculateCalorieTargetPercent(0, targetCalories), 0);
  assert.equal(calculateCalorieTargetPercent(2500, targetCalories), 125);
  assert.equal(calculateCalorieTargetPercent(620, null), null);
  assert.equal(calculateCalorieTargetPercent(-1, targetCalories), null);
  assert.equal(calculateCalorieTargetPercent(Number.POSITIVE_INFINITY, targetCalories), null);
});

test('식단 기록은 기기 소유자 키에 저장되고 선택 삭제 후에도 유지된다', () => {
  localStorage.clear();
  const session = { username: 'local-owner', isGuest: false };
  const first = {
    id: 'meal-1',
    date: '2026-07-11',
    mealType: 'breakfast',
    food: '요거트',
    calories: 180,
    carbohydratesGrams: 21.4,
    proteinGrams: 9.2,
    fatGrams: 5.1,
    confidence: 0.82,
    notes: '한 그릇 추정',
    analysisSource: 'food-photo-ai',
    createdAt: '2026-07-11T01:00:00.000Z'
  };
  const second = {
    id: 'meal-2',
    date: '2026-07-11',
    mealType: 'lunch',
    food: '샐러드',
    calories: 420,
    createdAt: '2026-07-11T04:00:00.000Z'
  };

  assert.equal(saveDietEntries(session, [first, second]).saved, true);
  assert.equal(localStorage.getItem(DIET_ENTRIES_KEY), null);
  assert.deepEqual(readDietEntries(session).map((entry) => entry.id), ['meal-2', 'meal-1']);
  assert.deepEqual(
    readDietEntries(session).find((entry) => entry.id === 'meal-1'),
    normalizeDietEntry(first)
  );

  const remaining = readDietEntries(session).filter((entry) => entry.id !== 'meal-2');
  assert.equal(saveDietEntries(session, remaining).saved, true);
  assert.deepEqual(readDietEntries(session).map((entry) => entry.id), ['meal-1']);
});

test('음식 사진은 JPEG·PNG·WebP만 받고 1280px 안에서 원본 비율을 유지한다', () => {
  assert.equal(FOOD_PHOTO_ACCEPT, 'image/jpeg,image/png,image/webp');
  assert.deepEqual(validateFoodPhotoFile({ type: 'image/jpeg', size: 2048 }), {
    type: 'image/jpeg',
    size: 2048
  });
  assert.throws(
    () => validateFoodPhotoFile({ type: 'image/heic', size: 2048 }),
    /JPEG, PNG, WebP/
  );
  assert.deepEqual(fitFoodPhotoDimensions(4000, 2000), { width: 1280, height: 640 });
  assert.deepEqual(fitFoodPhotoDimensions(600, 900), { width: 600, height: 900 });
});

test('음식 사진을 JPEG data URL로 축소하고 지정 용량 이하로 낮춘다', async () => {
  const originalBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  let closed = false;
  let drawn = null;
  globalThis.createImageBitmap = async () => ({
    width: 2560,
    height: 1280,
    close() { closed = true; }
  });
  globalThis.document = {
    createElement(name) {
      assert.equal(name, 'canvas');
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillStyle: '',
            fillRect() {},
            drawImage(_source, _x, _y, width, height) { drawn = { width, height }; }
          };
        },
        toDataURL(_type, quality) {
          const bytes = quality > 0.5 ? 24 : 9;
          return `data:image/jpeg;base64,${Buffer.alloc(bytes).toString('base64')}`;
        }
      };
    }
  };

  try {
    const prepared = await prepareFoodPhotoForAnalysis(
      { type: 'image/png', size: 4096 },
      { maxBytes: 40 }
    );
    assert.deepEqual(drawn, { width: 1280, height: 640 });
    assert.equal(prepared.width, 1280);
    assert.equal(prepared.height, 640);
    assert.equal(prepared.bytes, foodPhotoDataUrlByteLength(prepared.imageDataUrl));
    assert.ok(foodPhotoDataUrlByteLength(prepared.imageDataUrl) <= 40);
    assert.equal(closed, true);
  } finally {
    if (originalBitmap === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = originalBitmap;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('AI 음식 분석 JSON 계약을 검증하고 표시 단위로 정규화한다', () => {
  assert.deepEqual(normalizeFoodPhotoAnalysis({
    foodName: ' 비빔밥 ',
    caloriesKcal: 619.6,
    carbohydratesGrams: 85.24,
    proteinGrams: 23.05,
    fatGrams: 19,
    confidence: 0.784,
    notes: ' 사진 전체 1회 제공량 추정 '
  }), {
    foodName: '비빔밥',
    caloriesKcal: 620,
    carbohydratesGrams: 85.2,
    proteinGrams: 23.1,
    fatGrams: 19,
    confidence: 0.78,
    notes: '사진 전체 1회 제공량 추정'
  });
  assert.throws(
    () => normalizeFoodPhotoAnalysis({
      foodName: '비빔밥',
      caloriesKcal: '620',
      carbohydratesGrams: 85,
      proteinGrams: 23,
      fatGrams: 19,
      confidence: 0.8,
      notes: ''
    }),
    /칼로리 값이 올바르지 않아요/
  );
});

test('양 보정은 원본 AI 결과를 바꾸지 않고 칼로리와 모든 영양값에 한 번만 적용한다', () => {
  const original = normalizeFoodPhotoAnalysis({
    foodName: '비빔밥',
    caloriesKcal: 620,
    carbohydratesGrams: 85.2,
    proteinGrams: 23.1,
    fatGrams: 19,
    confidence: 0.78,
    notes: '사진 전체 추정'
  });
  const snapshot = structuredClone(original);
  const halfPortion = adjustFoodPhotoAnalysisPortion(original, 0.5);

  assert.deepEqual(FOOD_PORTION_OPTIONS.map(({ value }) => value), [0.5, 0.75, 1, 1.25]);
  assert.deepEqual(FOOD_PORTION_OPTIONS.map(({ label }) => label), ['반만', '조금 덜', '사진만큼', '조금 더']);
  assert.notEqual(halfPortion, original);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(halfPortion, {
    ...original,
    caloriesKcal: 310,
    carbohydratesGrams: 42.6,
    proteinGrams: 11.6,
    fatGrams: 9.5,
    notes: '사진 전체 추정 · 양 보정 50%'
  });
  assert.deepEqual(adjustFoodPhotoAnalysisPortion(original, 0.5), halfPortion);
  assert.deepEqual(adjustFoodPhotoAnalysisPortion(original, 1), original);
  assert.deepEqual(adjustFoodPhotoAnalysisPortion(original, 99), original);
});

test('Codex 음식 분석 서버 설정 오류를 사용자용 문구로 변환한다', () => {
  assert.equal(
    foodPhotoErrorMessage({ code: 'CODEX_LOGIN_REQUIRED' }),
    'PC의 Codex 로그인이 만료됐어요. 서버에서 다시 로그인해주세요.'
  );
  assert.equal(
    foodPhotoErrorMessage({ code: 'CODEX_UNAVAILABLE' }),
    'PC의 Codex를 실행할 수 없어요. 서버 상태를 확인해주세요.'
  );
});
