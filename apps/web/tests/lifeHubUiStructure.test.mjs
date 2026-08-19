import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOrbitIcon } from '../../../scripts/generate_orbit_icons.mjs';

const WEB_ROOT = new URL('../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, WEB_ROOT), 'utf8');
}

function sectionBetween(value, start, end) {
  const from = value.indexOf(start);
  const to = value.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `${start} 시작점을 찾을 수 없습니다.`);
  assert.notEqual(to, -1, `${end} 끝점을 찾을 수 없습니다.`);
  return value.slice(from, to);
}

test('LifeHub 홈은 생활 요약을 유지하고 AI 진입점을 렌더링하지 않는다', async () => {
  const [lifeHub, home, activitySummary, shell] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/features/home/HomePage.jsx'),
    source('src/features/home/homeActivitySummary.js'),
    source('src/components/lifehub/LifeHubShell.jsx')
  ]);
  const homeComponent = home.slice(home.indexOf('export default function HomePage('));
  const renderedHome = homeComponent.slice(homeComponent.indexOf('  return ('));
  const expected = ['lifeHubHomeGreeting', 'HomeMonthCalendar', 'lifeHubWeeklySummary'];
  let cursor = -1;
  for (const marker of expected) {
    const next = renderedHome.indexOf(marker);
    assert.ok(next > cursor, `${marker} 순서가 올바르지 않습니다.`);
    cursor = next;
  }
  for (const removed of ['빠른 실행', '오늘 체크', '최근 메모']) {
    assert.equal(home.includes(removed), false, `${removed} 영역이 홈에 남아 있습니다.`);
  }
  assert.doesNotMatch(home, /displayName|Guest님/);
  assert.doesNotMatch(home, /AiHomeCard|lifehub-ai|빠른 기록|lifeHubHomeQuickActions/);
  assert.match(home, /HOME_ACTIVITY_PERIODS\.map/);
  assert.match(home, /buildHomeActivitySummary/);
  assert.match(home, /role="tablist" aria-label="활동 요약 기간"/);
  assert.match(activitySummary, /이번 주|이번 달|올해|전체/);
  assert.match(lifeHub, /import HomePage from '\.\/features\/home\/HomePage\.jsx'/);
  assert.match(shell, /PRIMARY_TABS = \['home', 'schedule', 'memo', 'workout', 'diet', 'finance'\]/);
});

test('홈 월 캘린더는 날짜별 금액과 운동·일정 예정/완료를 모바일 7열로 표시한다', async () => {
  const [home, calendar, calendarModel, activitySummary, calendarCss] = await Promise.all([
    source('src/features/home/HomePage.jsx'),
    source('src/components/home/HomeMonthCalendar.jsx'),
    source('src/components/home/homeMonthCalendarModel.js'),
    source('src/features/home/homeActivitySummary.js'),
    source('src/styles/lifehub-home-calendar.css')
  ]);

  assert.match(home, /buildMonthCalendar\(calendarMonth\)/);
  assert.match(home, /expandSchedulesForCalendar\(model\.schedules, calendar\.dateKeys\)/);
  assert.match(home, /summarizeHomeCalendar/);
  assert.match(home, /<HomeMonthCalendar/);
  assert.doesNotMatch(home, /TodaySchedulePreviewSection/);
  assert.match(calendar, /\+\{formatCalendarAmount\(summary\.income\)\}/);
  assert.match(calendar, /−\{formatCalendarAmount\(summary\.expense\)\}/);
  for (const marker of ['>예정<', '>완료<', '\(완료\)', '\(예정\)']) {
    assert.match(calendar, new RegExp(marker));
  }
  assert.doesNotMatch(calendar, /운예|운완|예정 \{summary|완료 \{summary/);
  assert.match(home, /summarizeMonthFinances\(calendarMonth, model\.budgetEntries\)/);
  assert.match(calendar, /월 수입 · \{monthFinances\.incomeCount\}건/);
  assert.match(calendar, /월 지출 · \{monthFinances\.expenseCount\}건/);
  assert.match(calendar, /role="grid"/);
  assert.match(calendar, /role="row"/);
  assert.match(calendar, /role="gridcell"/);
  assert.match(calendar, /tabIndex=\{selected \? 0 : -1\}/);
  assert.match(calendar, /ArrowLeft:[ ]*-1,[ ]*ArrowRight:[ ]*1,[ ]*ArrowUp:[ ]*-7,[ ]*ArrowDown:[ ]*7/);
  assert.match(calendar, /aria-current=\{isToday \? 'date'/);
  assert.match(calendar, /data-date=\{cell\.date\}/);
  assert.match(calendar, /예정·완료<\/strong> 일정·운동 상태/);
  assert.match(calendar, /\/finance\?date=/);
  assert.match(calendar, /\/workout\?date=/);
  assert.match(calendarModel, /expandSchedulesForCalendar/);
  assert.match(calendarModel, /origin\?\.workoutLogId/);
  assert.match(calendarCss, /grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
  assert.match(calendarCss, /\.homeMonthFinanceTotals \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(calendarCss, /\.homeMonthDay \{[\s\S]*min-height: 82px/);
  assert.match(calendarCss, /\.homeMonthCalendarHeader nav button \{[\s\S]*min-width: 44px;[\s\S]*min-height: 44px/);
  assert.match(home, /buildHomeActivitySummary/);
  assert.match(activitySummary, /dateKeysInRange\(range\.start, range\.end\)/);
  assert.match(activitySummary, /\.filter\(\(item\) => !isWorkoutSchedule\(item\)\)/);
});

test('식단 중심 6탭을 유지하고 데이터 관리 화면은 상단에서 연다', async () => {
  const [lifeHub, home, shell, router, mobileTabs, mobileShell, memoPage, memoCard] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/features/home/HomePage.jsx'),
    source('src/components/lifehub/LifeHubShell.jsx'),
    source('src/routes/AppRouter.jsx'),
    source('src/components/MobileWorkspaceTabs.jsx'),
    source('src/components/MobilePageShell.jsx'),
    source('src/components/notes/daily/DailyMemoPage.jsx'),
    source('src/components/notes/daily/DailyMemoCard.jsx')
  ]);
  for (const marker of ['홈', '일정', '메모', '운동', '식단', '가계부']) {
    assert.match(shell, new RegExp(marker));
  }
  assert.match(shell, /PRIMARY_TABS = \['home', 'schedule', 'memo', 'workout', 'diet', 'finance'\]/);
  assert.match(shell, /export function routeTitle\(route\)/);
  assert.match(lifeHub, /import LifeHubShell, \{ routeTitle \} from '\.\/components\/lifehub\/LifeHubShell\.jsx'/);
  assert.match(lifeHub, /document\.title = `Orbit · \$\{routeTitle\(route\)\}`/);
  assert.match(shell, /className="lifeHubTopAction"[\s\S]*go\('\/more'\)[\s\S]*앱 설정과 데이터 관리 열기/);
  assert.doesNotMatch(`${mobileTabs}\n${mobileShell}`, /더보기|\/more/);
  assert.match(shell, /aria-current=\{active \? 'page'/);
  assert.doesNotMatch(home, /AiHomeCard|lifehub-ai/);
  assert.doesNotMatch(lifeHub, /AiAssistantPage|AiPairingPage|AppEditorPage/);
  assert.match(shell, /<Suspense fallback=/);
  assert.doesNotMatch(lifeHub, /'\/ai(?:\/[^']*)?':|route === 'ai/);
  assert.doesNotMatch(shell, /path: '\/ai|ai-editor|ai-settings/);
  assert.doesNotMatch(lifeHub, /title: 'AI여행'/);
  assert.match(router, /LEGACY_ROUTE_ROOTS = new Set\(\[[\s\S]*'ai'/);
  assert.doesNotMatch(router, /'\/ai(?:\/[^']*)?'/);
  assert.match(router, /LIFEHUB_PATHS = new Set\([\s\S]*'\/more'/);
  assert.doesNotMatch(router, /routePath === '\/more'[\s\S]*return DEFAULT_APP_PATH/);
  assert.doesNotMatch(router, /lazy\(\(\) => import\('\.\.\/pages\/travel\/TravelPage\.jsx'\)\)/);
  assert.doesNotMatch(router, /ConnectionsPage/);
  assert.match(`${memoPage}\n${memoCard}`, /중요 기록/);
  assert.doesNotMatch(`${memoPage}\n${memoCard}`, /소중한 기록/);
});

test('AI·Bridge 화면과 음식 사진 분석은 앱에서 제거되고 이전 주소는 홈으로 이동한다', async () => {
  const [lifeHub, home, router, shell, diet, dietForm] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/features/home/HomePage.jsx'),
    source('src/routes/AppRouter.jsx'),
    source('src/components/lifehub/LifeHubShell.jsx'),
    source('src/components/diet/DietPage.jsx'),
    source('src/components/diet/DietEntryForm.jsx')
  ]);
  const more = sectionBetween(lifeHub, 'function MorePage(', 'export default function LifeHubApp(');

  assert.doesNotMatch(lifeHub, /AiAssistantPage|AiPairingPage|AppEditorPage|createScheduleFromAssistant|createLifeRecordFromAssistant/);
  assert.doesNotMatch(home, /AiHomeCard|lifehub-ai/);
  assert.doesNotMatch(more, /앱 수정하기|\/ai\/edit|PC Bridge/);
  assert.doesNotMatch(shell, /path: '\/ai|ai-editor|ai-settings/);
  assert.match(router, /const DEFAULT_APP_PATH = '\/app'/);
  assert.match(router, /LEGACY_ROUTE_ROOTS = new Set\(\[[\s\S]*'ai'/);
  assert.doesNotMatch(router, /'\/ai(?:\/[^']*)?'/);
  assert.doesNotMatch(diet, /FoodPhotoAnalyzerCard|useFoodPhotoAnalyzer|useBridgeConnection|foodPhotoAnalysis|\/ai\/settings/);
  assert.doesNotMatch(dietForm, /AI 사진 분석|lifeHubDietAiDraft|onClearAiNutrition/);
  assert.match(dietForm, /먹은 칼로리 기록/);
  assert.match(dietForm, /LifeHubButton type="submit"[\s\S]*식단 저장/);
});

test('생활 기록 저장소는 예전 고정 collection 개수로 기존 데이터를 잘라내지 않는다', async () => {
  const [lifeHub, diet] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/components/diet/dietModel.js')
  ]);

  assert.doesNotMatch(lifeHub, /items\.slice\(0,\s*300\)/);
  assert.doesNotMatch(lifeHub, /entries\.slice\(0,\s*240\)/);
  assert.doesNotMatch(lifeHub, /logs\.slice\(0,\s*150\)/);
  assert.doesNotMatch(lifeHub, /trips\.slice\(0,\s*80\)/);
  assert.doesNotMatch(diet, /entries\.slice\(0,\s*300\)/);
  assert.match(lifeHub, /저장공간이 부족하면 기존 데이터를 유지한 채 알려드려요/);
});

test('버전형 백업은 합치기·전체 교체 미리보기와 실패 rollback, Android SAF를 연결한다', async () => {
  const [lifeHub, panel, codec, restore, nativeDocuments, android, coordinator, policy] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/features/backup/LifeHubBackupPanel.jsx'),
    source('src/features/backup/lifeHubBackupCodec.js'),
    source('src/features/backup/lifeHubBackupRestore.js'),
    source('src/features/backup/nativeBackupDocuments.js'),
    source('../mobile/android/src/com/platform/aiassitant/MainActivity.java'),
    source('../mobile/android/src/com/platform/aiassitant/LifeHubBackupDocumentCoordinator.java'),
    source('../mobile/android/src/com/platform/aiassitant/LifeHubBackupDocumentPolicy.java')
  ]);

  assert.match(codec, /export const LIFEHUB_BACKUP_FORMAT_VERSION = 1/);
  assert.match(codec, /formatVersion/);
  assert.match(codec, /mode !== 'merge' && mode !== 'replace'/);
  assert.match(codec, /mode === 'replace'[\s\S]*mergeCollectionById/);
  assert.match(panel, /<strong id="lifehub-backup-title">백업과 복원<\/strong>/);
  assert.match(panel, /합치기/);
  assert.match(panel, /전체 교체/);
  assert.match(panel, /role="region" aria-labelledby="lifehub-backup-preview-title"/);
  assert.match(panel, /changedSingletonLabel\(plan\)/);
  assert.match(restore, /writeData\(previous, writers, \{ continueOnFailure: true \}\)/);
  assert.match(restore, /rolledBack/);
  assert.match(lifeHub, /import LifeHubBackupPanel from '\.\/features\/backup\/LifeHubBackupPanel\.jsx'/);
  assert.match(lifeHub, /<LifeHubBackupPanel[\s\S]*onRestore=\{onRestoreBackup\}/);
  assert.match(nativeDocuments, /exportNativeLifeHubBackup/);
  assert.match(nativeDocuments, /importNativeLifeHubBackup/);
  assert.match(android, /LifeHubBackupDocumentCoordinator/);
  assert.match(coordinator, /Intent\.ACTION_CREATE_DOCUMENT : Intent\.ACTION_OPEN_DOCUMENT/);
  assert.match(android, /exportLifeHubBackup/);
  assert.match(android, /importLifeHubBackup/);
  assert.match(policy, /MIME_TYPE = "application\/json"/);
  assert.match(policy, /MAX_DOCUMENT_BYTES/);
});

test('홈과 더보기는 아침·저녁 브리핑 카드·설정과 예약 알림을 연결한다', async () => {
  const [lifeHub, home, card, settings, briefing] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/features/home/HomePage.jsx'),
    source('src/features/automation/DailyBriefingCard.jsx'),
    source('src/features/automation/DailyBriefingSettings.jsx'),
    source('src/features/automation/dailyBriefing.js')
  ]);

  const homeRender = home.slice(home.indexOf('  return ('));
  assert.ok(homeRender.indexOf('<DailyBriefingCard') < homeRender.indexOf('<HomeMonthCalendar'), '브리핑 카드는 월 캘린더보다 먼저 보여야 합니다.');
  assert.match(card, /setPeriod\('morning'\)/);
  assert.match(card, /setPeriod\('evening'\)/);
  assert.match(card, /new URLSearchParams\(globalThis\.location\?\.search \|\| ''\)\.get\('briefing'\)/);
  assert.match(card, /addEventListener\?\.\('popstate', syncRequestedPeriod\)/);
  assert.match(settings, /아침·저녁 자동 브리핑/);
  assert.match(settings, /아침 브리핑/);
  assert.match(settings, /저녁 브리핑/);
  assert.match(lifeHub, /<DailyBriefingSettings/);
  assert.match(briefing, /export function dailyBriefingNotifications/);
  assert.match(briefing, /Orbit 아침 브리핑/);
  assert.match(briefing, /Orbit 저녁 브리핑/);
  assert.match(lifeHub, /scheduleRoutineNotifications\(model\.expandedSchedules, Date\.now\(\), briefings\)/);
  assert.match(lifeHub, /document\.addEventListener\('visibilitychange', resyncNotifications\)/);
  assert.match(lifeHub, /window\.addEventListener\('focus', resyncNotifications\)/);
});

test('v28 경량 캐시는 새 데이터 모듈·스타일·테스트 경계를 포함하고 6탭을 바꾸지 않는다', async () => {
  const [serviceWorker, packageJson, entryCss, shell, home] = await Promise.all([
    source('public/sw.js'),
    source('package.json'),
    source('src/lifehub-entry.css'),
    source('src/components/lifehub/LifeHubShell.jsx'),
    source('src/features/home/HomePage.jsx')
  ]);

  assert.match(serviceWorker, /const CACHE_NAME = 'orbit-web-v28'/);
  assert.match(packageJson, /"test:lifehub-data": "node --test src\/features\/automation\/\*\.test\.js src\/features\/backup\/\*\.test\.js src\/features\/finance\/\*\.test\.js src\/features\/life-records\/\*\.test\.js"/);
  assert.match(packageJson, /"test": "npm run test:lifehub-ai && npm run test:lifehub-data/);
  assert.match(entryCss, /@import '\.\/styles\/lifehub-automation\.css'/);
  assert.match(entryCss, /@import '\.\/styles\/lifehub-backup\.css'/);
  assert.match(entryCss, /@import '\.\/styles\/lifehub-finance\.css'/);
  assert.match(shell, /PRIMARY_TABS = \['home', 'schedule', 'memo', 'workout', 'diet', 'finance'\]/);
  assert.doesNotMatch(home, /빠른 기록|lifeHubHomeQuickActions/);
});

test('앱은 로그인 유도 없이 고정된 기기 저장소를 사용한다', async () => {
  const [lifeHub, shell] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/components/lifehub/LifeHubShell.jsx')
  ]);
  const more = sectionBetween(lifeHub, 'function MorePage(', 'export default function LifeHubApp(');

  assert.match(lifeHub, /const LIFEHUB_OWNER_KEY = 'ai-assistant-lifehub-local-owner'/);
  assert.match(lifeHub, /function readLifeHubOwner\(\)/);
  assert.match(lifeHub, /const \[session\] = useState\(\(\) => readLifeHubOwner\(\)\)/);
  assert.doesNotMatch(shell, /AccountChip|\/login|\/mypage|로그인 상태/);
  assert.match(more, /이 기기에 저장/);
  assert.doesNotMatch(more, /const modules|title="모듈"|LifeHub Pro|more-account-strip|PC Bridge|피드백 보내기|\/connect|\/login|\/mypage/);
});

test('운동·식단·가계부는 모듈 목록 대신 하단 탭으로 이동한다', async () => {
  const [lifeHub, shell, dietPage, dietForm, dietEnergy, dietCss, bodyProfileCard] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/components/lifehub/LifeHubShell.jsx'),
    source('src/components/diet/DietPage.jsx'),
    source('src/components/diet/DietEntryForm.jsx'),
    source('src/components/diet/DietEnergySummaryCard.jsx'),
    source('src/styles/lifehub-diet.css'),
    source('src/components/body/BodyProfileCard.jsx')
  ]);
  const more = sectionBetween(lifeHub, 'function MorePage(', 'export default function LifeHubApp(');

  assert.match(shell, /diet: \{ title: '식단', path: '\/diet', icon: 'meal' \}/);
  assert.match(lifeHub, /else if \(route === 'diet'\) content = \(/);
  assert.match(dietForm, /aria-label="먹은 칼로리"/);
  assert.match(dietForm, /먹은 음식 <small>선택<\/small>/);
  assert.match(dietForm, /LifeHubButton type="submit"[\s\S]*식단 저장/);
  assert.match(dietEnergy, /오늘 에너지 참고/);
  assert.match(dietEnergy, /오늘 먹은 내용이 모두 기록됐다고 가정/);
  assert.doesNotMatch(dietPage, /FoodPhotoAnalyzerCard|useFoodPhotoAnalyzer|useBridgeConnection|calculateCalorieTargetPercent/);
  assert.doesNotMatch(dietForm, /AI 사진 분석|lifeHubDietAiDraft/);
  assert.match(dietPage, /<BodyProfileCard/);
  assert.match(bodyProfileCard, /const \[open, setOpen\] = useState/);
  assert.match(bodyProfileCard, /open=\{open\}/);
  assert.match(bodyProfileCard, /onToggle=\{\(event\) => setOpen\(event\.currentTarget\.open\)\}/);
  assert.doesNotMatch(dietPage, /open=\{!bmr\}/);
  assert.match(dietCss, /\.lifeHubDietCaloriesField/);
  assert.doesNotMatch(more, /lifeHubMoreModuleGrid|more-module-grid|코스 만들기/);
});

test('BMI 신체정보 세션을 운동과 식단이 함께 쓰고 운동 선택은 네 종류와 60분을 제공한다', async () => {
  const [lifeHub, dietPage, bodyProfileCard, bodyProfileModel, workoutMetrics, router, referenceCss] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/components/diet/DietPage.jsx'),
    source('src/components/body/BodyProfileCard.jsx'),
    source('src/components/body/bodyProfileModel.js'),
    source('src/components/workout/workoutMetrics.js'),
    source('src/routes/AppRouter.jsx'),
    source('src/styles/lifehub-reference.css')
  ]);
  const workout = sectionBetween(lifeHub, 'function WorkoutPage(', 'function FinancePage(');

  assert.doesNotMatch(workout, /시작 시간|draft\.startTime|시간 미입력/);
  assert.match(workout, /<label><span>날짜<\/span><input type="date"/);

  assert.match(workoutMetrics, /export function calculateBodyBmi\(profile\)/);
  assert.match(bodyProfileModel, /BODY_PROFILE_STORAGE_KEY = 'ai-assistant-body-profile'/);
  assert.match(bodyProfileModel, /BODY_PROFILE_SESSION_KEY = 'ai-assistant-body-profile-session'/);
  assert.match(bodyProfileModel, /cacheBodyProfileSession/);
  assert.match(bodyProfileModel, /LEGACY_WORKOUT_PROFILE_KEY/);
  assert.match(bodyProfileCard, /운동·식단 공용/);
  assert.match(bodyProfileCard, /BMI \$\{bmi\.toFixed\(1\)\}/);
  assert.match(bodyProfileCard, /공용 신체정보 저장/);
  assert.match(bodyProfileCard, /openRequest/);
  assert.match(lifeHub, /const \[bodyProfile, setBodyProfile\] = useState\(\(\) => readBodyProfile\(session\)\)/);
  assert.match(lifeHub, /onBodyProfileChange=\{updateBodyProfile\}/);
  assert.match(lifeHub, /const autosaveTimer = window\.setTimeout\(\(\) => \{[\s\S]*\}, 500\)/);
  assert.match(lifeHub, /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/);
  assert.match(lifeHub, /return \(\) => \{[\s\S]*flushBodyProfile\(false\)/);
  assert.match(lifeHub, /event\.key === durableProfileKey[\s\S]*event\.key === legacyProfileKey/);
  assert.match(workout, /<BodyProfileCard/);
  assert.match(dietPage, /<BodyProfileCard/);
  assert.match(router, /<RouteErrorBoundary key=\{activeRoutePath\}>/);

  assert.match(workout, /\{ value: 'cardio', label: '유산소' \}[\s\S]*\{ value: 'upper', label: '상체' \}[\s\S]*\{ value: 'lower', label: '하체' \}[\s\S]*\{ value: 'other', label: '기타' \}/);
  assert.doesNotMatch(workout, /\{ value: 'walking', label: '걷기' \}|\{ value: 'stretching', label: '스트레칭' \}/);
  assert.match(workoutMetrics, /WORKOUT_DURATION_OPTIONS = \[15, 30, 45, 60\]/);
  assert.match(workout, /WORKOUT_DURATION_OPTIONS\.map/);
  assert.match(workoutMetrics, /id: 'other'[\s\S]*title: '기타'/);
  assert.match(referenceCss, /@media \(max-width: 480px\)[\s\S]*\.workout-duration-grid,[\s\S]*\.workout-type-chip > div[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
});

test('Android WebView는 Orbit 이름·중앙 O 아이콘과 내장 웹 버전 갱신을 지원한다', async () => {
  const [android, coordinator, restoreReceiver, manifest, strings, launcherIcon, iconGenerator, icon192, icon512, main, buildScript] = await Promise.all([
    source('../mobile/android/src/com/platform/aiassitant/MainActivity.java'),
    source('../mobile/android/src/com/platform/aiassitant/AppNotificationCoordinator.java'),
    source('../mobile/android/src/com/platform/aiassitant/NotificationRestoreReceiver.java'),
    source('../mobile/android/AndroidManifest.xml'),
    source('../mobile/android/res/values/strings.xml'),
    source('../mobile/android/res/drawable/ic_launcher.xml'),
    source('../../scripts/generate_orbit_icons.mjs'),
    readFile(new URL('public/assets/lifehub-icons/app-icon-192.png', WEB_ROOT)),
    readFile(new URL('public/assets/lifehub-icons/app-icon-512.png', WEB_ROOT)),
    source('src/main.jsx'),
    source('../../scripts/build_android_apk.sh')
  ]);
  assert.match(android, /import android\.webkit\.WebChromeClient;/);
  assert.match(android, /webView\.setWebChromeClient\(new AppWebChromeClient\(\)\);/);
  assert.match(android, /onShowFileChooser\(/);
  assert.match(android, /EmbeddedWebBuild\.ID/);
  assert.match(android, /webView\.clearCache\(true\)/);
  assert.match(android, /\?apkBuild=/);
  const onCreate = sectionBetween(
    android,
    'protected void onCreate(Bundle savedInstanceState)',
    'private void configureSystemBars()'
  );
  const topLevelPolicy = sectionBetween(
    android,
    'private boolean isAllowedTopLevelUri(Uri uri)',
    'private static String originKey(Uri uri)'
  );
  const pageLoadErrorPolicy = sectionBetween(
    android,
    'public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error)',
    'public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error)'
  );
  assert.match(onCreate, /setContentView\(webView\);\s*loadLocal\(\);/);
  assert.match(
    onCreate,
    /preferences\.edit\(\)\s*\.remove\(LEGACY_MODE_KEY\)\s*\.remove\(LEGACY_SERVER_URL_KEY\)\s*\.apply\(\);/
  );
  assert.match(topLevelPolicy, /LOCAL_ORIGIN/);
  assert.doesNotMatch(topLevelPolicy, /preferences|MODE_SERVER|LEGACY_SERVER_URL_KEY/);
  assert.match(pageLoadErrorPolicy, /request\.isForMainFrame\(\)/);
  assert.match(pageLoadErrorPolicy, /trustedTopLevelOrigin = null/);
  assert.match(pageLoadErrorPolicy, /R\.string\.page_load_failed/);
  assert.doesNotMatch(pageLoadErrorPolicy, /LOCAL_HOST/);
  assert.equal((android.match(/webView\.loadUrl\(/g) || []).length, 1);
  for (const removedNativeApi of [
    'showFirstLaunchDialog(',
    'showModeMenu(',
    'showServerSettings(',
    'normalizeServerUrl(',
    'saveServerMode(',
    'selectLocalMode(',
    'loadSavedMode(',
    'loadServer(',
    'reloadCurrentMode(',
    'openServerSettings('
  ]) {
    assert.equal(android.includes(removedNativeApi), false, `${removedNativeApi} 서버 모드 API가 남아 있습니다.`);
  }
  assert.doesNotMatch(android, /\b(?:KEY_MODE|KEY_SERVER_URL|MODE_LOCAL|MODE_SERVER|MENU_LOCAL_MODE|MENU_SERVER_SETTINGS)\b/);
  assert.doesNotMatch(android, /webView\.loadUrl\("about:blank"\)/);
  for (const removedString of [
    'mode_dialog_title',
    'mode_dialog_message',
    'local_mode',
    'server_settings',
    'server_dialog_title',
    'server_dialog_message',
    'server_url_hint',
    'invalid_server_url',
    'cleartext_warning_title',
    'cleartext_warning_message',
    'continue_insecure',
    'local_mode_active'
  ]) {
    assert.equal(strings.includes(`<string name="${removedString}">`), false, `${removedString} 문자열이 남아 있습니다.`);
  }
  assert.doesNotMatch(strings, /사용 모드 선택|서버에 연결|서버 주소/);
  assert.match(manifest, /android:versionCode="20"/);
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(manifest, /android\.permission\.RECEIVE_BOOT_COMPLETED/);
  assert.match(manifest, /android\.permission\.SCHEDULE_EXACT_ALARM/);
  assert.match(manifest, /android\.permission\.VIBRATE/);
  assert.match(manifest, /SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED/);
  assert.match(manifest, /android:versionName="0\.5\.4-debug"/);
  assert.match(manifest, /android:name="\.FinanceNotificationListenerService"/);
  assert.match(manifest, /android:permission="android\.permission\.BIND_NOTIFICATION_LISTENER_SERVICE"/);
  assert.match(manifest, /android:name="android\.service\.notification\.NotificationListenerService"/);
  assert.match(strings, /<string name="card_notification_listener_name">Orbit 결제 알림 자동 기록<\/string>/);
  assert.match(manifest, /android:roundIcon="@drawable\/ic_launcher"/);
  assert.match(strings, /<string name="app_name">Orbit<\/string>/);
  assert.match(launcherIcon, /#12172B/);
  assert.match(launcherIcon, /#67E8D2/);
  assert.match(launcherIcon, /M54,20\.5 C72\.2,20\.5 86\.4,35\.2 86\.4,54/);
  assert.match(launcherIcon, /M54,34\.5 C64,34\.5 71\.8,42\.9 71\.8,54/);
  assert.doesNotMatch(launcherIcon, /android:fillType=/);
  assert.doesNotMatch(launcherIcon, /M28,17 L80,17|M18,27 L35,27|M69,22 L77,22 L77,43/);
  assert.match(iconGenerator, /const SIZES = \[192, 512\]/);
  assert.match(iconGenerator, /const BACKGROUND = \[0x12, 0x17, 0x2b\]/);
  assert.match(iconGenerator, /const MARK = \[0x67, 0xe8, 0xd2\]/);
  assert.match(iconGenerator, /const OUTER_RX = 0\.3/);
  assert.match(iconGenerator, /const INNER_RX = 0\.165/);
  assert.deepEqual(icon192, createOrbitIcon(192));
  assert.deepEqual(icon512, createOrbitIcon(512));
  assert.match(android, /AppNotificationCoordinator\.restoreScheduled\(getApplicationContext\(\)\)/);
  assert.match(android, /getExactAlarmPermission\(\)/);
  assert.match(android, /requestExactAlarmPermission\(final String requestId\)/);
  assert.match(android, /Settings\.ACTION_REQUEST_SCHEDULE_EXACT_ALARM/);
  assert.match(coordinator, /manager\.setExactAndAllowWhileIdle\(/);
  assert.match(coordinator, /manager\.setAndAllowWhileIdle\(/);
  assert.match(coordinator, /notification\.triggerAt >= now - MAX_LATE_DELIVERY_MS/);
  assert.match(coordinator, /return "\/app"\.equals\(route\)[\s\S]*\|\| "\/schedule"\.equals\(route\)/);
  assert.doesNotMatch(coordinator, /"\/ai(?:\/edit|\/settings)?"/);
  const replaceScheduled = sectionBetween(
    coordinator,
    'static synchronized boolean replaceScheduled(',
    'static synchronized void restoreScheduled('
  );
  assert.doesNotMatch(replaceScheduled, /permissionState\(/);
  assert.match(restoreReceiver, /ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED/);
  assert.match(main, /appassets\.androidplatform\.net/);
  assert.match(main, /registration\.unregister/);
  assert.match(main, /window\.caches\.delete/);
  assert.match(buildScript, /EmbeddedWebBuild\.java/);
  assert.match(buildScript, /sha256sum "\$\{WEB_DIR\}\/dist\/index\.html"/);
});

test('일정 알림은 모든 화면의 foreground 복귀 때 재동기화하고 반복 일정 실패를 숨기지 않는다', async () => {
  const lifeHub = await source('src/LifeHubApp.jsx');
  const schedulePage = sectionBetween(lifeHub, 'function SchedulePage(', 'function WorkoutPage(');
  const appRoot = lifeHub.slice(lifeHub.indexOf('export default function LifeHubApp('));
  assert.match(appRoot, /document\.addEventListener\('visibilitychange', resyncNotifications\)/);
  assert.match(appRoot, /window\.addEventListener\('focus', resyncNotifications\)/);
  assert.match(appRoot, /const briefings = dailyBriefingNotifications\(settings, \{ now: new Date\(\) \}\)/);
  assert.match(appRoot, /scheduleRoutineNotifications\(model\.expandedSchedules, Date\.now\(\), briefings\)/);
  assert.match(schedulePage, /routineReminderSaveStatus\(/);
  assert.match(schedulePage, /reminderSaveStatus === 'no_upcoming'/);
  assert.match(schedulePage, /앞으로 14일 안에 발생할 반복 알림이 없어 아직 예약하지 않았어요/);
});

test('레거시 홈의 최근 메모 데이터와 전용 스타일도 제거됐다', async () => {
  const [cards, runtime, appHomeCss, repairCss, lifeHubCss, referenceCss] = await Promise.all([
    source('src/components/home/HomeScheduleCards.jsx'),
    source('src/AppRuntime.jsx'),
    source('src/styles/app-home-reference.css'),
    source('src/styles/frontend-repair.css'),
    source('src/styles/lifehub.css'),
    source('src/styles/lifehub-reference.css')
  ]);
  assert.doesNotMatch(cards, /최근 메모|RecentMemoCard|appHomeRecentCard/);
  assert.doesNotMatch(runtime, /recentMemoItemsFromBlocks|recentMemoItems:/);
  assert.doesNotMatch(`${appHomeCss}\n${repairCss}`, /appHomeRecentCard|appHomeMemoList/);
  assert.doesNotMatch(`${lifeHubCss}\n${referenceCss}`, /lifeHubRoute-assistant|lifeHubAssistantCommand|assistant-hero-actions|assistant-status-grid/);
});

test('사용하지 않는 AI 주소는 앱 홈으로 이동하고 iframe 차단 정책을 유지한다', async () => {
  const [router, html, nginx] = await Promise.all([
    source('src/routes/AppRouter.jsx'),
    source('index.html'),
    source('nginx.conf.template')
  ]);
  assert.match(router, /LEGACY_ROUTE_ROOTS = new Set\(\[[\s\S]*'ai'/);
  assert.match(router, /if \(LEGACY_ROUTE_ROOTS\.has\(root\)\) return DEFAULT_APP_PATH/);
  assert.doesNotMatch(router, /'\/ai(?:\/[^']*)?'/);
  assert.match(html, /script-src 'self'/);
  assert.match(nginx, /script-src 'self'/);
  assert.match(html, /frame-src 'none'/);
  assert.match(nginx, /frame-src 'none'/);
});

test('생활 기록은 새 저장이 성공한 뒤에만 이전 데이터와 갱신 이벤트를 정리한다', async () => {
  const lifeHub = await source('src/LifeHubApp.jsx');
  const schedules = sectionBetween(lifeHub, 'function saveSchedules(', 'function recurrenceMatches(');
  const budget = sectionBetween(lifeHub, 'function saveBudget(', 'function normalizeExercise(');
  const workouts = sectionBetween(lifeHub, 'function saveWorkouts(', 'function normalizeTrip(');
  const trips = sectionBetween(lifeHub, 'function saveTrips(', 'function monthlyBudgetSummary(');

  assert.match(schedules, /const saved = safeSetItem[\s\S]*if \(saved\) \{[\s\S]*safeRemoveItem\(SCHEDULER_KEY\)[\s\S]*emitDataChanged/);
  assert.match(budget, /const saved = safeSetItem[\s\S]*if \(saved\) \{[\s\S]*safeRemoveItem\(BUDGET_KEY\)[\s\S]*emitDataChanged/);
  assert.match(workouts, /const saved = safeSetItem[\s\S]*if \(saved\) \{[\s\S]*safeRemoveItem\(WORKOUT_LOGS_KEY\)[\s\S]*emitDataChanged/);
  assert.match(trips, /const saved = safeSetItem[\s\S]*if \(saved\) emitDataChanged/);
});

test('저장 실패 시 일정·운동·가계부·여행 초안을 유지한다', async () => {
  const lifeHub = await source('src/LifeHubApp.jsx');
  const schedule = sectionBetween(lifeHub, 'const submitSchedule = async', 'const deleteSchedule =');
  const workout = sectionBetween(lifeHub, 'const submitWorkout =', 'return (');
  const finance = sectionBetween(lifeHub, 'const submitEntry =', 'const deleteEntry =');
  const travel = sectionBetween(lifeHub, 'const submitTrip =', 'const toggleChecklist =');

  assert.match(schedule, /const result = saveSchedules[\s\S]*if \(!result\.saved\) \{[\s\S]*입력 내용은 그대로 두었어요[\s\S]*return;[\s\S]*setDraft/);
  assert.match(workout, /const workoutResult = saveWorkouts[\s\S]*if \(!workoutResult\.saved\) \{[\s\S]*입력 내용은 그대로 두었어요[\s\S]*return;[\s\S]*setDraft/);
  assert.match(finance, /const result = saveBudget[\s\S]*if \(!result\.saved\) \{[\s\S]*입력 내용은 그대로 두었어요[\s\S]*return;[\s\S]*setDraft/);
  assert.match(travel, /const result = saveTrips[\s\S]*if \(!result\.saved\) \{[\s\S]*입력 내용은 그대로 두었어요[\s\S]*return;[\s\S]*setDraft/);
});

test('홈 일정 추가는 커스텀 반복과 다중 요일 선택을 제공한다', async () => {
  const lifeHub = await source('src/LifeHubApp.jsx');
  const schedule = sectionBetween(lifeHub, 'function SchedulePage(', 'function WorkoutPage(');

  assert.match(lifeHub, /\{ value: 'custom', label: '커스텀' \}/);
  assert.match(schedule, /draft\.repeat === 'custom'/);
  assert.match(schedule, /CUSTOM_REPEAT_WEEKDAYS\.map/);
  assert.match(schedule, /aria-label="반복할 요일 선택"/);
  assert.match(schedule, /aria-pressed=\{selected\}/);
  assert.match(schedule, /반복할 요일을 하나 이상 선택해주세요/);
  assert.match(schedule, /repeatDays,/);
});

test('가계부 빈 상태 버튼은 지출 카테고리를 정리하고 금액 입력으로 이동한다', async () => {
  const lifeHub = await source('src/LifeHubApp.jsx');
  const finance = sectionBetween(lifeHub, 'function FinancePage(', 'function TravelPage(');

  assert.match(finance, /const formRef = useRef\(null\)/);
  assert.match(finance, /const amountInputRef = useRef\(null\)/);
  assert.match(finance, /const selectEntryType = [\s\S]*current\.category === '수입' \? '식비'/);
  assert.match(finance, /formRef\.current\?\.scrollIntoView/);
  assert.match(finance, /amountInputRef\.current\?\.focus/);
  assert.equal((finance.match(/selectEntryType\('withdraw', \{ focusAmount: true \}\)/g) || []).length, 3);
  assert.match(finance, /<form ref=\{formRef\}/);
  assert.match(finance, /<input ref=\{amountInputRef\}/);
});

test('허용한 결제 앱의 승인은 앱 전체 foreground에서 민감정보 없이 중복 안전하게 자동 기록한다', async () => {
  const [lifeHub, panel, hook, batch, adapter, android, manifest, strings] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/features/finance/CardTransactionImportPanel.jsx'),
    source('src/features/finance/useCardTransactionImport.js'),
    source('src/features/finance/cardTransactionImport.js'),
    source('src/features/finance/nativeCardTransactions.js'),
    source('../mobile/android/src/com/platform/aiassitant/MainActivity.java'),
    source('../mobile/android/AndroidManifest.xml'),
    source('../mobile/android/res/values/strings.xml')
  ]);
  const finance = sectionBetween(lifeHub, 'function FinancePage(', 'function TravelPage(');
  const appRoot = lifeHub.slice(lifeHub.indexOf('export default function LifeHubApp('));

  assert.equal((lifeHub.match(/useCardTransactionImport\(/g) || []).length, 1);
  assert.match(appRoot, /const cardImport = useCardTransactionImport\(\{/);
  assert.match(appRoot, /<FinancePage[\s\S]*cardImport=\{cardImport\}/);
  assert.match(finance, /<CardTransactionImportPanel[\s\S]*cardImport=\{cardImport\}/);
  assert.match(panel, /결제 알림 자동 가져오기/);
  assert.match(panel, /삼성월렛과 카카오페이 앱 중 사용할 앱만 선택하세요/);
  assert.match(panel, /카카오톡 알림톡은 읽지 않아요/);
  assert.match(panel, /cardImport\.selectedSources\.includes\(source\.id\)/);
  assert.match(panel, /cardImport\.toggleSource\(source\.id\)/);
  assert.doesNotMatch(panel, /cardImport\.enabled \? \([\s\S]{0,120}lifeHubCardImportSources/);
  assert.match(panel, /실제 결제 승인만 보수적으로 가져오며 송금·이체·입출금은 대상이 아닙니다/);
  assert.match(panel, /알림 원문·잔액·계좌·카드번호는 표시하거나 저장하지 않고/);
  assert.match(panel, /알림 접근은 모든 앱의 알림을 볼 수 있는 넓은 특수 권한/);
  assert.match(panel, /Orbit은 선택한 삼성월렛·카카오페이 알림만 기기 안에서 확인/);
  assert.match(panel, /권한을 허용하기 전의 과거 결제 내역은 가져올 수 없어요/);
  assert.match(panel, /알림 접근 설정/);
  assert.match(panel, /‘제한된 설정’으로 막힐 때/);
  assert.match(panel, /오늘 자동 가져오기/);
  assert.match(panel, /누적 자동 가져오기/);
  assert.match(panel, /지금 가져오기/);
  assert.match(panel, /잘못 인식된 결제는 아래 최근 거래에서 바로 삭제/);
  assert.match(panel, /이 브라우저에서는 다른 앱의 알림을 읽지 않아요/);
  assert.match(panel, /onClick=\{onManualEntry\}>지출 입력/);

  assert.match(hook, /requestPendingCardTransactions\(\{/);
  assert.match(hook, /importCardTransactionBatch\(peek\.items/);
  assert.match(hook, /target\.addEventListener\('focus', syncOnForeground\)/);
  assert.match(hook, /document\?\.addEventListener\?\.\('visibilitychange', syncOnForeground\)/);
  assert.match(hook, /const inFlightRef = useRef\(null\)/);
  assert.match(hook, /CARD_IMPORT_SOURCE_IDS/);
  assert.match(hook, /enabled \? \[\] : \[CARD_IMPORT_SOURCE_IDS\[0\]\]/);
  assert.match(hook, /toggleSource/);
  assert.doesNotMatch(hook, /tmoney|티머니|toss|shinhan|신한|토스/i);
  const preferenceSaveIndex = hook.indexOf('const stored = saveCardImportSources(');
  const nativeConfigureIndex = hook.indexOf('if (!configureNativeCardImport(', preferenceSaveIndex);
  assert.ok(
    preferenceSaveIndex > -1 && nativeConfigureIndex > preferenceSaveIndex,
    'native purge 전에 local source 선택을 먼저 저장해야 합니다.'
  );

  const saveIndex = batch.indexOf('saveResult = saveBudget([...entries, ...current])');
  const savedAckIndex = batch.indexOf('const savedAck = await acknowledge(');
  assert.ok(saveIndex > -1 && savedAckIndex > saveIndex, '새 거래는 저장 성공 뒤에만 ack해야 합니다.');
  assert.match(batch, /existingEventIds\.has\(candidate\.eventId\)[\s\S]*acknowledge\(acknowledgeDecisions, duplicateIds, 'duplicate'\)/);
  assert.match(batch, /if \(saveResult\?\.saved !== true\) \{[\s\S]*status: 'failed'/);
  assert.match(batch, /memo: normalized\.merchant/);
  assert.doesNotMatch(batch, /rawText|balance|accountNumber|cardNumber/);

  assert.match(adapter, /const keys = \['eventId', 'source', 'amount', 'merchant', 'occurredAt'\]/);
  assert.match(adapter, /hasExactKeys\(value, keys\)/);
  assert.match(adapter, /CARD_IMPORT_SOURCES = Object\.freeze\(\[[\s\S]*id: 'samsung-wallet'[\s\S]*id: 'kakao-pay'/);
  assert.doesNotMatch(adapter, /tmoney|티머니|toss|shinhan|신한|토스/i);
  assert.match(android, /getCardImportCapabilities\(\)/);
  assert.match(android, /configureCardImport\(String owner, String sourcesJson\)/);
  assert.match(android, /requestPendingCardTransactions\(/);
  assert.match(android, /resolvePendingCardTransactions\(/);
  assert.match(manifest, /android:name="\.FinanceNotificationListenerService"/);
  assert.match(manifest, /android\.permission\.BIND_NOTIFICATION_LISTENER_SERVICE/);
  assert.match(manifest, /android\.service\.notification\.NotificationListenerService/);
  assert.match(strings, /card_notification_listener_name/);
});

test('Android 뒤로가기는 일정·메모 편집 history만 닫고 일정 초안을 복구한다', async () => {
  const [lifeHub, memo] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/components/notes/daily/DailyMemoPage.jsx')
  ]);

  class TestPopStateEvent {
    constructor(type) { this.type = type; }
  }

  const fakeBrowser = (initialPath) => {
    const entries = [{ path: initialPath, state: {} }];
    const events = [];
    const location = { pathname: '', search: '' };
    let index = 0;
    let backCalls = 0;
    const applyPath = (path) => {
      const url = new URL(path, 'https://orbit.local');
      location.pathname = url.pathname;
      location.search = url.search;
    };
    let browserWindow;
    const history = {
      get state() { return entries[index].state; },
      pushState(state, _title, path) {
        entries.splice(index + 1);
        entries.push({ path, state });
        index = entries.length - 1;
        applyPath(path);
      },
      replaceState(state, _title, path) {
        entries[index] = { path, state };
        applyPath(path);
      },
      back() {
        backCalls += 1;
        if (index === 0) return;
        index -= 1;
        applyPath(entries[index].path);
        browserWindow.dispatchEvent(new TestPopStateEvent('popstate'));
      }
    };
    browserWindow = {
      location,
      history,
      dispatchEvent(event) { events.push(event.type); }
    };
    applyPath(initialPath);
    return {
      window: browserWindow,
      events,
      get backCalls() { return backCalls; },
      get currentPath() { return location.pathname + location.search; },
      get entryCount() { return entries.length; }
    };
  };

  const compileHistoryHelpers = (sourceText, start, end, names, browser) => {
    const block = sectionBetween(sourceText, start, end);
    const factory = new Function('window', 'PopStateEvent', `${block}\nreturn { ${names.join(', ')} };`);
    return factory(browser.window, TestPopStateEvent);
  };

  const scheduleBrowser = fakeBrowser('/schedule');
  const scheduleHistory = compileHistoryHelpers(
    lifeHub,
    "const SCHEDULE_EDITOR_HISTORY_KEY",
    'function ScheduleTimeline(',
    ['ensureLifeHubEditorHistory', 'pushLifeHubEditorPath', 'closeLifeHubEditorPath'],
    scheduleBrowser
  );
  scheduleHistory.pushLifeHubEditorPath('/schedule?edit=one');
  assert.equal(scheduleBrowser.currentPath, '/schedule?edit=one');
  assert.equal(scheduleBrowser.entryCount, 2);
  assert.equal(scheduleBrowser.window.history.state.lifehubScheduleEditor, true);
  scheduleHistory.pushLifeHubEditorPath('/schedule?edit=two');
  assert.equal(scheduleBrowser.entryCount, 2, '편집기 전환은 history를 중첩하지 않습니다.');
  scheduleHistory.closeLifeHubEditorPath();
  assert.equal(scheduleBrowser.currentPath, '/schedule');
  assert.equal(scheduleBrowser.backCalls, 1);
  scheduleHistory.closeLifeHubEditorPath();
  assert.equal(scheduleBrowser.backCalls, 1, '프로그램 닫기 후 다시 back을 호출하지 않습니다.');

  const scheduleDeepLink = fakeBrowser('/schedule?edit=deep-link');
  const scheduleDeepLinkHistory = compileHistoryHelpers(
    lifeHub,
    "const SCHEDULE_EDITOR_HISTORY_KEY",
    'function ScheduleTimeline(',
    ['ensureLifeHubEditorHistory', 'closeLifeHubEditorPath'],
    scheduleDeepLink
  );
  scheduleDeepLinkHistory.ensureLifeHubEditorHistory();
  assert.equal(scheduleDeepLink.currentPath, '/schedule?edit=deep-link');
  assert.equal(scheduleDeepLink.entryCount, 2, '직접 진입한 edit query 아래에도 기본 화면을 만듭니다.');
  scheduleDeepLinkHistory.closeLifeHubEditorPath();
  assert.equal(scheduleDeepLink.currentPath, '/schedule');

  const memoBrowser = fakeBrowser('/memo');
  const memoHistory = compileHistoryHelpers(
    memo,
    'const MEMO_EDITOR_HISTORY_KEY',
    'function uiDraft(',
    ['pushMemoEditorPath', 'closeMemoEditorPath'],
    memoBrowser
  );
  memoHistory.pushMemoEditorPath('/memo?edit=memo-one');
  assert.equal(memoBrowser.entryCount, 2);
  assert.equal(memoBrowser.window.history.state.lifehubMemoEditor, true);
  memoHistory.closeMemoEditorPath();
  assert.equal(memoBrowser.currentPath, '/memo');
  assert.equal(memoBrowser.backCalls, 1);

  const schedulePage = sectionBetween(lifeHub, 'function SchedulePage(', 'function WorkoutPage(');
  const submitSchedule = sectionBetween(schedulePage, 'const submitSchedule = async', 'const deleteSchedule =');
  assert.match(lifeHub, /function saveScheduleDraft[\s\S]*sessionStorage\.setItem/);
  assert.match(lifeHub, /function readScheduleDraft[\s\S]*sessionStorage\.getItem/);
  assert.match(schedulePage, /if \(!showForm \|\| discardScheduleDraftRef\.current\) return;[\s\S]*saveScheduleDraft/);
  assert.match(schedulePage, /openScheduleEditor[\s\S]*readScheduleDraft\(session, sourceId/);
  assert.match(schedulePage, /startAddSchedule[\s\S]*readScheduleDraft\(session, '',/);
  assert.match(submitSchedule, /if \(!result\.saved\)[\s\S]*return;[\s\S]*clearScheduleDraft\(session, editingId\)[\s\S]*closeForm\(\{ discardDraft: true \}\)/);
  assert.match(memo, /pushMemoEditorPath\(`\/memo\?edit=/);
  assert.match(memo, /ensureMemoEditorHistory\(\);[\s\S]*if \(target\.id === editingId\) return/);
  assert.match(memo, /const leaveEditing = \(\) => \{[\s\S]*persistDraft\(\)/);
});
