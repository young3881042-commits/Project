import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const WEB_ROOT = new URL('../', import.meta.url);
const source = (path) => readFile(new URL(path, WEB_ROOT), 'utf8');

test('모바일 피드백과 결제 알림 조작을 유지한다', async () => {
  const [lifeHubCss, financeCss] = await Promise.all([
    source('src/styles/lifehub.css'),
    source('src/styles/lifehub-finance.css')
  ]);

  assert.match(lifeHubCss, /\.lifeHubToast button \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/);
  assert.match(financeCss, /\.lifeHubCardImportPanel \.cardImportSwitch \{[\s\S]*?min-height: 44px;/);
  assert.match(financeCss, /\.lifeHubCardImportPermission button,[\s\S]*?\.lifeHubCardImportStatus > button \{[\s\S]*?min-height: 44px;/);
  assert.match(financeCss, /@media \(max-width: 360px\)[\s\S]*?\.lifeHubCardImportPermission > div,[\s\S]*?\.lifeHubCardImportStatus \{[\s\S]*?grid-template-columns: 1fr;/);
  assert.match(financeCss, /\.lifeHubRecurringSummary > button \{[\s\S]*?min-height: 44px;/);
  assert.match(financeCss, /@media \(max-width: 699px\)[\s\S]*?\.lifeHubRecurringBackdrop \{[\s\S]*?place-items: end center;/);
  assert.match(financeCss, /\.lifeHubRecurringRowActions button \{[\s\S]*?min-height: 44px;/);
  assert.match(financeCss, /\.lifeHubFinanceShareSummary > button,[\s\S]*?\{[\s\S]*?min-height: 44px;/);
  assert.match(financeCss, /\.lifeHubFinanceImportPicker,[\s\S]*?\.lifeHubFinanceShareActions button,[\s\S]*?\{[\s\S]*?min-height: 44px;/);
  assert.match(financeCss, /@media \(max-width: 699px\)[\s\S]*?\.lifeHubFinanceShareBackdrop \{[\s\S]*?place-items: end center;/);
});
