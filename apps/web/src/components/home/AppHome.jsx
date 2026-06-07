import MobileWorkspaceTabs from '../MobileWorkspaceTabs.jsx';
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
  const openAccount = () => {
    if (accountPath.startsWith('http://') || accountPath.startsWith('https://')) {
      window.location.assign(accountPath);
      return;
    }
    navigate(accountPath);
  };

  return (
    <main className={`spaceHome referenceHome${isMemberSession ? ' memberSession' : ''}`}>
      <section className="spaceAppFrame appHomeDashboard" aria-label="앱 홈">
        <header className="appHomeHeader">
          <div className="appHomeTitleGroup">
            <h1>MU Editor</h1>
            <p>일정 · 메모 도우미</p>
          </div>
          <div className="appHomeHeaderActions">
            <button
              type="button"
              className="appHomeLoginButton appHomeAccountButton"
              onClick={openAccount}
            >
              <span>{accountName.slice(0, 1).toUpperCase()}</span>
              <strong>{accountName}</strong>
              <small>{isMemberSession ? '내 정보' : '로그인'}</small>
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
        <MobileWorkspaceTabs active="home" navigate={navigate} />
      </section>
    </main>
  );
}
