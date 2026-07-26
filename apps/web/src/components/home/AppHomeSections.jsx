import MemoNavIcon from '../MemoNavIcon.jsx';

function normalizeWorkspaceMode(mode) {
  return mode === 'travel' ? 'travel' : 'personal';
}

export function HomeRobotHero({ appOverview, navigate, planMode = 'personal' }) {
  const workspace = normalizeWorkspaceMode(planMode);
  const isTravel = workspace === 'travel';
  const travelPlan = appOverview?.travelPlanPreview;
  const badge = isTravel ? 'Travel mode' : 'Today mode';
  const title = isTravel ? '여행 코스, 같이 정리돼요' : '오늘 할 일, 같이 정리돼요';
  const description = isTravel ? '코스 메모와 일정을 한 화면에서 이어서 볼 수 있어요.' : '메모와 일정을 가볍게 도와드려요.';
  const imageSrc = isTravel ? '/assets/travel-home-hero.png' : '/robot-guide.png';
  const imageAlt = isTravel ? '여행 일정을 정리하는 이미지' : '일정과 메모를 들고 있는 AI 로봇';

  return (
    <section className={`appHomeRobotHero ${isTravel ? 'travel' : 'personal'}`} aria-label="AI 로봇 홈">
      <div className="appHomeRobotHeroCopy">
        <span>{badge}</span>
        <strong>{title}</strong>
        <p>{description}</p>
        {isTravel ? (
          <div className="appHomeTravelCountdown" aria-label="여행 D-day">
            <strong>{travelPlan?.dDayLabel || 'D-day'}</strong>
            <span>{travelPlan?.title || '여행 일정 준비중'}</span>
          </div>
        ) : null}
        {isTravel ? (
          <div className="appHomeRobotHeroActions">
            <button type="button" onClick={() => navigate('/planner')}>
              <MemoNavIcon type="trip" />
              코스 만들기
            </button>
            <button type="button" onClick={() => navigate('/destinations')}>
              <MemoNavIcon type="search" />
              장소 찾기
            </button>
          </div>
        ) : null}
      </div>
      <figure className="appHomeRobotImage">
        <img src={imageSrc} alt={imageAlt} />
      </figure>
    </section>
  );
}

export function HomeAccountStrip({
  accountMode,
  accountError,
  guestStarting,
  inlineAuth,
  isMemberSession,
  navigate,
  onStartGuest,
  session
}) {
  const isSignup = inlineAuth?.mode === 'signup';
  return (
    <section className="appHomeAccountStrip" aria-label="계정 상태">
      <span>
        <MemoNavIcon type="user" />
        <strong>{isMemberSession ? `${session?.username || 'Member'} 워크스페이스` : 'Guest 워크스페이스'}</strong>
      </span>
      {!isMemberSession ? (
        <div>
          <button
            type="button"
            className={accountMode === 'guest' ? 'active' : ''}
            onClick={onStartGuest}
            disabled={guestStarting}
          >
            {guestStarting ? '준비 중' : accountMode === 'guest' ? 'Guest 사용 중' : 'Guest 시작'}
          </button>
          <button
            type="button"
            className={inlineAuth?.open ? 'active' : ''}
            onClick={() => (inlineAuth?.open ? inlineAuth?.onClose?.() : inlineAuth?.onOpen?.())}
          >
            {inlineAuth?.open ? '닫기' : '로그인'}
          </button>
        </div>
      ) : (
        <div>
          <button type="button" onClick={() => navigate('/mypage')}>내 정보</button>
        </div>
      )}
      {accountError ? <p>{accountError}</p> : null}
      {!isMemberSession && inlineAuth?.open ? (
        <form className="appHomeInlineAuth" onSubmit={inlineAuth.onSubmit}>
          <header>
            <span>
              <MemoNavIcon type="user" />
              <strong>{isSignup ? '계정 만들기' : '로그인'}</strong>
            </span>
            <button type="button" onClick={() => inlineAuth.onModeChange?.(isSignup ? 'login' : 'signup')}>
              {isSignup ? '로그인으로' : '회원가입'}
            </button>
          </header>
          <label>
            <span>아이디</span>
            <input
              value={inlineAuth.username}
              onChange={(event) => inlineAuth.onUsernameChange?.(event.target.value)}
              placeholder="my-id"
              autoComplete="username"
            />
          </label>
          <label>
            <span>비밀번호</span>
            <input
              type="password"
              value={inlineAuth.password}
              onChange={(event) => inlineAuth.onPasswordChange?.(event.target.value)}
              placeholder="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </label>
          {isSignup ? <small>8자 이상, 영문·숫자·특수문자를 모두 포함하세요.</small> : null}
          <button type="submit" disabled={inlineAuth.loading}>
            {inlineAuth.loading ? '처리 중...' : isSignup ? '계정 만들기' : '로그인'}
          </button>
          {inlineAuth.error ? <p>{inlineAuth.error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
