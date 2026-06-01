import MemoNavIcon from '../MemoNavIcon.jsx';
import MobileWorkspaceTabs from '../MobileWorkspaceTabs.jsx';
import {
  AiSuggestionCard,
  HomeAccountStrip,
  HomeModeSelector,
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
            <p>AI 일정 도우미</p>
          </div>
          <div className="appHomeHeaderActions">
            <button type="button" aria-label="알림" onClick={() => navigate('/scheduler')}>
              <MemoNavIcon type="bell" />
            </button>
            <button
              type="button"
              aria-label="메뉴"
              onClick={() => (isMemberSession ? navigate('/mypage') : inlineAuth?.onOpen?.())}
            >
              <MemoNavIcon type="menu" />
            </button>
          </div>
        </header>

        <HomeModeSelector activeMode={planMode} onSelect={onPlanModeChange} />

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

        <TodayFlowCard appOverview={appOverview} navigate={navigate} planMode={planMode} />
        <QuickActionCard navigate={navigate} />
        <RecentMemoCard appOverview={appOverview} navigate={navigate} planMode={planMode} />
        <AiSuggestionCard navigate={navigate} planMode={planMode} />
        <MobileWorkspaceTabs active="home" navigate={navigate} />
      </section>
    </main>
  );
}
