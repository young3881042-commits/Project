import MemoNavIcon from '../MemoNavIcon.jsx';
import MobileWorkspaceTabs from '../MobileWorkspaceTabs.jsx';
import {
  HomeFeatureCards,
  HomeGreetingCard,
  ProgressPanel,
  TodaySchedulePanel,
  TravelPlanBanner
} from './AppHomeSections.jsx';

export default function AppHome({
  accountError,
  accountMode,
  appOverview,
  guestStarting,
  isMemberSession,
  navigate,
  onStartGuest,
  session
}) {
  return (
    <main className={`spaceHome referenceHome${isMemberSession ? ' memberSession' : ''}`}>
      <section className="spaceAppFrame appHomeDashboard" aria-label="앱 홈">
        <button
          type="button"
          className="appHomeBellButton"
          aria-label={isMemberSession ? '내 정보 열기' : '로그인 열기'}
          onClick={() => navigate(isMemberSession ? '/mypage' : '/login?redirect=/app')}
        >
          <MemoNavIcon type="bell" />
          <i aria-hidden="true" />
        </button>

        <header className="appHomeHero">
          <div className="appHomeHeroCopy">
            <h1>
              메모부터 여행 계획까지,
              <span>가볍게 정리하고</span>
              똑똑하게 관리하세요.
            </h1>
            <p>메모와 일정을 한눈에, 당신의 하루를 더 효율적으로.</p>
          </div>
          <div className="appHomeRobot" aria-hidden="true">
            <img src="/robot-guide.png" alt="" />
          </div>
        </header>

        <HomeGreetingCard
          accountError={accountError}
          accountMode={accountMode}
          guestStarting={guestStarting}
          isMemberSession={isMemberSession}
          navigate={navigate}
          onStartGuest={onStartGuest}
          session={session}
        />

        <HomeFeatureCards appOverview={appOverview} navigate={navigate} />
        <TodaySchedulePanel appOverview={appOverview} navigate={navigate} />
        <ProgressPanel appOverview={appOverview} />
        <TravelPlanBanner navigate={navigate} />
        <MobileWorkspaceTabs active="home" navigate={navigate} />
      </section>
    </main>
  );
}
