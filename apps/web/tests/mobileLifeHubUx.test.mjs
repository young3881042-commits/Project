import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const WEB_ROOT = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, WEB_ROOT), 'utf8');

test('모바일 피드백과 수동 식단·결제 알림 조작을 유지한다', async () => {
  const [lifeHubCss, dietForm, financeCss] = await Promise.all([
    source('src/styles/lifehub.css'),
    source('src/components/diet/DietEntryForm.jsx'),
    source('src/styles/lifehub-finance.css')
  ]);

  assert.match(lifeHubCss, /\.lifeHubToast button \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/);
  assert.match(dietForm, /LifeHubButton type="submit"[\s\S]*식단 저장/);
  assert.doesNotMatch(dietForm, /사진|AI|Bridge/);
  assert.match(financeCss, /\.lifeHubCardImportPanel \.cardImportSwitch \{[\s\S]*?min-height: 44px;/);
  assert.match(financeCss, /\.lifeHubCardImportPermission button,[\s\S]*?\.lifeHubCardImportStatus > button \{[\s\S]*?min-height: 44px;/);
  assert.match(financeCss, /@media \(max-width: 360px\)[\s\S]*?\.lifeHubCardImportPermission > div,[\s\S]*?\.lifeHubCardImportStatus \{[\s\S]*?grid-template-columns: 1fr;/);
});
