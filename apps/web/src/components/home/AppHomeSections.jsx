import MemoNavIcon from '../MemoNavIcon.jsx';

const WORKSPACE_OPTIONS = [
  { id: 'personal', label: '개인', icon: 'user' },
  { id: 'work', label: '업무', icon: 'briefcase' }
];

const FALLBACK_WORKSPACE_DATA = {
  personal: {
    memoCount: 2,
    scheduleCount: 0,
    todoCount: 0,
    recentMemos: [
      { id: 'personal-fallback-memo-1', title: '장보기 메모', updatedAt: '2026-05-30', label: '개인', path: '/notes' },
      { id: 'personal-fallback-memo-2', title: '주말 계획', updatedAt: '2026-05-29', label: '개인', path: '/notes' }
    ],
    scheduleRows: [],
    todoRows: []
  },
  work: {
    memoCount: 3,
    scheduleCount: 2,
    todoCount: 4,
    recentMemos: [
      { id: 'work-fallback-memo-1', title: '주간 회의 정리', updatedAt: '2026-05-30', label: '업무', path: '/notes' },
      { id: 'work-fallback-memo-2', title: '고객 요청 사항', updatedAt: '2026-05-29', label: '업무', path: '/notes' }
    ],
    scheduleRows: [
      { id: 'work-fallback-schedule-1', time: '10:00', title: '팀 미팅' },
      { id: 'work-fallback-schedule-2', time: '15:00', title: '배포 점검' }
    ],
    todoRows: [
      { id: 'work-fallback-todo-1', title: '보고서 초안 작성' },
      { id: 'work-fallback-todo-2', title: '이슈 로그 확인' }
    ]
  }
};

const QUICK_ACTIONS = [
  { title: '메모 작성', icon: 'edit', path: '/notes' },
  { title: '일정 추가', icon: 'calendar', path: '/scheduler' },
  { title: '할 일 추가', icon: 'checkSquare', path: '/scheduler' },
  { title: 'AI 정리', icon: 'spark', path: '/notes' }
];

function normalizeWorkspaceMode(mode) {
  return mode === 'work' ? 'work' : 'personal';
}

function workspaceLabel(mode) {
  return normalizeWorkspaceMode(mode) === 'work' ? '업무' : '개인';
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

function buildWorkspaceHomeData(appOverview, mode) {
  const workspace = normalizeWorkspaceMode(mode);
  const fallback = FALLBACK_WORKSPACE_DATA[workspace];
  const modeStats = appOverview.modeStats?.[workspace] || {};
  const memoCount = Number(appOverview.memoCountsByMode?.[workspace] || 0);
  const scheduleCount = Number(modeStats.total || 0);
  const todoCount = Math.max(0, scheduleCount - Number(modeStats.done || 0));
  const recentMemos = appOverview.recentMemoItems?.[workspace] || [];
  const previewItems = appOverview.modePreviewItems?.[workspace] || [];
  const seededRecentOnly = Boolean(recentMemos.length) && recentMemos.every((item) => `${item.id || ''}`.startsWith('seed-'));
  const hasRealWorkspaceData = Boolean(scheduleCount || previewItems.length || (memoCount && !seededRecentOnly));

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

export function TodayFlowCard({ appOverview, navigate, planMode = 'personal' }) {
  const data = buildWorkspaceHomeData(appOverview, planMode);
  const ctaLabel = data.workspace === 'work' ? '업무 메모 작성' : '메모 작성';

  return (
    <section className="appHomeCard appHomeFlowCard" aria-label="오늘의 흐름">
      <header className="appHomeCardHeader">
        <span>
          <MemoNavIcon type="chart" />
          <strong>오늘의 흐름</strong>
        </span>
      </header>
      <p className="appHomeCardLead">메모, 일정, 할 일을 한곳에서 정리해요.</p>
      <div className="appHomeTodayStats" aria-label="한눈에 보는 오늘">
        <span><em>메모</em><strong>{data.memoCount}개</strong></span>
        <span><em>일정</em><strong>{data.scheduleCount}개</strong></span>
        <span><em>할 일</em><strong>{data.todoCount}개</strong></span>
      </div>
      {(data.scheduleRows.length || data.todoRows.length) ? (
        <div className="appHomeFlowPreview" aria-label={`${data.label} 미리보기`}>
          {data.scheduleRows.length ? (
            <div>
              <b>오늘 일정</b>
              {data.scheduleRows.map((item) => (
                <span key={item.id}>{item.time} {item.title}</span>
              ))}
            </div>
          ) : null}
          {data.todoRows.length ? (
            <div>
              <b>할 일</b>
              {data.todoRows.map((item) => (
                <span key={item.id}>{item.title}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <button type="button" className="appHomePrimaryCta" onClick={() => navigate('/notes')}>
        <MemoNavIcon type="edit" />
        {ctaLabel}
      </button>
    </section>
  );
}

export function QuickActionCard({ navigate }) {
  return (
    <section className="appHomeCard appHomeQuickCard" aria-label="빠른 실행">
      <header className="appHomeCardHeader">
        <span>
          <MemoNavIcon type="spark" />
          <strong>빠른 실행</strong>
        </span>
      </header>
      <div className="appHomeActionGrid">
        {QUICK_ACTIONS.map((action) => (
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

export function AiSuggestionCard({ navigate, planMode = 'personal' }) {
  const workspace = normalizeWorkspaceMode(planMode);
  const body = workspace === 'work'
    ? '업무 메모를 일정과 할 일로 정리해 드려요.'
    : '오늘의 메모를 일정과 할 일로 정리해 드려요.';

  return (
    <button type="button" className="appHomeCard appHomeAiSuggestionCard" onClick={() => navigate('/notes')}>
      <header className="appHomeCardHeader">
        <span>
          <MemoNavIcon type="spark" />
          <strong>AI 정리 제안</strong>
        </span>
        <small>NEW</small>
      </header>
      <p>{body}</p>
    </button>
  );
}
