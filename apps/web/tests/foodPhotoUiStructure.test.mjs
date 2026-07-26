import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('식단 페이지는 조립 역할만 맡고 사진 요청과 표시 컴포넌트를 분리한다', async () => {
  const source = await readSource('../src/components/diet/DietPage.jsx');

  assert.match(source, /useFoodPhotoAnalyzer\(\{ bridgeClient, bridgeStatus \}\)/);
  assert.match(source, /<FoodPhotoAnalyzerCard/);
  assert.match(source, /<DietEnergySummaryCard/);
  assert.match(source, /<DietEntryForm/);
  assert.match(source, /<DietEntryList/);
  assert.doesNotMatch(source, /prepareFoodPhotoForAnalysis|URL\.createObjectURL|new AbortController/);
  assert.doesNotMatch(source, /document\.(?:querySelector|getElementById)/);
  assert.ok(source.split('\n').length < 300, 'DietPage는 작은 조립 컴포넌트로 유지합니다.');
});

test('사진 분석 훅은 요청·미리보기 수명과 양 보정을 한 곳에서 관리한다', async () => {
  const source = await readSource('../src/components/diet/food-photo/useFoodPhotoAnalyzer.js');

  assert.match(source, /requestRef\.current\?\.abort\(\)/);
  assert.match(source, /URL\.revokeObjectURL/);
  assert.match(source, /clearSelectedPhoto\(\);[\s\S]*?setError\(error\)/);
  assert.match(source, /selectedFileRef\.current/);
  assert.match(source, /const retry = useCallback/);
  assert.match(source, /setPortionMultiplierState\(1\)/);
  assert.match(source, /adjustFoodPhotoAnalysisPortion\(analysis, portionMultiplier\)/);
});

test('사진 분석 UI는 세 단계·재시도·삭제·바로 기록과 접근 가능한 상태를 제공한다', async () => {
  const source = await readSource('../src/components/diet/food-photo/FoodPhotoAnalyzerCard.jsx');

  assert.match(source, /aria-busy=\{isAnalyzing\}/);
  assert.match(source, /role="status"/);
  assert.match(source, /사진 한 장이면 톡톡 계산해요/);
  assert.match(source, /사진 고르기.*분석하기.*기록하기/s);
  assert.match(source, /다시 분석/);
  assert.match(source, /lifeHubDietPhotoOverlay[\s\S]*?분석 취소/);
  assert.match(source, /disabled=\{!connected\}/);
  assert.match(source, /<fieldset className="lifeHubDietPortionPicker"/);
  assert.match(source, /type="radio"/);
  assert.match(source, /checked=\{portionMultiplier === option\.value\}/);
  assert.match(source, /으로 바로 기록/);
  assert.match(source, /입력칸에서 수정/);
  assert.doesNotMatch(source, /×\{option\.value\}|내 하루 기준/);
});

test('식단 UX는 AI 메타데이터 제거, 모바일 터치 크기와 모션 감소를 명시한다', async () => {
  const [form, energy, styles] = await Promise.all([
    readSource('../src/components/diet/DietEntryForm.jsx'),
    readSource('../src/components/diet/DietEnergySummaryCard.jsx'),
    readSource('../src/styles/lifehub-diet.css')
  ]);

  assert.match(form, /AI 영양정보 지우기/);
  assert.match(form, /onChangeField\('calories'/);
  assert.match(energy, /BMR \+ 운동 비교 기준/);
  assert.match(energy, /<details className="lifeHubDietBasis">/);
  assert.match(styles, /--diet-violet:/);
  assert.match(styles, /\.lifeHubDietDeleteButton[\s\S]*?min-height: 44px/);
  assert.match(styles, /\.lifeHubDietAiClear[\s\S]*?min-height: 44px/);
  assert.match(styles, /outline: 3px solid var\(--diet-violet-strong\)/);
  assert.match(styles, /@media \(max-width: 400px\)[\s\S]*?grid-template-columns: repeat\(2/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
