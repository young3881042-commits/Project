import MemoNavIcon from '../MemoNavIcon.jsx';

const SCHEDULE_ACCENTS = ['blue', 'green', 'violet'];
const PLAN_MODE_OPTIONS = [
  { id: 'general', label: '개인', title: '개인 워크스페이스', icon: 'spark' },
  { id: 'travel', label: '여행', title: '여행 계획', icon: 'trip' },
  { id: 'work', label: '업무', title: '업무 계획', icon: 'board' },
  { id: 'study', label: '공부', title: '공부 계획', icon: 'file' },
  { id: 'fitness', label: '운동', title: '운동 루틴', icon: 'trophy' }
];

const MODE_PANEL_COPY = {
  general: {
    title: '오늘의 핵심',
    emptyTitle: '오늘 일정이 비어 있어요',
    emptyMeta: '지금 일정부터 추가해보세요.',
    action: '오늘 일정 추가',
    listAction: '일정 보기'
  },
  travel: {
    title: '오늘의 핵심',
    emptyTitle: '여행 계획이 비어 있어요',
    emptyMeta: '코스 만들기에서 여행 계획을 시작해보세요.',
    action: '코스 만들기',
    listAction: '계획 보기'
  },
  work: {
    title: '오늘의 핵심',
    emptyTitle: '업무 일정이 비어 있어요',
    emptyMeta: '업무 일정과 할 일을 추가해보세요.',
    action: '업무 일정 추가',
    listAction: '일정 보기'
  },
  study: {
    title: '오늘의 핵심',
    emptyTitle: '공부 일정이 비어 있어요',
    emptyMeta: '학습 목표와 복습 일정을 추가해보세요.',
    action: '공부 일정 추가',
    listAction: '일정 보기'
  },
  fitness: {
    title: '오늘의 핵심',
    emptyTitle: '운동 일정이 비어 있어요',
    emptyMeta: '운동 루틴과 체크리스트를 추가해보세요.',
    action: '운동 일정 추가',
    listAction: '일정 보기'
  }
};

const QUICK_ACTIONS = {
  general: [
    { title: '메모 작성', detail: '생각을 기록해요', icon: 'edit', className: 'memo', path: '/notes' },
    { title: '일정 추가', detail: '오늘 흐름을 잡아요', icon: 'calendar', className: 'schedule', path: '/scheduler' },
    { title: '할 일 추가', detail: '체크할 일을 모아요', icon: 'checkSquare', className: 'todo', path: '/scheduler' },
    { title: 'AI 정리', detail: '메모를 정돈해요', icon: 'spark', className: 'ai', path: '/notes' }
  ],
  travel: [
    { title: '여행 메모', detail: '준비물을 기록해요', icon: 'board', className: 'memo', path: '/notes' },
    { title: '코스 만들기', detail: '동선을 계획해요', icon: 'trip', className: 'trip', path: '/planner' },
    { title: '장소 찾기', detail: '후보를 검색해요', icon: 'search', className: 'search', path: '/destinations' },
    { title: '체크리스트', detail: '준비를 확인해요', icon: 'checkSquare', className: 'todo', path: '/notes' }
  ],
  work: [
    { title: '업무 메모', detail: '회의와 이슈 기록', icon: 'board', className: 'memo', path: '/notes' },
    { title: '업무 일정', detail: '마감일을 관리해요', icon: 'calendar', className: 'schedule', path: '/scheduler' },
    { title: '할 일 추가', detail: '작업을 쪼개요', icon: 'checkSquare', className: 'todo', path: '/scheduler' },
    { title: 'AI 정리', detail: '업무 메모 요약', icon: 'spark', className: 'ai', path: '/notes' }
  ],
  study: [
    { title: '학습 메모', detail: '개념을 기록해요', icon: 'file', className: 'memo', path: '/notes' },
    { title: '공부 일정', detail: '복습 시간을 잡아요', icon: 'calendar', className: 'schedule', path: '/scheduler' },
    { title: '과제 추가', detail: '해야 할 일을 모아요', icon: 'checkSquare', className: 'todo', path: '/scheduler' },
    { title: 'AI 정리', detail: '노트를 정리해요', icon: 'spark', className: 'ai', path: '/notes' }
  ],
  fitness: [
    { title: '운동 기록', detail: '루틴을 남겨요', icon: 'trophy', className: 'memo', path: '/notes' },
    { title: '운동 일정', detail: '운동 시간을 잡아요', icon: 'calendar', className: 'schedule', path: '/scheduler' },
    { title: '체크리스트', detail: '루틴을 확인해요', icon: 'checkSquare', className: 'todo', path: '/scheduler' },
    { title: 'AI 정리', detail: '기록을 요약해요', icon: 'spark', className: 'ai', path: '/notes' }
  ]
};

const MODE_AI_COPY = {
  general: {
    title: '오늘 메모를 일정으로 정리할까요?',
    body: '흩어진 메모, 일정, 할 일을 한 번에 보기 쉽게 정리할 수 있어요.',
    action: 'AI 정리 열기',
    path: '/notes'
  },
  travel: {
    title: '여행 메모를 코스로 정리할까요?',
    body: '장소 후보, 체크리스트, 이동 메모를 여행 흐름에 맞게 정리할 수 있어요.',
    action: '코스 만들기',
    path: '/planner'
  },
  work: {
    title: '업무 메모를 실행 일정으로 정리할까요?',
    body: '회의 메모와 할 일을 마감 일정 중심으로 보기 쉽게 묶을 수 있어요.',
    action: 'AI 정리 열기',
    path: '/notes'
  },
  study: {
    title: '학습 메모를 복습 일정으로 정리할까요?',
    body: '강의 노트, 과제, 복습할 내용을 공부 흐름에 맞게 정리할 수 있어요.',
    action: 'AI 정리 열기',
    path: '/notes'
  },
  fitness: {
    title: '운동 기록을 루틴으로 정리할까요?',
    body: '운동 메모와 체크리스트를 다음 루틴에 맞게 보기 쉽게 정리할 수 있어요.',
    action: 'AI 정리 열기',
    path: '/notes'
  }
};

function scheduleTimeLabel(time) {
  return time || '종일';
}

function routeRows(appOverview) {
  const items = appOverview.todayPreviewItems || [];
  if (items.length) {
    return items.map((item, index) => ({
      id: item.id || `${item.title}-${index}`,
      time: scheduleTimeLabel(item.time),
      title: item.title || '일정',
      tag: item.type || '일정',
      done: Boolean(item.done)
    }));
  }
  return [
    { id: 'empty-today', time: '오늘', title: '오늘 일정 추가하기', tag: '일정', empty: true }
  ];
}

function safeProgress(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function travelPlaceRows(travelPlanPreview) {
  return (travelPlanPreview?.items || []).map((item, index) => ({
    id: item.id || `${item.title}-${index}`,
    order: item.order || index + 1,
    title: item.title || '여행지',
    tag: item.tag || '여행지',
    meta: item.meta || item.time || '',
    done: Boolean(item.done)
  }));
}

function homeCoreChips(appOverview, mode, hasTravelPlan = false) {
  const modeStats = appOverview.modeStats?.[mode] || {};
  const modeMemoCount = appOverview.memoCountsByMode?.[mode] || 0;
  if (mode === 'travel' && hasTravelPlan) {
    return [
      { icon: 'trip', label: '코스', value: appOverview.travelPlanPreview?.totalCount || 0 },
      { icon: 'checkSquare', label: '완료', value: appOverview.travelPlanPreview?.doneCount || 0 },
      { icon: 'board', label: '메모', value: modeMemoCount }
    ];
  }
  if (mode === 'general') {
    return [
      { icon: 'calendar', label: '일정', value: appOverview.todayCount || 0 },
      { icon: 'checkSquare', label: '할 일', value: appOverview.weekPendingCount || 0 },
      { icon: 'board', label: '메모', value: modeMemoCount }
    ];
  }
  return [
    { icon: 'calendar', label: '일정', value: modeStats.total || 0 },
    { icon: 'checkSquare', label: '할 일', value: Math.max(0, (modeStats.total || 0) - (modeStats.done || 0)) },
    { icon: 'board', label: '메모', value: modeMemoCount }
  ];
}

function schedulerRowsForMode(appOverview, mode) {
  const items = appOverview.modePreviewItems?.[mode] || [];
  if (!items.length) {
    const copy = MODE_PANEL_COPY[mode] || MODE_PANEL_COPY.general;
    return [{ id: `${mode}-empty`, time: mode === 'general' ? '오늘' : '계획', title: copy.emptyTitle, tag: copy.listAction, empty: true }];
  }
  return items.map((item, index) => ({
    id: item.id || `${item.title}-${index}`,
    time: item.date && mode !== 'general' ? item.date.slice(5).replace('-', '.') : scheduleTimeLabel(item.time),
    title: item.title || '일정',
    tag: item.type || '일정',
    done: Boolean(item.done)
  }));
}

export function HomeModeSelector({ activeMode = 'general', counts = {}, onSelect }) {
  return (
    <section className="appHomeModeSelector" aria-label="홈 모드 선택">
      {PLAN_MODE_OPTIONS.map((mode) => (
        <button
          type="button"
          key={mode.id}
          className={activeMode === mode.id ? 'active' : ''}
          onClick={() => onSelect?.(mode.id)}
        >
          <MemoNavIcon type={mode.icon} />
          <span>{mode.label}</span>
          <strong>{Number(counts?.[mode.id] || 0)}</strong>
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
        <MemoNavIcon type="spark" />
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
              <MemoNavIcon type="spark" />
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

export function TodaySchedulePanel({ appOverview, navigate, planMode = 'general' }) {
  const travelPlanPreview = appOverview.travelPlanPreview;
  const isTravelMode = planMode === 'travel';
  const hasTravelPlan = isTravelMode && Boolean(travelPlanPreview?.items?.length);
  const copy = MODE_PANEL_COPY[planMode] || MODE_PANEL_COPY.general;
  const modeStats = appOverview.modeStats?.[planMode] || appOverview.modeStats?.general || {};
  const chips = homeCoreChips(appOverview, planMode, hasTravelPlan);
  const todayPendingCount = Math.max(0, (appOverview.todayCount || 0) - (appOverview.todayDoneCount || 0));
  const pendingCount = Math.max(0, (modeStats.total || 0) - (modeStats.done || 0));
  const panelTitle = hasTravelPlan ? '선택한 여행 계획' : copy.title;
  const summaryTitle = hasTravelPlan
    ? travelPlanPreview.title
    : planMode === 'general' && appOverview.todayCount
      ? `오늘 일정 ${appOverview.todayCount}개`
      : modeStats.total
        ? `${copy.title} ${modeStats.total}개`
        : copy.emptyTitle;
  const summaryMeta = hasTravelPlan
    ? travelPlanPreview.subtitle
    : planMode === 'general' && appOverview.todayCount
      ? `완료 ${appOverview.todayDoneCount || 0}개 · 남은 ${todayPendingCount}개`
      : modeStats.total
        ? `완료 ${modeStats.done || 0}개 · 남은 ${pendingCount}개`
        : copy.emptyMeta;
  const actionPath = hasTravelPlan ? travelPlanPreview.notePath || '/plans' : isTravelMode ? '/planner' : '/scheduler';
  const listPath = isTravelMode ? '/plans' : '/scheduler';

  return (
    <section className="appHomePanel appHomeTodayPanel" aria-label="홈 요약">
      <header className="appHomePanelHeader">
        <span>
          <MemoNavIcon type="calendar" />
          <strong>{panelTitle}</strong>
        </span>
        <button type="button" onClick={() => navigate(listPath)}>
          {hasTravelPlan ? '전체 보기' : copy.listAction}
        </button>
      </header>

      <div className="appHomeTripSummary">
        <span className={`appHomeTripPhoto ${planMode}${hasTravelPlan ? ' plan' : ' today'}`} aria-hidden="true" />
        <div className="appHomeTripCopy">
          <strong>{summaryTitle}</strong>
          <p>{summaryMeta}</p>
          <div className="appHomeCoreChips" aria-label="핵심 통계">
            {chips.map((chip) => (
              <span key={chip.label}>
                <MemoNavIcon type={chip.icon} />
                <em>{chip.label}</em>
                <b>{chip.value}</b>
              </span>
            ))}
          </div>
        </div>
        <button type="button" className="appHomeTripContinue" onClick={() => navigate(actionPath)}>
          {hasTravelPlan ? '계획 메모 열기' : copy.action}
          <MemoNavIcon type="chevronRight" />
        </button>
      </div>
    </section>
  );
}

export function HomeFeatureCards({ appOverview, navigate, planMode = 'general' }) {
  const actions = QUICK_ACTIONS[planMode] || QUICK_ACTIONS.general;
  const travelNotePath = appOverview.travelPlanPreview?.notePath || '/notes';

  return (
    <section className="appHomeQuickSection" aria-label="빠른 실행">
      <h2>빠른 실행</h2>
      <div className="appHomeFeatureGrid">
        {actions.map((action) => {
          const targetPath = planMode === 'travel' && (action.title === '체크리스트' || action.title === '여행 메모')
            ? travelNotePath
            : action.path;
          return (
            <button
              type="button"
              key={action.title}
              className={`appHomeFeatureCard ${action.className}`}
              onClick={() => navigate(targetPath)}
            >
              <span className="appHomeFeatureTitle">
                <MemoNavIcon type={action.icon} />
                <strong>{action.title}</strong>
              </span>
              <p>{action.detail}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function TravelInsightGrid({ appOverview, navigate, planMode = 'general' }) {
  const isTravelMode = planMode === 'travel';
  const recentItems = appOverview.recentMemoItems?.[planMode] || [];
  const memoTitle = isTravelMode ? '여행 메모' : '최근 메모';
  const memoRows = recentItems.length ? recentItems : [
    { id: 'memo-empty-1', title: '첫 메모를 작성하세요', summary: '생각, 일정, 할 일을 메모로 시작할 수 있어요.', path: '/notes' },
    { id: 'memo-empty-2', title: '일정과 연결하기', summary: '메모에 날짜를 붙이면 일정으로 이어집니다.', path: '/notes' }
  ];
  const aiCopy = MODE_AI_COPY[planMode] || MODE_AI_COPY.general;

  return (
    <section className="appHomeInsightGrid" aria-label="메모와 AI 정리">
      <article className="appHomeMemoPanel">
        <header>
          <span><MemoNavIcon type="board" />{memoTitle}</span>
          <button type="button" onClick={() => navigate('/notes')}>더보기</button>
        </header>
        {memoRows.slice(0, 2).map((item) => (
          <button type="button" key={item.id} className="appHomeMemoRow" onClick={() => navigate(item.path || '/notes')}>
            <strong>{item.title}</strong>
            <span>{`${item.updatedAt ? item.updatedAt.slice(0, 10).replace(/-/g, '.') : '방금 전'} · ${item.label || '개인'}`}</span>
          </button>
        ))}
        <button type="button" className="appHomeMemoCreate" onClick={() => navigate('/notes')}>
          <MemoNavIcon type="plus" />
          새 메모 작성
        </button>
      </article>

      <article className="appHomeAiPanel">
        <header>
          <span><MemoNavIcon type="spark" />AI 정리</span>
          <small>NEW</small>
        </header>
        <strong>{aiCopy.title}</strong>
        <p>{aiCopy.body}</p>
        <button type="button" onClick={() => navigate(aiCopy.path)}>
          {aiCopy.action}
        </button>
        <span className="appHomeAiMap" aria-hidden="true">
          <i />
          <b />
        </span>
      </article>
    </section>
  );
}

export function TravelPrepPanel({ appOverview, navigate, planMode = 'general' }) {
  const checklistTotal = appOverview.checklistTotal || 12;
  const checklistDone = Math.min(checklistTotal, appOverview.checklistDone || 0);
  const modeStats = appOverview.modeStats?.[planMode] || {};
  const modeMemoCount = appOverview.memoCountsByMode?.[planMode] || 0;
  const isTravelMode = planMode === 'travel';
  const modeLabel = PLAN_MODE_OPTIONS.find((option) => option.id === planMode)?.label || '개인';
  const todayDoneCount = appOverview.todayDoneCount || 0;
  const todayCount = appOverview.todayCount || 0;
  const weekCount = appOverview.weekCount || 0;
  const weekPendingCount = appOverview.weekPendingCount ?? Math.max(0, weekCount - (appOverview.weekDoneCount || 0));
  const modePendingCount = Math.max(0, (modeStats.total || 0) - (modeStats.done || 0));
  const panelLabel = isTravelMode ? '여행 준비 현황' : '워크스페이스 현황';
  const items = isTravelMode
    ? [
      { label: '여행 계획', value: `${appOverview.planTypeCounts?.travel || 0}개`, progress: appOverview.travelPlanPreview ? 100 : 0, path: '/plans' },
      { label: '체크리스트', value: `${checklistDone}/${checklistTotal}`, progress: checklistTotal ? Math.round((checklistDone / checklistTotal) * 100) : 0, path: appOverview.travelPlanPreview?.notePath || '/notes' },
      { label: '메모', value: `${modeMemoCount}개`, progress: modeMemoCount ? 65 : 0, path: '/notes' },
      { label: '일정', value: `${appOverview.travelScheduleCount || 0}개`, progress: modeStats.progress || 0, path: '/scheduler' }
    ]
    : planMode === 'general'
      ? [
        { label: '오늘 일정', value: `${todayDoneCount}/${todayCount}`, path: '/scheduler' },
        { label: '미완료 할 일', value: `${weekPendingCount}/${weekCount}`, path: '/scheduler' },
        { label: '최근 메모', value: `${modeMemoCount}개`, path: '/notes' },
        { label: 'AI 추천', value: '1개', path: '/notes' }
      ]
    : [
      { label: `${modeLabel} 일정`, value: `${modeStats.done || 0}/${modeStats.total || 0}`, path: '/scheduler' },
      { label: '미완료 할 일', value: `${modePendingCount}/${modeStats.total || 0}`, path: '/scheduler' },
      { label: '최근 메모', value: `${modeMemoCount}개`, path: '/notes' },
      { label: 'AI 추천', value: '1개', path: '/notes' }
    ];

  return (
    <section className="appHomePrepPanel" aria-label={panelLabel}>
      <header>
        <span><MemoNavIcon type={isTravelMode ? 'trip' : 'chart'} />{panelLabel}</span>
        <button type="button" onClick={() => navigate('/scheduler')}>전체 {items.length}개 항목</button>
      </header>
      <div className="appHomePrepGrid">
        {items.map((item) => (
          <button type="button" key={item.label} onClick={() => navigate(item.path)}>
            <strong>{item.label}</strong>
            <span>{item.value}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
