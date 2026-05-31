import MemoNavIcon from '../MemoNavIcon.jsx';

const SCHEDULE_ACCENTS = ['blue', 'green', 'violet'];

function scheduleTimeLabel(time) {
  return time || '종일';
}

export function HomeGreetingCard({
  accountMode,
  accountError,
  guestStarting,
  isMemberSession,
  navigate,
  onStartGuest,
  session
}) {
  const greeting = isMemberSession
    ? `${session?.username || 'Member'}님, 오늘 일정부터 정리해 보세요.`
    : '안녕하세요! 오늘도 계획적인 하루 되세요.';

  return (
    <section className="appHomeGreetingCard" aria-label="오늘 시작">
      <button type="button" className="appHomeGreetingMain" onClick={() => navigate('/scheduler')}>
        <span className="appHomeGreetingAvatar">
          <img src="/robot-guide.png" alt="" />
        </span>
        <strong>{greeting}</strong>
        <MemoNavIcon type="chevronRight" />
      </button>
      {!isMemberSession ? (
        <div className="appHomeAccountMini" aria-label="계정 시작">
          <button
            type="button"
            className={accountMode === 'guest' ? 'active' : ''}
            onClick={onStartGuest}
            disabled={guestStarting}
          >
            {guestStarting ? 'Guest 준비 중' : accountMode === 'guest' ? 'Guest 사용 중' : 'Guest 시작'}
          </button>
          <button type="button" onClick={() => navigate('/login?redirect=/scheduler')}>
            Member 로그인
          </button>
        </div>
      ) : (
        <div className="appHomeAccountMini member">
          <button type="button" onClick={() => navigate('/mypage')}>내 정보</button>
        </div>
      )}
      {accountError ? <p className="appHomeAccountError">{accountError}</p> : null}
    </section>
  );
}

export function HomeFeatureCards({ appOverview, navigate }) {
  return (
    <section className="appHomeFeatureGrid" aria-label="주요 기능">
      <button type="button" className="appHomeFeatureCard memo" onClick={() => navigate('/notes')}>
        <span className="appHomeFeatureTitle">
          <MemoNavIcon type="board" />
          <strong>메모</strong>
        </span>
        <p>빠르게 기록하고 체계적으로 정리해요.</p>
        <span className="appHomeFeatureIcon"><MemoNavIcon type="edit" /></span>
      </button>
      <button type="button" className="appHomeFeatureCard schedule" onClick={() => navigate('/scheduler')}>
        <span className="appHomeFeatureTitle">
          <MemoNavIcon type="calendar" />
          <strong>일정</strong>
        </span>
        <p>중요한 일정을 놓치지 않게 관리해요.</p>
        <span className="appHomeFeatureIcon"><MemoNavIcon type="calendar" /></span>
        <small>{appOverview.todayDoneCount}/{appOverview.todayCount} 완료</small>
      </button>
    </section>
  );
}

export function TodaySchedulePanel({ appOverview, navigate }) {
  const items = appOverview.todayPreviewItems || [];

  return (
    <section className="appHomePanel appHomeTodayPanel" aria-label="오늘 일정">
      <header className="appHomePanelHeader">
        <span>
          <MemoNavIcon type="calendar" />
          <strong>오늘 일정</strong>
        </span>
        <button type="button" onClick={() => navigate('/scheduler')}>전체 보기</button>
        <MemoNavIcon type="chevronDown" />
      </header>

      {items.length ? (
        <div className="appHomeScheduleList">
          {items.map((item, index) => (
            <button
              type="button"
              key={`${item.id || item.title}-${item.time || index}`}
              className={`appHomeScheduleRow ${SCHEDULE_ACCENTS[index % SCHEDULE_ACCENTS.length]}${item.done ? ' done' : ''}`}
              onClick={() => navigate('/scheduler')}
            >
              <time>{scheduleTimeLabel(item.time)}</time>
              <strong>{item.title}</strong>
              <span>{item.type || '일정'}</span>
              <MemoNavIcon type="chevronRight" />
            </button>
          ))}
        </div>
      ) : (
        <button type="button" className="appHomeEmptySchedule" onClick={() => navigate('/scheduler')}>
          <span>오늘 등록된 일정이 없어요.</span>
          <strong>일정 추가하기</strong>
        </button>
      )}

      <button type="button" className="appHomePanelAction" onClick={() => navigate('/scheduler')}>
        일정 더보기
        <MemoNavIcon type="chevronRight" />
      </button>
    </section>
  );
}

export function ProgressPanel({ appOverview }) {
  const total = appOverview.weekCount || 0;
  const done = appOverview.weekDoneCount || 0;
  const progress = total ? appOverview.weekProgress : appOverview.todayProgress;
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));

  return (
    <section className="appHomePanel appHomeProgressPanel" aria-label="진행도">
      <header className="appHomePanelHeader">
        <span>
          <MemoNavIcon type="chart" />
          <strong>진행도</strong>
        </span>
        <MemoNavIcon type="chevronDown" />
      </header>
      <div className="appHomeProgressGrid">
        <div className="appHomeProgressCard">
          <span>이번 주 일정 진행 상황</span>
          <div className="appHomeProgressBar" aria-label={`진행률 ${safeProgress}%`}>
            <i style={{ width: `${safeProgress}%` }} />
          </div>
          <p>
            <strong>완료 {done}</strong>
            <em>/ 전체 {total}</em>
            <b>{safeProgress}%</b>
          </p>
        </div>
        <div className="appHomeEncourageCard">
          <MemoNavIcon type="trophy" />
          <strong>잘하고 있어요!</strong>
          <span>조금만 더 힘내세요.</span>
        </div>
      </div>
    </section>
  );
}

export function TravelPlanBanner({ navigate }) {
  return (
    <section className="appHomeTravelBanner" aria-label="여행 계획 만들기">
      <span className="appHomeTravelVisual">
        <MemoNavIcon type="trip" />
      </span>
      <div>
        <strong>여행 계획 만들기</strong>
        <p>AI로 여행 일정을 빠르게 생성해요.</p>
      </div>
      <button type="button" onClick={() => navigate('/planner')}>
        계획 시작
        <MemoNavIcon type="chevronRight" />
      </button>
    </section>
  );
}
