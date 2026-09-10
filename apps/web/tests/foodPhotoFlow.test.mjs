import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('프로덕션 진입 그래프는 보관 Bridge·앱 수정·음식 사진 분석 모듈을 연결하지 않는다', async () => {
  const [lifeHub, home, diet, router] = await Promise.all([
    readSource('../src/LifeHubApp.jsx'),
    readSource('../src/features/home/HomePage.jsx'),
    readSource('../src/components/diet/DietPage.jsx'),
    readSource('../src/routes/AppRouter.jsx')
  ]);
  const productionGraph = `${lifeHub}\n${home}\n${diet}`;

  assert.doesNotMatch(productionGraph, /AiAssistantPage|AiPairingPage|AppEditorPage|AiHomeCard/);
  assert.doesNotMatch(productionGraph, /useBridgeConnection|bridgeClient|FoodPhotoAnalyzerCard|useFoodPhotoAnalyzer|foodPhotoAnalysis/);
  assert.doesNotMatch(productionGraph, /\/ai\/(?:edit|settings)/);
  assert.match(router, /LEGACY_ROUTE_ROOTS = new Set\(\[[\s\S]*'ai'/);
  assert.match(router, /if \(LEGACY_ROUTE_ROOTS\.has\(root\)\) return DEFAULT_APP_PATH/);
});
