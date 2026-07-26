import MobilePageShell from '../MobilePageShell.jsx';
import MemoNavIcon from '../MemoNavIcon.jsx';
import HomeScheduleCards from './HomeScheduleCards.jsx';
import { loginUrlForRedirect } from '../../authRoutes.js';
import { HomeAccountStrip } from './AppHomeSections.jsx';

export default function AppHome({
  accountError,
  accountMode,
  appOverview,
  guestStarting,
  inlineAuth,
  isMemberSession,
  navigate,
  onQuickMemoChange,
  onQuickMemoSubmit,
  onStartGuest,
  onScheduleToggle,
  quickMemoStatus,
  quickMemoText,
  session
}) {
  const showAccountPanel = Boolean(accountError || inlineAuth?.open);
  const accountName = isMemberSession ? session?.username || 'Member' : 'Guest';
  const accountPath = isMemberSession ? '/mypage' : loginUrlForRedirect('/app');
  const accountLabel = isMemberSession ? '내 정보' : '로그인';
  const openAccount = () => {
    if (accountPath.startsWith('http://') || accountPath.startsWith('https://')) {
      window.location.assign(accountPath);
      return;
    }
    navigate(accountPath);
  };

  return (
    <MobilePageShell
      activeTab="home"
      className={`spaceHome referenceHome${isMemberSession ? ' memberSession' : ''}`}
      icon="home"
      navigate={navigate}
      profile={{
        name: accountName,
        label: accountLabel,
        onClick: openAccount
      }}
      subtitle="모바일에 최적화된 일정 · 메모 앱"
      title="개인 워크스페이스"
    >
      <section className="spaceAppFrame appHomeDashboard" aria-label="앱 홈">
        <header className="appHomeHeader desktopAppHomeHeader">
          <div className="appHomeTitleGroup">
            <h1>개인 워크스페이스</h1>
            <p>모바일에 최적화된 일정 · 메모 앱</p>
          </div>
          <div className="appHomeHeaderActions">
            <button type="button" onClick={() => navigate('/notes')}><MemoNavIcon type="board" />새 메모</button>
            <button type="button" className="primary" onClick={() => navigate('/scheduler')}><MemoNavIcon type="calendar" />일정 보기</button>
          </div>
        </header>

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

        <HomeScheduleCards
          appOverview={appOverview}
          onQuickMemoChange={onQuickMemoChange}
          onQuickMemoSubmit={onQuickMemoSubmit}
          onScheduleToggle={onScheduleToggle}
          quickMemoStatus={quickMemoStatus}
          quickMemoText={quickMemoText}
        />
      </section>
    </MobilePageShell>
  );
}
