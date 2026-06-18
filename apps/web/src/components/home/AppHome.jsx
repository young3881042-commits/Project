import MobilePageShell from '../MobilePageShell.jsx';
import HomeScheduleCards from './HomeScheduleCards.jsx';
import { loginUrlForRedirect } from '../../authRoutes.js';
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
  const accountName = isMemberSession ? session?.username || 'Member' : 'Guest';
  const accountPath = isMemberSession ? '/mypage' : loginUrlForRedirect('/app');
  const accountLabel = isMemberSession ? '내 정보' : '로그인';
  const accountInitial = accountName.slice(0, 1).toUpperCase();
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
      subtitle="일정 · 메모 도우미"
      title="개인 워크스페이스"
    >
      <section className="spaceAppFrame appHomeDashboard" aria-label="앱 홈">
        <header className="appHomeHeader desktopAppHomeHeader">
          <div className="appHomeTitleGroup">
            <h1>개인 워크스페이스</h1>
            <p>AI 일정 · 메모 도우미</p>
          </div>
          <div className="appHomeHeaderActions">
            <button type="button" className="appHomeAccountButton" onClick={openAccount}>
              <span>{accountInitial}</span>
              <strong>{accountName}</strong>
              <small>{accountLabel}</small>
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
      </section>
    </MobilePageShell>
  );
}
