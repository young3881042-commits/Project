import MobileWorkspaceTabs from '../MobileWorkspaceTabs.jsx';
import {
  HomeAccountStrip,
  HomeModeSelector,
  HomeRobotHero,
  QuickActionCard,
  RecentMemoCard,
  TodayFlowCard
} from './AppHomeSections.jsx';

export default function AppHome({
  accountError,
  accountMode,
  appOverview,
  guestStarting,
  inlineAuth,
  isMemberSession,
  navigate,
  onStartGuest,
  onPlanModeChange,
  onScheduleToggle,
  planMode = 'personal',
  session
}) {
  const showAccountPanel = Boolean(accountError || inlineAuth?.open);

  return (
    <main className={`spaceHome referenceHome${isMemberSession ? ' memberSession' : ''}`}>
      <section className="spaceAppFrame appHomeDashboard" aria-label="앱 홈">
        <header className="appHomeHeader">
          <div className="appHomeTitleGroup">
            <h1>개인 워크스페이스</h1>
            <p>AI 일정 · 여행 도우미</p>
          </div>
          <div className="appHomeHeaderActions">
            <button
              type="button"
              className="appHomeLoginButton"
              onClick={() => (isMemberSession ? navigate('/mypage') : inlineAuth?.onOpen?.())}
            >
              {isMemberSession ? '내 정보' : '로그인'}
            </button>
          </div>
        </header>

        <HomeModeSelector
          activeMode="personal"
          onSelect={(mode) => (mode === 'travel' ? navigate('/destinations') : onPlanModeChange?.('personal'))}
        />
        <HomeRobotHero appOverview={appOverview} navigate={navigate} planMode="personal" />

        {showAccountPanel ? (
          <HomeAccountStrip
            accountError={accountError}
            accountMode={accountMode}
            guestStarting={guestStarting}
            inlineAuth={inlineAuth}
            isMemberSession={isMemberSession}
            navigate={navigate}
            onStartGuest={onStartGuest}
            session={session}
          />
        ) : null}

        <TodayFlowCard appOverview={appOverview} navigate={navigate} onScheduleToggle={onScheduleToggle} />
        <QuickActionCard navigate={navigate} planMode={planMode} />
        <RecentMemoCard appOverview={appOverview} navigate={navigate} planMode={planMode} />
        <MobileWorkspaceTabs active="home" navigate={navigate} />
      </section>
    </main>
  );
}
