import MobileWorkspaceTabs from '../MobileWorkspaceTabs.jsx';
import MemoNavIcon from '../MemoNavIcon.jsx';
import HomeRecentMemoCard from './HomeRecentMemoCard.jsx';
import HomeScheduleCards from './HomeScheduleCards.jsx';
import {
  HomeAccountStrip,
  HomeRobotHero
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
  onScheduleToggle,
  session
}) {
  const showAccountPanel = Boolean(accountError || inlineAuth?.open);

  return (
    <main className={`spaceHome referenceHome${isMemberSession ? ' memberSession' : ''}`}>
      <section className="spaceAppFrame appHomeDashboard" aria-label="앱 홈">
        <header className="appHomeHeader">
          <div className="appHomeTitleGroup">
            <h1>개인 워크스페이스</h1>
            <p>AI 일정 · 메모 도우미</p>
          </div>
          <div className="appHomeHeaderActions">
            <button
              type="button"
              className="appHomeLoginButton"
              onClick={() => (isMemberSession ? navigate('/mypage') : inlineAuth?.onOpen?.())}
            >
              <MemoNavIcon type="user" />
              <span>{isMemberSession ? '내 정보' : '로그인'}</span>
            </button>
          </div>
        </header>

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

        <HomeScheduleCards appOverview={appOverview} navigate={navigate} onScheduleToggle={onScheduleToggle} />
        <HomeRecentMemoCard appOverview={appOverview} navigate={navigate} planMode="personal" />
        <MobileWorkspaceTabs active="home" navigate={navigate} />
      </section>
    </main>
  );
}
