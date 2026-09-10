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
  assert.match(home, /role="group" aria-label="활동 요약 기간"/);
  assert.match(home, /aria-pressed=\{activityPeriod === period.value\}/);
  assert.match(activitySummary, /이번 주|이번 달|올해|전체/);
  assert.match(lifeHub, /import HomePage from '\.\/features\/home\/HomePage\.jsx'/);
  assert.match(shell, /PRIMARY_TABS = \['home', 'schedule', 'memo', 'finance', 'travel', 'ai'\]/);
});

test('홈 월 캘린더는 날짜별 금액과 일정 예정/미완료/완료를 모바일 7열로 표시한다', async () => {
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
  for (const marker of ['>예정<', '>미완료<', '>완료<', '\(완료\)', '\(예정\)']) {
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
  assert.match(calendar, /예정·미완료·완료<\/strong> 일정 상태/);
  assert.match(calendar, /\/finance\?date=/);
  assert.match(calendar, /date === today[\s\S]*className="homeMonthTodayActions"/);
  assert.match(calendar, /오늘 기록 추가/);
  assert.match(calendar, /일정 추가/);
  assert.match(calendar, /메모 작성/);
  assert.doesNotMatch(calendar, /\/workout\?date=|운동 전체 보기/);
  assert.match(calendarModel, /expandSchedulesForCalendar/);
  assert.doesNotMatch(calendarModel, /workoutPlanned|workoutDone|linkedWorkoutId/);
  assert.match(calendarCss, /grid-template-columns: repeat\(7, minmax\(0, 1fr\)\)/);
  assert.match(calendarCss, /\.homeMonthFinanceTotals \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(calendarCss, /\.homeMonthDay \{[\s\S]*min-height: 82px/);
  assert.match(calendarCss, /\.homeMonthCalendarHeader nav button \{[\s\S]*min-width: 44px;[\s\S]*min-height: 44px/);
  assert.match(calendarCss, /\.homeMonthTodayActions \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(calendarCss, /\.homeMonthTodayActions button \{[\s\S]*min-width: 0;[\s\S]*min-height: 44px/);
  assert.match(home, /buildHomeActivitySummary/);
  assert.match(activitySummary, /dateKeysInRange\(range\.start, range\.end\)/);
  assert.doesNotMatch(activitySummary, /isWorkoutSchedule|\/workout|\/diet|섭취 합계|운동 기록/);
});

test('여행과 AI를 포함한 6개 핵심 탭을 유지하고 데이터 관리 화면은 상단에서 연다', async () => {
  const [lifeHub, home, shell, router, mobileTabs, mobileShell, memoPage, memoCard, lifeHubCss, lifeHubAiCss] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/features/home/HomePage.jsx'),
    source('src/components/lifehub/LifeHubShell.jsx'),
    source('src/routes/AppRouter.jsx'),
    source('src/components/MobileWorkspaceTabs.jsx'),
    source('src/components/MobilePageShell.jsx'),
    source('src/components/notes/daily/DailyMemoPage.jsx'),
    source('src/components/notes/daily/DailyMemoCard.jsx'),
    source('src/styles/lifehub.css'),
    source('src/styles/lifehub-ai.css')
  ]);
  for (const marker of ['홈', '일정', '메모', '가계부', '여행']) {
    assert.match(shell, new RegExp(marker));
  }
  assert.match(shell, /PRIMARY_TABS = \['home', 'schedule', 'memo', 'finance', 'travel', 'ai'\]/);
  assert.match(lifeHubCss, /\.lifeHubBottomNav \{[\s\S]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(lifeHubAiCss, /\.lifeHubRoot \.lifeHubBottomNav/);
  assert.doesNotMatch(shell, /workout:|diet:|\/workout|\/diet|운동|식단/);
  assert.match(shell, /export function routeTitle\(route\)/);
  assert.match(lifeHub, /import LifeHubShell, \{ routeTitle \} from '\.\/components\/lifehub\/LifeHubShell\.jsx'/);
  assert.match(lifeHub, /document\.title = `Orbit · \$\{routeTitle\(route\)\}`/);
  assert.match(shell, /className="lifeHubTopAction"[\s\S]*go\('\/more'\)[\s\S]*앱 설정과 데이터 관리 열기/);
  assert.doesNotMatch(`${mobileTabs}\n${mobileShell}`, /더보기|\/more/);
  assert.match(shell, /aria-current=\{active \? 'page'/);
  assert.doesNotMatch(home, /AiHomeCard|lifehub-ai/);
  assert.doesNotMatch(lifeHub, /AiAssistantPage|AiPairingPage|AppEditorPage/);
  assert.match(shell, /<Suspense fallback=/);
  assert.match(lifeHub, /route === 'ai'/);
  assert.doesNotMatch(lifeHub, /route === 'ai-editor'|route === 'ai-settings'/);
  assert.match(shell, /path: '\/ai'/);
  assert.doesNotMatch(shell, /ai-editor|ai-settings/);
  assert.doesNotMatch(lifeHub, /title: 'AI여행'/);
  assert.match(router, /LEGACY_ROUTE_ROOTS = new Set\(\[[\s\S]*'ai'/);
  assert.match(router, /LEGACY_ROUTE_ROOTS = new Set\(\[[\s\S]*'diet'[\s\S]*'workout'/);
  assert.match(router, /'\/ai'/);
  assert.doesNotMatch(router, /'\/ai\/(?:edit|settings)'/);
  assert.match(router, /LIFEHUB_PATHS = new Set\([\s\S]*'\/more'/);
  assert.doesNotMatch(router.slice(0, router.indexOf('LEGACY_ROUTE_ROOTS')), /'\/workout'|'\/diet'/);
  assert.doesNotMatch(router, /routePath === '\/more'[\s\S]*return DEFAULT_APP_PATH/);
  assert.doesNotMatch(router, /lazy\(\(\) => import\('\.\.\/pages\/travel\/TravelPage\.jsx'\)\)/);
  assert.doesNotMatch(router, /ConnectionsPage/);
  assert.match(`${memoPage}\n${memoCard}`, /중요 기록/);
  assert.doesNotMatch(`${memoPage}\n${memoCard}`, /소중한 기록/);
});

test('메모는 폴더 사이드바와 단순한 일반 텍스트 작성 화면을 제공한다', async () => {
  const [page, composer, folders, card, reader, css] = await Promise.all([
    source('src/components/notes/daily/DailyMemoPage.jsx'),
    source('src/components/notes/daily/DailyMemoComposer.jsx'),
    source('src/components/notes/daily/DailyMemoFolders.jsx'),
    source('src/components/notes/daily/DailyMemoCard.jsx'),
    source('src/components/notes/daily/DailyMemoReader.jsx'),
    source('src/styles/daily-memo.css')
  ]);

  assert.match(composer, /<section className="dailyMemoWritePanel" aria-label="메모 작성">/);
  assert.match(composer, /<textarea/);
  assert.match(composer, /Ctrl 또는 Command와 Enter를 함께 누르면 저장합니다/);
  assert.match(composer, /<details className="dailyMemoComposerDetails">/);
  assert.doesNotMatch(composer, /Markdown|markdown|Slash|slash|role="toolbar"|미리보기/);
  assert.match(card, /<p className="dailyMemoPlainBody isCompact">\{body\}<\/p>/);
  assert.match(card, /className="dailyMemoCardMenu"/);
  assert.match(card, /role="group" aria-label="메모 작업"/);
  assert.doesNotMatch(card, /TAG_ACCENTS|data-accent|dailyMemoCardPin|dailyMemoCardEdit/);
  assert.match(reader, /role="dialog"/);
  assert.match(reader, /aria-modal="true"/);
  assert.match(reader, /<p className="dailyMemoPlainBody">\{body\}<\/p>/);
  assert.match(reader, /텍스트 사본으로 편집/);
  assert.doesNotMatch(reader, /Markdown|markdown/);
  assert.match(page, /원본은 보존하고 텍스트 사본을 만들었어요/);
  assert.doesNotMatch(page, /\/notes\?|richEditorPath|navigate\(richEditorPath/);
  assert.match(page, /return \[\.\.\.new Set\(noteTags\)\]\.slice\(0, 12\)/);
  assert.match(page, /const \[filtersOpen, setFiltersOpen\] = useState\(false\)/);
  assert.match(page, /filtersOpen \? \(/);
  assert.match(page, /<DailyMemoFolders/);
  assert.match(page, /className="dailyMemoWorkspace"/);
  assert.match(page, /onMove=\{\(folderId\) => moveMemo\(note, folderId\)\}/);
  assert.match(folders, /className="dailyMemoFolderBackdrop"/);
  assert.match(folders, /role=\{mobile \? 'dialog'/);
  assert.match(folders, /DEFAULT_NOTE_DIRECTORY_ID_SET/);
  assert.doesNotMatch(page, /dailyMemoWelcome|dailyMemoRhythm|DailyMemoMark/);
  assert.match(css, /\.dailyMemoPlainBody \{[\s\S]*white-space: pre-wrap/);
  assert.doesNotMatch(css, /dailyMemoMarkdown|dailyMemoSlash/);
  assert.match(css, /\.dailyMemoReaderBackdrop \{[\s\S]*position: fixed/);
  assert.match(css, /\.dailyMemoCardMenu > div \{[\s\S]*position: absolute/);
  assert.match(css, /\.dailyMemoWorkspace \{[\s\S]*grid-template-columns: 208px minmax\(0, 1fr\)/);
  assert.match(css, /\.dailyMemoFolderPanel\.isMobile \{[\s\S]*height: 100dvh/);
  assert.doesNotMatch(css, /dailyMemoWelcome|dailyMemoRhythm|dailyMemoEditorTabs|grid-template-columns: minmax\(0, 0\.88fr\)/);
});

test('보관 Bridge·앱 수정과 운동·식단 화면은 비활성으로 유지한다', async () => {
  const [lifeHub, home, router, shell] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/features/home/HomePage.jsx'),
    source('src/routes/AppRouter.jsx'),
    source('src/components/lifehub/LifeHubShell.jsx')
  ]);
  const more = sectionBetween(lifeHub, 'function MorePage(', 'export default function LifeHubApp(');

  assert.doesNotMatch(lifeHub, /AiAssistantPage|AiPairingPage|AppEditorPage|createScheduleFromAssistant|createLifeRecordFromAssistant/);
  assert.doesNotMatch(home, /AiHomeCard|lifehub-ai/);
  assert.doesNotMatch(more, /앱 수정하기|\/ai\/edit|PC Bridge/);
  assert.match(shell, /path: '\/ai'/);
  assert.doesNotMatch(shell, /ai-editor|ai-settings/);
  assert.match(router, /const DEFAULT_APP_PATH = '\/app'/);
  assert.match(router, /LEGACY_ROUTE_ROOTS = new Set\(\[[\s\S]*'ai'/);
  assert.match(router, /'\/ai'/);
  assert.doesNotMatch(router, /'\/ai\/(?:edit|settings)'/);
  assert.match(router, /'diet'[\s\S]*'workout'/);
  assert.doesNotMatch(shell, /\/diet|\/workout|식단|운동/);
  assert.doesNotMatch(lifeHub, /const DietPage = lazy|route === 'diet'|route === 'workout'/);
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

  assert.match(codec, /export const LIFEHUB_BACKUP_FORMAT_VERSION = 2/);
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

test('IndexedDB 호환 저장과 거래 복구·월 예산·날짜 메모·백업 상태를 연결한다', async () => {
  const [main, storage, lifeHub, budget, home, briefingCard, budgetPanel, calendar, backup] = await Promise.all([
    source('src/main.jsx'),
    source('src/utils/orbitIndexedDbStorage.js'),
    source('src/LifeHubApp.jsx'),
    source('src/features/finance/monthlyBudget.js'),
    source('src/features/home/HomePage.jsx'),
    source('src/features/automation/DailyBriefingCard.jsx'),
    source('src/features/finance/MonthlyBudgetPanel.jsx'),
    source('src/components/home/HomeMonthCalendar.jsx'),
    source('src/features/backup/LifeHubBackupPanel.jsx')
  ]);

  assert.match(main, /await initializeOrbitIndexedDbStorage\(\)/);
  assert.match(storage, /ORBIT_DATABASE_NAME = 'orbit-local-data'/);
  assert.match(storage, /databaseRecords[\s\S]*storage\.setItem\(record\.key, record\.value\)/);
  assert.doesNotMatch(storage, /bridge-token|device-token|authorization/i);
  assert.match(lifeHub, /const \[editingEntryId, setEditingEntryId\]/);
  assert.match(lifeHub, /setDeletedEntry\(entry\)[\s\S]*saveBudget\(session, \[deletedEntry, \.\.\.current\]\)/);
  assert.match(lifeHub, /<FinanceWalletCard[\s\S]*<MonthlyBudgetPanel[\s\S]*<\/FinanceWalletCard>/);
  assert.equal((lifeHub.match(/<MonthlyBudgetPanel/g) || []).length, 1);
  assert.match(lifeHub, /remaining=\{!model\.budget\.configured[\s\S]*model\.budget\.remaining/);
  assert.match(lifeHub, /budget=\{model\.budget\.configured \? money\(model\.monthlyBudget\.amount\) : '미설정'\}/);
  assert.match(budget, /if \(!normalizedAmount\)/);
  assert.doesNotMatch(home, /orbitHomeCapture|바로 남기기/);
  assert.doesNotMatch(briefingCard, /lifeHubBriefingCapture|바로 남기기|\/schedule\?new=schedule|\/memo\?new=memo|\/finance\?new=entry/);
  assert.doesNotMatch(budgetPanel, /monthlyBudgetProgress|role="progressbar"/);
  assert.match(budgetPanel, /usage \+ '% 사용'/);
  assert.match(calendar, /summary\.memoItems/);
  assert.match(backup, /backupHealth\(currentData, backupStatus\)/);
});
test('v55 경량 캐시는 거래 검색과 기존 생활 기록 화면을 포함한다', async () => {
  const [serviceWorker, packageJson, entryCss, shell, home] = await Promise.all([
    source('public/sw.js'),
    source('package.json'),
    source('src/lifehub-entry.css'),
    source('src/components/lifehub/LifeHubShell.jsx'),
    source('src/features/home/HomePage.jsx')
  ]);

  assert.match(serviceWorker, /const CACHE_NAME = 'orbit-web-v63'/);
  assert.match(packageJson, /"test:lifehub-data": "node --test src\/features\/automation\/\*\.test\.js src\/features\/backup\/\*\.test\.js src\/features\/finance\/\*\.test\.js src\/features\/life-records\/\*\.test\.js src\/features\/travel\/\*\.test\.js src\/features\/ai-chat\/\*\.test\.js"/);
  assert.match(packageJson, /"test": "npm run test:lifehub-ai && npm run test:lifehub-data/);
  assert.match(entryCss, /@import '\.\/styles\/lifehub-automation\.css'/);
  assert.match(entryCss, /@import '\.\/styles\/lifehub-backup\.css'/);
  assert.match(entryCss, /@import '\.\/styles\/lifehub-finance\.css'/);
  assert.match(entryCss, /@import '\.\/styles\/lifehub-home\.css'/);
  assert.match(entryCss, /@import '\.\/styles\/lifehub-finance-navigation\.css'/);
  assert.doesNotMatch(entryCss, /lifehub-ai\.css/);
  assert.match(shell, /PRIMARY_TABS = \['home', 'schedule', 'memo', 'finance', 'travel', 'ai'\]/);
  assert.doesNotMatch(entryCss, /workout-scheduler|lifehub-diet|lifehub-body-profile/);
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

test('운동·식단은 앱 노출에서 제외하고 기존 데이터 호환 경계만 보존한다', async () => {
  const [lifeHub, shell, router, home, briefing, backupPanel, entryCss] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/components/lifehub/LifeHubShell.jsx'),
    source('src/routes/AppRouter.jsx'),
    source('src/features/home/HomePage.jsx'),
    source('src/features/automation/dailyBriefing.js'),
    source('src/features/backup/LifeHubBackupPanel.jsx'),
    source('src/lifehub-entry.css')
  ]);
  const scheduleCategories = sectionBetween(lifeHub, 'const ROUTINE_CATEGORY_OPTIONS = [', 'const ROUTINE_REPEAT_OPTIONS = [');

  assert.doesNotMatch(shell, /workout:|diet:|\/workout|\/diet|운동|식단/);
  assert.doesNotMatch(lifeHub, /const DietPage = lazy|route === 'diet'|route === 'workout'/);
  assert.match(lifeHub, /function isLegacyWorkoutSchedule/);
  assert.match(lifeHub, /readSchedules\(session\)\.filter\(\(item\) => !isLegacyWorkoutSchedule\(item\)\)/);
  assert.doesNotMatch(scheduleCategories, /exercise|운동|trophy/);
  assert.match(router, /'diet'[\s\S]*'workout'/);
  assert.doesNotMatch(home, /model\.workouts|model\.dietEntries|\/workout|\/diet/);
  assert.doesNotMatch(briefing, /\/workout|\/diet|label: '운동'|label: '식단'/);
  assert.doesNotMatch(backupPanel, /workouts: '운동'|dietEntries: '식단'|일정·메모·건강/);
  assert.doesNotMatch(entryCss, /workout-scheduler|lifehub-diet|lifehub-body-profile/);
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
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(manifest, /android\.permission\.RECEIVE_BOOT_COMPLETED/);
  assert.match(manifest, /android\.permission\.SCHEDULE_EXACT_ALARM/);
  assert.match(manifest, /android\.permission\.VIBRATE/);
  assert.match(manifest, /SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED/);
  assert.match(manifest, /android:versionName="0\.9\.4-debug"/);
  assert.match(manifest, /android:versionCode="45"/);
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

test('일정은 지난 미완료를 구분하고 foreground 복귀 때 알림을 재동기화한다', async () => {
  const [lifeHub, lifeHubUi, lifeHubCss] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/components/lifehub/LifeHubUi.jsx'),
    source('src/styles/lifehub.css')
  ]);
  const schedulePage = sectionBetween(lifeHub, 'function SchedulePage(', 'function FinancePage(');
  const appRoot = lifeHub.slice(lifeHub.indexOf('export default function LifeHubApp('));
  assert.match(appRoot, /document\.addEventListener\('visibilitychange', resyncNotifications\)/);
  assert.match(appRoot, /window\.addEventListener\('focus', resyncNotifications\)/);
  assert.match(appRoot, /const briefings = dailyBriefingNotifications\(settings, \{ now: new Date\(\) \}\)/);
  assert.match(appRoot, /scheduleRoutineNotifications\(model\.expandedSchedules, Date\.now\(\), briefings\)/);
  assert.match(schedulePage, /routineReminderSaveStatus\(/);
  assert.match(schedulePage, /filter === 'incomplete'/);
  assert.match(schedulePage, /isIncompleteSchedule\(item, statusNow\)/);
  assert.match(schedulePage, /setInterval\(\(\) => setStatusNow\(new Date\(\)\), 60_000\)/);
  assert.match(schedulePage, /일정 완료를 취소했어요/);
  assert.match(schedulePage, /reminderSaveStatus === 'no_upcoming'/);
  assert.match(schedulePage, /앞으로 14일 안에 발생할 반복 알림이 없어 아직 예약하지 않았어요/);
  assert.match(schedulePage, /showDateTime=\{filter === 'upcoming'\}/);
  assert.match(lifeHub, /dateLabel=\{showDateTime \? compactDateLabel\(item\.date\) : ''\}/);
  assert.match(lifeHubUi, /dateLabel \? <>\s*<span>\{dateLabel\}<\/span><b>\{timeLabel\}<\/b><\/> : timeLabel/);
  assert.match(lifeHubCss, /\.schedule-timeline-item\.has-date-time \{[\s\S]*grid-template-columns: 68px 14px minmax\(0, 1fr\)/);
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
  assert.match(router, /'\/ai'/);
  assert.doesNotMatch(router, /'\/ai\/(?:edit|settings)'/);
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

test('저장 실패 시 일정·가계부·여행 초안을 유지한다', async () => {
  const lifeHub = await source('src/LifeHubApp.jsx');
  const schedule = sectionBetween(lifeHub, 'const submitSchedule = async', 'const deleteSchedule =');
  const finance = sectionBetween(lifeHub, 'const submitEntry =', 'const deleteEntry =');
  const travel = await source('src/features/travel/TravelPage.jsx');

  assert.match(schedule, /const result = saveSchedules[\s\S]*if \(!result\.saved\) \{[\s\S]*입력 내용은 그대로 두었어요[\s\S]*return;[\s\S]*setDraft/);
  assert.match(finance, /const result = saveBudget[\s\S]*if \(!result\.saved\) \{[\s\S]*입력 내용은 그대로 두었어요[\s\S]*return;[\s\S]*setDraft/);
  assert.match(travel, /const result = saveTrips[\s\S]*현재 내용은 그대로 두었어요[\s\S]*if \(result\.saved\) refresh\(\)/);
});

test('홈 일정 추가는 커스텀 반복과 다중 요일 선택을 제공한다', async () => {
  const lifeHub = await source('src/LifeHubApp.jsx');
  const schedule = sectionBetween(lifeHub, 'function SchedulePage(', 'function FinancePage(');

  assert.match(lifeHub, /\{ value: 'custom', label: '커스텀' \}/);
  assert.match(schedule, /draft\.repeat === 'custom'/);
  assert.match(schedule, /CUSTOM_REPEAT_WEEKDAYS\.map/);
  assert.match(schedule, /aria-label="반복할 요일 선택"/);
  assert.match(schedule, /aria-pressed=\{selected\}/);
  assert.match(schedule, /반복할 요일을 하나 이상 선택해주세요/);
  assert.match(schedule, /repeatDays,/);
});

test('가계부 입력 진입은 수동 입력 탭에서 지출 카테고리를 정리하고 금액으로 이동한다', async () => {
  const lifeHub = await source('src/LifeHubApp.jsx');
  const finance = sectionBetween(lifeHub, 'function FinancePage(', 'function backupDataForModel(');

  assert.match(finance, /const formRef = useRef\(null\)/);
  assert.match(finance, /const amountInputRef = useRef\(null\)/);
  assert.match(finance, /const selectEntryType = [\s\S]*current\.category === '수입' \? '식비'/);
  assert.match(finance, /formRef\.current\?\.scrollIntoView/);
  assert.match(finance, /amountInputRef\.current\?\.focus/);
  assert.match(finance, /const openManualEntry = [\s\S]*setFinanceSection\('manual'\)[\s\S]*selectEntryType\(type, \{ focusAmount: true \}\)/);
  assert.equal((finance.match(/openManualEntry\('withdraw'\)/g) || []).length, 3);
  assert.match(finance, /<form ref=\{formRef\}/);
  assert.match(finance, /<input ref=\{amountInputRef\}/);
});

test('가계부는 월 지갑 아래를 내역·수동 입력·자동 기록·분류 공유 내부 메뉴로 정리한다', async () => {
  const [lifeHub, tabs, navigationCss, review, merchantModel] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/features/finance/FinanceSectionTabs.jsx'),
    source('src/styles/lifehub-finance-navigation.css'),
    source('src/features/finance/KakaoPayMerchantReviewPanel.jsx'),
    source('src/features/finance/kakaoPayMerchant.js')
  ]);
  const finance = sectionBetween(lifeHub, 'function FinancePage(', 'function backupDataForModel(');
  const walletIndex = finance.indexOf('<FinanceWalletCard');
  const tabsIndex = finance.indexOf('<FinanceSectionTabs');
  const shareIndex = finance.indexOf('<FinanceSharePanel');

  assert.ok(walletIndex > -1 && tabsIndex > walletIndex && shareIndex > tabsIndex);
  assert.match(finance, /financeSection-\$\{financeSection\}/);
  assert.match(finance, /const \[financeSection, setFinanceSection\] = useState\('ledger'\)/);
  assert.match(tabs, /내역/);
  assert.match(tabs, /수동 입력/);
  assert.match(tabs, /자동 기록/);
  assert.match(tabs, /분류·공유/);
  assert.match(tabs, /aria-label="가계부 내부 메뉴"/);
  assert.match(tabs, /aria-pressed=\{selected\}/);
  assert.match(navigationCss, /financeSection-ledger/);
  assert.match(navigationCss, /financeSection-manual/);
  assert.match(navigationCss, /financeSection-automation/);
  assert.match(navigationCss, /financeSection-manage/);
  assert.match(navigationCss, /grid-template-columns: repeat\(4,/);
  assert.match(navigationCss, /min-height: 52px/);
  assert.match(review, /당시 알림 원문은 보관하지 않아 실제 상호명을 직접 확인/);
  assert.match(review, /placeholder="실제 상호명"/);
  assert.match(merchantModel, /repairExistingKakaoPayEntries/);
  assert.match(merchantModel, /replaceKakaoPayEntryMerchant/);
  assert.match(lifeHub, /<KakaoPayMerchantReviewPanel/);
});

test('가계부 카테고리를 누르면 해당 월 거래만 날짜와 함께 보여준다', async () => {
  const [lifeHub, categoryModel, ledger] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/features/finance/financeCategoryLedger.js'),
    source('src/features/finance/FinanceLedger.jsx')
  ]);
  const finance = sectionBetween(lifeHub, 'function FinancePage(', 'function backupDataForModel(');

  assert.match(finance, /const \[selectedFinanceCategory, setSelectedFinanceCategory\] = useState\(''\)/);
  assert.match(finance, /financeEntriesForCategoryMonth\(model\.budgetEntries, selectedFinanceCategory, categoryMonth\)/);
  assert.match(finance, /aria-pressed=\{selectedFinanceCategory === category\}/);
  assert.match(finance, /aria-controls="finance-ledger-results"/);
  assert.match(finance, /financeMonthLabel\(categoryMonth\)/);
  assert.match(finance, /<FinanceLedger[\s\S]*entries=\{visibleBudgetEntries\}/);
  assert.match(ledger, /id="finance-ledger-results" aria-live="polite"/);
  assert.match(lifeHub, /const dateLabel = isDateKey\(entry\?\.date\) \? fullDateLabel\(entry\.date\)/);
  assert.match(categoryModel, /entry\?\.type !== 'deposit'/);
  assert.match(categoryModel, /startsWith\(`\$\{month\}-`\)/);
});

test('가계부는 정기 결제 예정과 실제 기록을 분리하고 월별 중복 없이 반영한다', async () => {
  const [lifeHub, panel, model, financeCss, backupCodec] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/features/finance/RecurringPaymentsPanel.jsx'),
    source('src/features/finance/recurringPayments.js'),
    source('src/styles/lifehub-finance.css'),
    source('src/features/backup/lifeHubBackupCodec.js')
  ]);
  const finance = sectionBetween(lifeHub, 'function FinancePage(', 'function backupDataForModel(');
  const walletIndex = finance.indexOf('<FinanceWalletCard');
  const recurringIndex = finance.indexOf('<RecurringPaymentsPanel');
  const cardImportIndex = finance.indexOf('<CardTransactionImportPanel');

  assert.ok(walletIndex > -1 && recurringIndex > walletIndex && cardImportIndex > recurringIndex);
  assert.match(panel, /정기 결제 · 이번 달 예정/);
  assert.match(panel, /예정 금액과 실제 가계부 기록은 따로 보여드려요/);
  assert.match(panel, /29·30·31일은 해당 날짜가 없는 달에 자동으로 말일 처리/);
  assert.match(panel, /결제 알림 자동 가져오기도 켜져 있어 같은 결제가 두 번 기록될 수 있어요/);
  assert.match(panel, /이미 기록된 가계부 내역은 유지돼요/);
  assert.match(model, /export function applyDueRecurringPayments/);
  assert.match(model, /processedMonths\.includes\(month\)/);
  assert.match(model, /budget-recurring-/);
  assert.match(lifeHub, /markRecurringPaymentsProcessed\(/);
  assert.match(lifeHub, /source === RECURRING_PAYMENT_SOURCE/);
  assert.match(backupCodec, /'recurringPayments'/);
  assert.match(financeCss, /\.lifeHubRecurringSummary \{/);
  assert.match(financeCss, /@media \(max-width: 699px\)[\s\S]*\.lifeHubRecurringSheet \{[\s\S]*border-radius: 20px 20px 0 0/);
});

test('가계부는 개인정보를 줄인 파일 사본을 Android 시스템 공유로 보내고 새 거래만 가져온다', async () => {
  const [
    lifeHub,
    panel,
    model,
    documents,
    android,
    coordinator,
    provider,
    policy,
    manifest,
    buildScript
  ] = await Promise.all([
    source('src/LifeHubApp.jsx'),
    source('src/features/finance/FinanceSharePanel.jsx'),
    source('src/features/finance/financeShare.js'),
    source('src/features/finance/financeShareDocuments.js'),
    source('../mobile/android/src/com/platform/aiassitant/MainActivity.java'),
    source('../mobile/android/src/com/platform/aiassitant/FinanceShareCoordinator.java'),
    source('../mobile/android/src/com/platform/aiassitant/FinanceShareFileProvider.java'),
    source('../mobile/android/src/com/platform/aiassitant/FinanceSharePolicy.java'),
    source('../mobile/android/AndroidManifest.xml'),
    source('../../scripts/build_android_apk.sh')
  ]);
  const finance = sectionBetween(lifeHub, 'function FinancePage(', 'function backupDataForModel(');
  const walletIndex = finance.indexOf('<FinanceWalletCard');
  const shareIndex = finance.indexOf('<FinanceSharePanel');
  const recurringIndex = finance.indexOf('<RecurringPaymentsPanel');

  assert.ok(walletIndex > -1 && shareIndex > walletIndex && recurringIndex > shareIndex);
  assert.match(panel, /한 번 보내는 가계부 사본/);
  assert.match(panel, /이후 기록은 자동 동기화되지 않으며/);
  assert.match(panel, /메모도 함께 보내기/);
  assert.match(panel, /기본으로 제외해요/);
  assert.match(panel, /Orbit용 JSON 공유/);
  assert.match(panel, /보기용 CSV 공유/);
  assert.match(panel, /현재 거래는 지우거나 덮어쓰지 않고 새 거래만 추가해요/);
  assert.match(model, /FINANCE_SHARE_PRODUCT = 'OrbitFinance'/);
  assert.match(model, /const ROOT_KEYS = \['product', 'formatVersion', 'exportedAt', 'period', 'memoIncluded', 'count', 'entries'\]/);
  assert.match(model, /return `share-\$\{/);
  assert.match(model, /source: 'finance-share'/);
  assert.match(model, /filter\(\(entry\) => !existingIds\.has\(entry\.id\)\)/);
  assert.doesNotMatch(model, /eventId|cardNumber|accountNumber|owner/);
  assert.match(documents, /shareFinanceFile\(value\.fileName, value\.mimeType, value\.content\)/);
  assert.match(documents, /navigatorObject\.share\(payload\)/);
  assert.match(documents, /FINANCE_SHARE_DOCUMENT_MAX_BYTES = 8 \* 1024 \* 1024/);
  assert.match(android, /public boolean shareFinanceFile\(String fileName, String mimeType, String content\)/);
  assert.match(android, /isTrustedNativeCaller\(\)[\s\S]*coordinator\.share\(expectedOrigin/);
  assert.match(coordinator, /Intent\.ACTION_SEND/);
  assert.match(coordinator, /Intent\.EXTRA_STREAM/);
  assert.match(coordinator, /Intent\.FLAG_GRANT_READ_URI_PERMISSION/);
  assert.match(coordinator, /activity\.getCacheDir\(\)/);
  assert.doesNotMatch(coordinator, /android\.util\.Log|System\.(?:out|err)|printStackTrace/);
  assert.match(provider, /ParcelFileDescriptor\.MODE_READ_ONLY/);
  assert.match(provider, /if \(!"r"\.equals\(mode\)\)/);
  assert.match(policy, /CACHE_RETENTION_MILLIS = 24L \* 60L \* 60L \* 1000L/);
  assert.match(manifest, /android:name="\.FinanceShareFileProvider"/);
  assert.match(manifest, /android:authorities="com\.platform\.aiassitant\.finance-share"/);
  assert.match(manifest, /android:exported="false"[\s\S]*android:grantUriPermissions="true"/);
  assert.doesNotMatch(manifest, /android\.permission\.BLUETOOTH/);
  assert.match(buildScript, /FinanceSharePolicyStaticTest/);
  assert.match(buildScript, /non-exported, grant-only finance share provider/);
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
  const finance = sectionBetween(lifeHub, 'function FinancePage(', 'function backupDataForModel(');
  const appRoot = lifeHub.slice(lifeHub.indexOf('export default function LifeHubApp('));

  assert.equal((lifeHub.match(/useCardTransactionImport\(/g) || []).length, 1);
  assert.match(appRoot, /const cardImport = useCardTransactionImport\(\{/);
  assert.match(appRoot, /<FinancePage[\s\S]*cardImport=\{cardImport\}/);
  assert.match(finance, /<CardTransactionImportPanel[\s\S]*cardImport=\{cardImport\}/);
  assert.match(panel, /결제 알림 자동 가져오기/);
  assert.match(panel, /삼성월렛·카카오페이·토스 앱 중 사용할 앱만 선택하세요/);
  assert.match(panel, /카카오톡 알림톡은 읽지 않아요/);
  assert.match(panel, /cardImport\.selectedSources\.includes\(source\.id\)/);
  assert.match(panel, /cardImport\.toggleSource\(source\.id\)/);
  assert.doesNotMatch(panel, /cardImport\.enabled \? \([\s\S]{0,120}lifeHubCardImportSources/);
  assert.match(panel, /실제 결제 승인만 보수적으로 가져오며 송금·이체·입출금은 대상이 아닙니다/);
  assert.match(panel, /알림 원문·잔액·계좌·카드번호는 표시하거나 저장하지 않고/);
  assert.match(panel, /알림 접근은 모든 앱의 알림을 볼 수 있는 넓은 특수 권한/);
  assert.match(panel, /Orbit은 선택한 삼성월렛·카카오페이·토스 알림만 기기 안에서 확인/);
  assert.match(panel, /권한을 허용하기 전의 과거 결제 내역은 가져올 수 없어요/);
  assert.match(panel, /알림 접근 설정/);
  assert.match(panel, /‘제한된 설정’으로 막힐 때/);
  assert.match(panel, /오늘 자동 가져오기/);
  assert.match(panel, /누적 자동 가져오기/);
  assert.match(panel, /지금 가져오기/);
  assert.match(panel, /잘못 인식된 결제는 ‘내역’ 탭의 최근 거래에서 바로 삭제/);
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
  assert.match(batch, /normalizeKakaoPayMerchant\(normalized\.merchant\)/);
  assert.match(batch, /memo: merchant/);
  assert.doesNotMatch(batch, /rawText|balance|accountNumber|cardNumber/);

  assert.match(adapter, /const keys = \['eventId', 'source', 'amount', 'merchant', 'occurredAt'\]/);
  assert.match(adapter, /hasExactKeys\(value, keys\)/);
  assert.match(adapter, /CARD_IMPORT_SOURCES = Object\.freeze\(\[[\s\S]*id: 'samsung-wallet'[\s\S]*id: 'kakao-pay'[\s\S]*id: 'toss'/);
  assert.doesNotMatch(adapter, /tmoney|티머니|shinhan|신한/i);
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

  const schedulePage = sectionBetween(lifeHub, 'function SchedulePage(', 'function FinancePage(');
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
