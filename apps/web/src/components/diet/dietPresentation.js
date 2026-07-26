export function weightChangeLabel(summary, ready) {
  if (!ready) return '기록하면 계산해요';
  const grams = Math.round(Math.abs(summary?.estimatedWeightDeltaKg || 0) * 1000);
  if (grams < 1) return '유지로 추정';
  const direction = summary.estimatedWeightDeltaKg < 0 ? '감소' : '증가';
  return '하루 마감 약 ' + grams.toLocaleString('ko-KR') + 'g ' + direction + ' 추정';
}

export function deficitLabel(value) {
  if (value === null || value === undefined) return 'BMR 필요';
  if (value === 0) return '에너지 균형';
  return Math.abs(value).toLocaleString('ko-KR') + 'kcal ' + (value > 0 ? '적자' : '초과');
}

export function mealEmoji(mealType) {
  if (mealType === 'breakfast') return '🌅';
  if (mealType === 'lunch') return '☀️';
  if (mealType === 'dinner') return '🌙';
  return '🍎';
}

export function nutritionGrams(value) {
  return Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + 'g';
}

export function bodyProfileBasis(profile) {
  const sex = profile?.sex === 'female' ? '여성' : '남성';
  return `${profile?.age}세 ${sex} · ${profile?.heightCm}cm · ${profile?.weightKg}kg`;
}

export function confidenceLabel(confidence) {
  const value = Number(confidence);
  if (value >= 0.8) return '높음';
  if (value >= 0.55) return '보통';
  return '낮음';
}

export function hasNutrition(entry) {
  return [entry?.carbohydratesGrams, entry?.proteinGrams, entry?.fatGrams]
    .some((value) => value !== null && value !== undefined);
}
