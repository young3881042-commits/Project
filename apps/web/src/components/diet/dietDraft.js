export const EMPTY_NUTRITION_DRAFT = Object.freeze({
  carbohydratesGrams: null,
  proteinGrams: null,
  fatGrams: null,
  confidence: null,
  notes: '',
  analysisSource: ''
});

export function mealTypeForHour(hour) {
  const normalizedHour = Number(hour);
  if (normalizedHour >= 5 && normalizedHour <= 10) return 'breakfast';
  if (normalizedHour >= 11 && normalizedHour <= 15) return 'lunch';
  if (normalizedHour >= 16 && normalizedHour <= 21) return 'dinner';
  return 'snack';
}

export function createDietDraft(hour = new Date().getHours()) {
  return {
    mealType: mealTypeForHour(hour),
    food: '',
    calories: '',
    ...EMPTY_NUTRITION_DRAFT
  };
}

export function clearDietDraftNutrition(draft) {
  return {
    ...draft,
    ...EMPTY_NUTRITION_DRAFT
  };
}

export function applyPhotoAnalysisToDraft(draft, analysis) {
  if (!analysis) return { ...draft };
  return {
    ...draft,
    food: analysis.foodName,
    calories: String(analysis.caloriesKcal),
    carbohydratesGrams: analysis.carbohydratesGrams,
    proteinGrams: analysis.proteinGrams,
    fatGrams: analysis.fatGrams,
    confidence: analysis.confidence,
    notes: analysis.notes,
    analysisSource: analysis.analysisSource || analysis.source || 'food-photo-ai'
  };
}

export function syncPhotoAnalysisDraft(draft, adjustedAnalysis) {
  return draft.analysisSource && adjustedAnalysis
    ? applyPhotoAnalysisToDraft(draft, adjustedAnalysis)
    : draft;
}

export function shouldPreserveDraftAfterPhotoRecord(draft, draftedAnalysis, currentAnalysis) {
  return Boolean(draft.food || draft.calories) && draftedAnalysis !== currentAnalysis;
}

export function updateDietDraftField(draft, field, value) {
  const updatedDraft = {
    ...draft,
    [field]: value
  };
  const nutritionWasAnalyzed = Boolean(draft.analysisSource);
  const manuallyEditedAnalysisInput = field === 'food' || field === 'calories';
  return nutritionWasAnalyzed && manuallyEditedAnalysisInput
    ? clearDietDraftNutrition(updatedDraft)
    : updatedDraft;
}
