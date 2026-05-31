import MemoNavIcon from '../MemoNavIcon.jsx';
import MobileWorkspaceTabs from '../MobileWorkspaceTabs.jsx';
import {
  HomeAccountStrip,
  HomeFeatureCards,
  HomeModeSelector,
  TodaySchedulePanel,
  TravelInsightGrid,
  TravelPrepPanel
} from './AppHomeSections.jsx';

const HOME_MODE_COPY = {
  general: {
    title: ['오늘의 흐름을', '가볍게 정리해요.'],
    body: '메모, 일정, 할 일을 한곳에서 정리하세요.'
  },
  travel: {
    title: ['여행 준비를', '계획으로 정리해요.'],
    body: '코스, 장소, 체크리스트를 선택한 여행 계획에 모으세요.'
  },
  work: {
    title: ['업무 흐름을', '차분하게 정리해요.'],
    body: '업무 일정, 할 일, 회의 메모를 한 화면에서 확인하세요.'
  },
  study: {
    title: ['공부 계획을', '꾸준하게 이어가요.'],
    body: '학습 메모, 복습 일정, 과제를 놓치지 않게 정리하세요.'
  },
  fitness: {
    title: ['운동 루틴을', '오늘 일정에 맞춰요.'],
    body: '운동 기록, 체크리스트, 회복 일정을 함께 관리하세요.'
  }
};

export default function AppHome({
  accountError,
  accountMode,
  appOverview,
  guestStarting,
  isMemberSession,
  navigate,
  onStartGuest,
  onPlanModeChange,
  planMode = 'general',
  session
}) {
  const modeCopy = HOME_MODE_COPY[planMode] || HOME_MODE_COPY.general;

  return (
    <main className={`spaceHome referenceHome${isMemberSession ? ' memberSession' : ''}`}>
      <section className="spaceAppFrame appHomeDashboard" aria-label="앱 홈">
        <div className="appHomeTopBrand" aria-label="앱 이름">
          <span>
            <MemoNavIcon type="spark" />
          </span>
          <div>
            <strong>개인 워크스페이스</strong>
            <small>AI 일정 도우미</small>
          </div>
        </div>

        <button
          type="button"
          className="appHomeBellButton"
          aria-label={isMemberSession ? '내 정보 열기' : '로그인 열기'}
          onClick={() => navigate(isMemberSession ? '/mypage' : '/login?redirect=/app')}
        >
          <MemoNavIcon type="bell" />
          <i aria-hidden="true" />
        </button>

        <HomeModeSelector
          activeMode={planMode}
          counts={appOverview.planTypeCounts}
          onSelect={onPlanModeChange}
        />

        <header className="appHomeHero">
          <div className="appHomeHeroCopy">
            <h1>
              {modeCopy.title[0]}
              <span>{modeCopy.title[1]}</span>
            </h1>
            <p>{modeCopy.body}</p>
          </div>
          <div className="appHomeRobot" aria-hidden="true">
            <img src="/robot-guide.png" alt="" />
          </div>
        </header>

        <HomeAccountStrip
          accountError={accountError}
          accountMode={accountMode}
          guestStarting={guestStarting}
          isMemberSession={isMemberSession}
          navigate={navigate}
          onStartGuest={onStartGuest}
          planMode={planMode}
          session={session}
        />

        <TodaySchedulePanel appOverview={appOverview} navigate={navigate} planMode={planMode} />
        <HomeFeatureCards appOverview={appOverview} navigate={navigate} planMode={planMode} />
        <TravelInsightGrid appOverview={appOverview} navigate={navigate} planMode={planMode} />
        <TravelPrepPanel appOverview={appOverview} navigate={navigate} planMode={planMode} />
        <MobileWorkspaceTabs active="home" navigate={navigate} />
      </section>
    </main>
  );
}
