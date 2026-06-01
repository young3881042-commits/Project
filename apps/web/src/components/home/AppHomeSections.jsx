import MemoNavIcon from '../MemoNavIcon.jsx';

const WORKSPACE_OPTIONS = [
  { id: 'personal', label: '개인', icon: 'user' },
  { id: 'travel', label: '여행', icon: 'trip' }
];

const FALLBACK_WORKSPACE_DATA = {
  personal: {
    memoCount: 2,
    scheduleCount: 0,
    todoCount: 0,
    planCount: 0,
    recentMemos: [
      { id: 'personal-fallback-memo-1', title: '장보기 메모', updatedAt: '2026-05-30', label: '개인', path: '/notes' },
      { id: 'personal-fallback-memo-2', title: '주말 계획', updatedAt: '2026-05-29', label: '개인', path: '/notes' }
    ],
    scheduleRows: [],
    todoRows: []
  },
  travel: {
    memoCount: 1,
    scheduleCount: 1,
    todoCount: 2,
    planCount: 1,
    recentMemos: [
      { id: 'travel-fallback-memo-1', title: '경주 여행 준비', updatedAt: '2026-05-30', label: '여행', path: '/notes' },
      { id: 'travel-fallback-memo-2', title: '주말 코스 후보', updatedAt: '2026-05-29', label: '여행', path: '/notes' }
    ],
    scheduleRows: [
      { id: 'travel-fallback-schedule-1', time: '10:00', title: '숙소 체크인 확인' }
    ],
    todoRows: [
      { id: 'travel-fallback-todo-1', title: '동선 후보 정리' },
      { id: 'travel-fallback-todo-2', title: '식당 리스트 확인' }
    ]
  }
};

const QUICK_ACTIONS_BY_MODE = {
  personal: [
    { title: '메모 작성', icon: 'edit', path: '/notes' },
    { title: '일정 추가', icon: 'calendar', path: '/scheduler' },
    { title: '할 일 추가', icon: 'checkSquare', path: '/scheduler' },
    { title: 'AI 정리', icon: 'spark', path: '/notes' }
  ],
  travel: [
    { title: '여행 메모', icon: 'edit', path: '/notes' },
    { title: '코스 만들기', icon: 'trip', path: '/planner' },
    { title: '장소 찾기', icon: 'search', path: '/destinations' },
    { title: '일정 보기', icon: 'calendar', path: '/scheduler' }
  ]
};

function normalizeWorkspaceMode(mode) {
  return mode === 'travel' ? 'travel' : 'personal';
}

function workspaceLabel(mode) {
  return normalizeWorkspaceMode(mode) === 'travel' ? '여행' : '개인';
}

function formatMemoDate(value, fallback = '2026.05.30') {
  const raw = `${value || ''}`.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw.replace(/-/g, '.') : fallback;
}

function previewScheduleRows(items = []) {
  return items.slice(0, 2).map((item, index) => ({
    id: item.id || `${item.title || 'schedule'}-${index}`,
    time: item.time || (item.date ? item.date.slice(5).replace('-', '.') : '오늘'),
    title: item.title || '일정'
  }));
}

function previewTodoRows(items = []) {
  return items
    .filter((item) => !item.done)
    .slice(0, 2)
    .map((item, index) => ({
      id: item.id || `${item.title || 'todo'}-${index}`,
      title: item.title || '할 일'
    }));
}

function formatScheduleTime(value) {
  return value || '시간 미정';
}

function scheduleSecondaryText(item) {
  return item.memo || item.location || item.type || '';
}

function scheduleProgressText(doneCount, totalCount, fallbackLabel) {
  return totalCount ? `${doneCount}/${totalCount} 완료` : fallbackLabel;
}

function ScheduleCheckRow({ item, onToggle, weekly = false }) {
  const secondary = scheduleSecondaryText(item);
  const timeLabel = weekly
    ? [item.weekday, formatScheduleTime(item.time)].filter(Boolean).join(' · ')
    : formatScheduleTime(item.time);

  return (
    <label className={`appHomeScheduleRow ${item.done ? 'done' : ''}`}>
      <input
        type="checkbox"
        checked={Boolean(item.done)}
        onChange={(event) => onToggle?.(item, event.target.checked)}
      />
      <span className="appHomeScheduleRowBody">
        <span>
          <time>{timeLabel}</time>
          <strong>{item.title || '제목 없는 일정'}</strong>
        </span>
        {secondary ? <small>{secondary}</small> : null}
      </span>
    </label>
  );
}

function EmptyScheduleState({ title, description, action, onAction }) {
  return (
    <div className="appHomeScheduleEmpty">
      <strong>{title}</strong>
      <p>{description}</p>
      <button type="button" onClick={onAction}>{action}</button>
    </div>
  );
}

function buildWorkspaceHomeData(appOverview, mode) {
  const workspace = normalizeWorkspaceMode(mode);
  const fallback = FALLBACK_WORKSPACE_DATA[workspace];
  const modeStats = appOverview.modeStats?.[workspace] || {};
  const memoCount = Number(appOverview.memoCountsByMode?.[workspace] || 0);
  const scheduleCount = Number(modeStats.total || 0);
  const todoCount = Math.max(0, scheduleCount - Number(modeStats.done || 0));
  const planCount = workspace === 'travel' ? Number(appOverview.travelPlanCount || 0) : 0;
  const recentMemos = appOverview.recentMemoItems?.[workspace] || [];
  const previewItems = appOverview.modePreviewItems?.[workspace] || [];
  const seededRecentOnly = Boolean(recentMemos.length) && recentMemos.every((item) => `${item.id || ''}`.startsWith('seed-'));
  const hasRealWorkspaceData = Boolean(scheduleCount || planCount || previewItems.length || (memoCount && !seededRecentOnly));

  if (!hasRealWorkspaceData) {
    return {
      ...fallback,
      workspace,
      label: workspaceLabel(workspace)
    };
  }

  const scheduleRows = previewScheduleRows(previewItems);
  const todoRows = previewTodoRows(previewItems);
  return {
    workspace,
    label: workspaceLabel(workspace),
    memoCount,
    scheduleCount,
    todoCount,
    planCount,
    recentMemos: recentMemos.length ? recentMemos.slice(0, 2) : fallback.recentMemos,
    scheduleRows: scheduleRows.length ? scheduleRows : fallback.scheduleRows,
    todoRows: todoRows.length ? todoRows : []
  };
}

export function HomeModeSelector({ activeMode = 'personal', onSelect }) {
  const active = normalizeWorkspaceMode(activeMode);
  return (
    <section className="appHomeModeSelector" aria-label="워크스페이스 선택">
      {WORKSPACE_OPTIONS.map((workspace) => (
        <button
          type="button"
          key={workspace.id}
          className={active === workspace.id ? 'active' : ''}
          onClick={() => onSelect?.(workspace.id)}
        >
          <MemoNavIcon type={workspace.icon} />
          <span>{workspace.label}</span>
        </button>
      ))}
    </section>
  );
}

export function HomeRobotHero({ appOverview, navigate, planMode = 'personal' }) {
  const workspace = normalizeWorkspaceMode(planMode);
  const isTravel = workspace === 'travel';
  const travelPlan = appOverview?.travelPlanPreview;

  return (
    <section className={`appHomeRobotHero ${isTravel ? 'travel' : 'personal'}`} aria-label="AI 로봇 홈">
      <div className="appHomeRobotHeroCopy">
        <span>{isTravel ? 'Travel mode' : 'Today mode'}</span>
        <strong>{isTravel ? '여행 준비, 같이 정리해요' : '오늘 할 일, 같이 정리해요'}</strong>
        <p>{isTravel ? '코스 메모와 일정을 한 화면에서 이어서 봅니다.' : '메모와 일정을 가볍게 모아두세요.'}</p>
        {isTravel ? (
          <div className="appHomeTravelCountdown" aria-label="여행 D-day">
            <strong>{travelPlan?.dDayLabel || 'D-day'}</strong>
            <span>{travelPlan?.title || '여행 일정 준비중'}</span>
          </div>
        ) : null}
        <div>
          <button type="button" onClick={() => navigate(isTravel ? '/planner' : '/notes')}>
            <MemoNavIcon type={isTravel ? 'trip' : 'edit'} />
            {isTravel ? '코스 만들기' : '메모 작성'}
          </button>
          <button type="button" onClick={() => navigate(isTravel ? '/destinations' : '/scheduler')}>
            <MemoNavIcon type={isTravel ? 'search' : 'calendar'} />
            {isTravel ? '장소 찾기' : '일정 추가'}
          </button>
        </div>
      </div>
      <figure className="appHomeRobotImage">
        <img src="/robot-guide.png" alt="" />
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

export function TodayFlowCard({ appOverview = {}, navigate, onScheduleToggle }) {
  const todayItems = appOverview.personalTodayItems || [];
  const weekItems = appOverview.personalWeekItems || [];
  const todayDoneCount = todayItems.filter((item) => item.done).length;
  const weekDoneCount = weekItems.filter((item) => item.done).length;
  const weekGroups = weekItems.reduce((groups, item) => {
    const key = item.date || 'date-none';
    const current = groups.get(key) || {
      key,
      label: [item.weekday, item.dateLabel].filter(Boolean).join(' · ') || '날짜 미정',
      items: []
    };
    current.items.push(item);
    groups.set(key, current);
    return groups;
  }, new Map());

  return (
    <>
    <section className="appHomeCard appHomeFlowCard" aria-label="오늘 일정">
      <header className="appHomeCardHeader">
        <span>
          <MemoNavIcon type="calendar" />
          <strong>오늘 일정</strong>
        </span>
        <button type="button" onClick={() => navigate('/scheduler')}>일정 추가</button>
      </header>
      <p className="appHomeCardLead">오늘 일정과 할 일을 체크하며 관리하세요.</p>
      <div className="appHomeScheduleProgress">
        <span>{scheduleProgressText(todayDoneCount, todayItems.length, '오늘 일정 없음')}</span>
        <small>오늘 일정 달성률 {Number(appOverview.personalTodayProgress || 0)}%</small>
      </div>
      {todayItems.length ? (
        <div className="appHomeScheduleList">
          {todayItems.map((item) => (
            <ScheduleCheckRow key={item.id} item={item} onToggle={onScheduleToggle} />
          ))}
        </div>
      ) : (
        <EmptyScheduleState
          title="오늘 등록된 일정이 없어요."
          description="일정을 추가해 하루를 계획해보세요."
          action="오늘 일정 추가"
          onAction={() => navigate('/scheduler')}
        />
      )}
    </section>

    <section className="appHomeCard appHomeWeekCard" aria-label="금주 일정">
      <header className="appHomeCardHeader">
        <span>
          <MemoNavIcon type="checkSquare" />
          <strong>금주 일정</strong>
        </span>
      </header>
      <div className="appHomeScheduleProgress">
        <span>{scheduleProgressText(weekDoneCount, weekItems.length, '이번 주 일정 없음')}</span>
        <small>금주 일정 달성률 {Number(appOverview.personalWeekProgress || 0)}%</small>
      </div>
      {weekItems.length ? (
        <div className="appHomeWeekList">
          {Array.from(weekGroups.values()).map((group) => (
            <section key={group.key} className="appHomeWeekGroup">
              <h3>{group.label}</h3>
              <div className="appHomeScheduleList">
                {group.items.map((item) => (
                  <ScheduleCheckRow key={item.id} item={item} onToggle={onScheduleToggle} weekly />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyScheduleState
          title="이번 주 등록된 일정이 없어요."
          description="이번 주 해야 할 일을 가볍게 추가해보세요."
          action="일정 추가"
          onAction={() => navigate('/scheduler')}
        />
      )}
    </section>
    </>
  );
}

export function QuickActionCard({ navigate, planMode = 'personal' }) {
  const actions = QUICK_ACTIONS_BY_MODE[normalizeWorkspaceMode(planMode)] || QUICK_ACTIONS_BY_MODE.personal;
  return (
    <section className="appHomeCard appHomeQuickCard" aria-label="빠른 실행">
      <header className="appHomeCardHeader">
        <span>
          <MemoNavIcon type="spark" />
          <strong>빠른 실행</strong>
        </span>
      </header>
      <div className="appHomeActionGrid">
        {actions.map((action) => (
          <button type="button" key={action.title} onClick={() => navigate(action.path)}>
            <MemoNavIcon type={action.icon} />
            <span>{action.title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function RecentMemoCard({ appOverview, navigate, planMode = 'personal' }) {
  const data = buildWorkspaceHomeData(appOverview, planMode);
  return (
    <section className="appHomeCard appHomeRecentCard" aria-label="최근 메모">
      <header className="appHomeCardHeader">
        <span>
          <MemoNavIcon type="board" />
          <strong>최근 메모</strong>
        </span>
        <button type="button" onClick={() => navigate('/notes')}>전체보기</button>
      </header>
      <div className="appHomeMemoList">
        {data.recentMemos.slice(0, 2).map((item, index) => (
          <button type="button" key={item.id || item.title} onClick={() => navigate(item.path || '/notes')}>
            <strong>{item.title}</strong>
            <span>{formatMemoDate(item.updatedAt, index === 0 ? '2026.05.30' : '2026.05.29')} · {item.label || data.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
