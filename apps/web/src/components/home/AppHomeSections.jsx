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
    ? `${session?.username || 'Member'}님, 다음 여행을 코스로 정리해 보세요.`
    : '안녕하세요! 오늘도 멋진 여행 되세요.';

  return (
    <section className="appHomeGreetingCard" aria-label="오늘 시작">
      <button type="button" className="appHomeGreetingMain" onClick={() => navigate('/planner')}>
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

export function HomeFeatureCards({ navigate }) {
  return (
    <section className="appHomeFeatureGrid" aria-label="주요 기능">
      <button type="button" className="appHomeFeatureCard memo" onClick={() => navigate('/notes')}>
        <span className="appHomeFeatureTitle">
          <MemoNavIcon type="board" />
          <strong>메모</strong>
        </span>
        <p>여행 생각을 빠르게 기록해요.</p>
        <span className="appHomeFeatureIcon"><MemoNavIcon type="edit" /></span>
      </button>
      <button type="button" className="appHomeFeatureCard schedule" onClick={() => navigate('/scheduler')}>
        <span className="appHomeFeatureTitle">
          <MemoNavIcon type="calendar" />
          <strong>일정</strong>
        </span>
        <p>여행 일정을 날짜별로 계획해요.</p>
        <span className="appHomeFeatureIcon"><MemoNavIcon type="calendar" /></span>
      </button>
      <button type="button" className="appHomeFeatureCard trip" onClick={() => navigate('/planner')}>
        <span className="appHomeFeatureTitle">
          <MemoNavIcon type="trip" />
          <strong>여행 코스</strong>
        </span>
        <p>나만의 코스를 만들어요.</p>
        <span className="appHomeFeatureIcon"><MemoNavIcon type="trip" /></span>
      </button>
      <button type="button" className="appHomeFeatureCard search" onClick={() => navigate('/destinations')}>
        <span className="appHomeFeatureTitle">
          <MemoNavIcon type="search" />
          <strong>장소 찾기</strong>
        </span>
        <p>좋은 장소를 찾아봐요.</p>
        <span className="appHomeFeatureIcon"><MemoNavIcon type="search" /></span>
      </button>
    </section>
  );
}

export function TodaySchedulePanel({ appOverview, navigate }) {
  const items = appOverview.todayPreviewItems || [];

  return (
    <section className="appHomePanel appHomeTodayPanel" aria-label="이번 여행 일정">
      <header className="appHomePanelHeader">
        <span>
          <MemoNavIcon type="calendar" />
          <strong>이번 여행 일정</strong>
        </span>
        <button type="button" onClick={() => navigate('/scheduler')}>일정 보기</button>
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
          <span>등록된 여행 일정이 없어요.</span>
          <strong>여행 일정 추가하기</strong>
        </button>
      )}

      <button type="button" className="appHomePanelAction" onClick={() => navigate('/scheduler')}>
        여행 일정 더보기
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
          <span>이번 주 여행 준비 진행 상황</span>
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
          <strong>여행 준비 중</strong>
          <span>메모와 일정을 코스로 이어보세요.</span>
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
        <strong>AI 추천 팁</strong>
        <p>메모와 일정에 맞는 여행 코스를 추천받아요.</p>
      </div>
      <button type="button" onClick={() => navigate('/planner')}>
        코스 만들기
        <MemoNavIcon type="chevronRight" />
      </button>
    </section>
  );
}
