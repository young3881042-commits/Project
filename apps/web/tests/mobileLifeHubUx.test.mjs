import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const WEB_ROOT = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, WEB_ROOT), 'utf8');

test('AI 작성기는 데스크톱 fine pointer에서만 Enter 전송을 허용한다', async () => {
  const assistant = await source('src/features/lifehub-ai/AiAssistantPage.jsx');

  assert.match(assistant, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(assistant, /event\?\.key !== 'Enter'/);
  assert.match(assistant, /event\.shiftKey/);
  assert.match(assistant, /event\.nativeEvent\?\.isComposing/);
  assert.match(assistant, /typeof matchMedia !== 'function'/);
  assert.match(assistant, /if \(shouldSubmitComposerOnEnter\(event\)\) \{\s*event\.preventDefault\(\);\s*submit\(event\);/);
  assert.doesNotMatch(assistant, /event\.key === 'Enter' && !event\.shiftKey/);
});

test('사진 선택 문구는 APK가 제공하는 파일 선택 기능과 일치한다', async () => {
  const photoCard = await source('src/components/diet/food-photo/FoodPhotoAnalyzerCard.jsx');

  assert.match(photoCard, />사진 고르기<\/span>/);
  assert.doesNotMatch(photoCard, /사진 찍거나 고르기/);
});

test('모바일 피드백과 AI 작업 버튼은 충분한 터치 높이를 갖는다', async () => {
  const [lifeHubCss, aiCss] = await Promise.all([
    source('src/styles/lifehub.css'),
    source('src/styles/lifehub-ai.css')
  ]);

  assert.match(lifeHubCss, /\.lifeHubToast button \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/);
  assert.match(aiCss, /\.lifeHubAiConnectionBanner > button \{[\s\S]*?min-height: 44px;/);
  assert.match(aiCss, /\.lifeHubAiMessage > footer button \{[\s\S]*?min-height: 44px;/);
  assert.match(aiCss, /\.lifeHubAiError button \{ min-height: 44px;/);
  assert.match(aiCss, /\.lifeHubAiApprovalActions button \{ min-height: 48px;/);
});
