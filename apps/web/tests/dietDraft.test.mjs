import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_NUTRITION_DRAFT,
  applyPhotoAnalysisToDraft,
  clearDietDraftNutrition,
  createDietDraft,
  mealTypeForHour,
  shouldPreserveDraftAfterPhotoRecord,
  syncPhotoAnalysisDraft,
  updateDietDraftField
} from '../src/components/diet/dietDraft.js';

test('시간 경계에 맞춰 아침·점심·저녁·간식을 고른다', () => {
  assert.equal(mealTypeForHour(4), 'snack');
  assert.equal(mealTypeForHour(5), 'breakfast');
  assert.equal(mealTypeForHour(10), 'breakfast');
  assert.equal(mealTypeForHour(11), 'lunch');
  assert.equal(mealTypeForHour(15), 'lunch');
  assert.equal(mealTypeForHour(16), 'dinner');
  assert.equal(mealTypeForHour(21), 'dinner');
  assert.equal(mealTypeForHour(22), 'snack');
  assert.equal(mealTypeForHour(0), 'snack');
});

test('빈 초안은 현재 식사 시간과 독립된 영양 기본값으로 생성한다', () => {
  const breakfast = createDietDraft(7);
  const dinner = createDietDraft(18);

  assert.deepEqual(breakfast, {
    mealType: 'breakfast',
    food: '',
    calories: '',
    ...EMPTY_NUTRITION_DRAFT
  });
  assert.equal(dinner.mealType, 'dinner');
  assert.notEqual(breakfast, dinner);
  assert.equal(Object.isFrozen(EMPTY_NUTRITION_DRAFT), true);
});

test('사진 분석을 음식·칼로리·영양 메타데이터에 적용한다', () => {
  const draft = createDietDraft(12);
  const analysis = {
    foodName: '닭가슴살 샐러드',
    caloriesKcal: 410,
    carbohydratesGrams: 34.2,
    proteinGrams: 39.1,
    fatGrams: 12.5,
    confidence: 0.86,
    notes: '사진 속 한 접시 기준'
  };

  const result = applyPhotoAnalysisToDraft(draft, analysis);

  assert.deepEqual(result, {
    mealType: 'lunch',
    food: '닭가슴살 샐러드',
    calories: '410',
    carbohydratesGrams: 34.2,
    proteinGrams: 39.1,
    fatGrams: 12.5,
    confidence: 0.86,
    notes: '사진 속 한 접시 기준',
    analysisSource: 'food-photo-ai'
  });
  assert.deepEqual(draft, createDietDraft(12));
});

test('AI 초안의 음식이나 칼로리를 직접 수정하면 AI 영양값을 비운다', () => {
  const analyzed = applyPhotoAnalysisToDraft(createDietDraft(12), {
    foodName: '비빔밥',
    caloriesKcal: 620,
    carbohydratesGrams: 85,
    proteinGrams: 23,
    fatGrams: 19,
    confidence: 0.78,
    notes: '한 그릇 기준'
  });

  const changedFood = updateDietDraftField(analyzed, 'food', '돌솥비빔밥');
  const changedCalories = updateDietDraftField(analyzed, 'calories', '700');

  assert.deepEqual(changedFood, {
    ...analyzed,
    food: '돌솥비빔밥',
    ...EMPTY_NUTRITION_DRAFT
  });
  assert.deepEqual(changedCalories, {
    ...analyzed,
    calories: '700',
    ...EMPTY_NUTRITION_DRAFT
  });
  assert.equal(analyzed.analysisSource, 'food-photo-ai');
});

test('식사 종류 변경은 AI 영양값을 유지하고 수동 초안 수정은 다른 값을 건드리지 않는다', () => {
  const analyzed = applyPhotoAnalysisToDraft(createDietDraft(8), {
    foodName: '그릭 요거트',
    caloriesKcal: 230,
    carbohydratesGrams: 20,
    proteinGrams: 17,
    fatGrams: 9,
    confidence: 0.9,
    notes: '한 그릇 기준'
  });
  const dinner = updateDietDraftField(analyzed, 'mealType', 'dinner');
  assert.deepEqual(dinner, { ...analyzed, mealType: 'dinner' });

  const manual = { ...createDietDraft(8), food: '바나나', calories: '100' };
  assert.deepEqual(updateDietDraftField(manual, 'calories', '110'), {
    ...manual,
    calories: '110'
  });
});

test('영양 초기화는 원본을 변경하지 않고 식사와 기본 입력은 보존한다', () => {
  const draft = {
    ...createDietDraft(17),
    food: '파스타',
    calories: '680',
    carbohydratesGrams: 92,
    proteinGrams: 24,
    fatGrams: 22,
    confidence: 0.76,
    notes: 'AI 추정',
    analysisSource: 'food-photo-ai'
  };

  const cleared = clearDietDraftNutrition(draft);

  assert.deepEqual(cleared, {
    mealType: 'dinner',
    food: '파스타',
    calories: '680',
    ...EMPTY_NUTRITION_DRAFT
  });
  assert.equal(draft.proteinGrams, 24);
  assert.notEqual(cleared, draft);
});

test('양을 다시 고르면 손대지 않은 AI 초안만 새 분석값과 동기화한다', () => {
  const original = applyPhotoAnalysisToDraft(createDietDraft(12), {
    foodName: '비빔밥',
    caloriesKcal: 620,
    carbohydratesGrams: 85,
    proteinGrams: 23,
    fatGrams: 19,
    confidence: 0.78,
    notes: '사진만큼'
  });
  const half = {
    foodName: '비빔밥',
    caloriesKcal: 310,
    carbohydratesGrams: 42.5,
    proteinGrams: 11.5,
    fatGrams: 9.5,
    confidence: 0.78,
    notes: '반만'
  };

  assert.deepEqual(syncPhotoAnalysisDraft(original, half), {
    ...original,
    calories: '310',
    carbohydratesGrams: 42.5,
    proteinGrams: 11.5,
    fatGrams: 9.5,
    notes: '반만'
  });

  const manuallyEdited = updateDietDraftField(original, 'calories', '500');
  assert.equal(manuallyEdited.analysisSource, '');
  assert.equal(syncPhotoAnalysisDraft(manuallyEdited, half), manuallyEdited);
  assert.equal(manuallyEdited.calories, '500');
});

test('사진 바로 기록은 관련 없는 수동 초안만 보존한다', () => {
  const currentAnalysis = { foodName: '샐러드' };
  const manualDraft = { ...createDietDraft(12), food: '바나나', calories: '100' };
  const emptyDraft = createDietDraft(12);

  assert.equal(shouldPreserveDraftAfterPhotoRecord(manualDraft, null, currentAnalysis), true);
  assert.equal(shouldPreserveDraftAfterPhotoRecord(manualDraft, currentAnalysis, currentAnalysis), false);
  assert.equal(shouldPreserveDraftAfterPhotoRecord(emptyDraft, null, currentAnalysis), false);
});
