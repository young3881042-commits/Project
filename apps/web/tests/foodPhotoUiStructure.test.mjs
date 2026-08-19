import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('식단 화면은 음식 사진 AI 없이 수동 기록 흐름만 제공한다', async () => {
  const [page, form] = await Promise.all([
    readSource('../src/components/diet/DietPage.jsx'),
    readSource('../src/components/diet/DietEntryForm.jsx')
  ]);

  assert.match(page, /<DietEnergySummaryCard/);
  assert.match(page, /<DietEntryForm/);
  assert.match(page, /<DietEntryList/);
  assert.doesNotMatch(page, /FoodPhotoAnalyzerCard|useFoodPhotoAnalyzer|useBridgeConnection|foodPhotoAnalysis|\/ai\/settings/);
  assert.match(form, /aria-label="먹은 칼로리"/);
  assert.match(form, /먹은 음식 <small>선택<\/small>/);
  assert.match(form, /LifeHubButton type="submit"[\s\S]*식단 저장/);
  assert.doesNotMatch(form, /사진|AI|Bridge|lifeHubDietAiDraft/);
});

test('수동 식단은 에너지 기준·삭제 동작과 접근성 스타일을 유지한다', async () => {
  const [energy, list, styles] = await Promise.all([
    readSource('../src/components/diet/DietEnergySummaryCard.jsx'),
    readSource('../src/components/diet/DietEntryList.jsx'),
    readSource('../src/styles/lifehub-diet.css')
  ]);

  assert.match(energy, /BMR \+ 운동 비교 기준/);
  assert.match(energy, /<details className="lifeHubDietBasis">/);
  assert.match(list, /onDelete\(entry\)/);
  assert.match(styles, /--diet-violet:/);
  assert.match(styles, /\.lifeHubDietDeleteButton[\s\S]*?min-height: 44px/);
  assert.match(styles, /outline: 3px solid var\(--diet-violet-strong\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
