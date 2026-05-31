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
    title: '오늘의 일정 달성률',
    emptyTitle: '오늘 일정이 비어 있어요',
    emptyMeta: '일정이나 메모에서 오늘 할 일을 추가하세요',
    action: '오늘 일정 열기',
    listAction: '일정 보기'
  },
  travel: {
    title: '선택한 여행 계획',
    emptyTitle: '여행 계획이 비어 있어요',
    emptyMeta: '코스 만들기에서 여행 계획을 시작하세요',
    action: '코스 만들기',
    listAction: '계획 보기'
  },
  work: {
    title: '업무 계획',
    emptyTitle: '업무 일정이 비어 있어요',
    emptyMeta: '업무 일정과 할 일을 추가하세요',
    action: '업무 일정 열기',
    listAction: '일정 보기'
  },
  study: {
    title: '공부 계획',
    emptyTitle: '공부 일정이 비어 있어요',
    emptyMeta: '학습 목표와 복습 일정을 추가하세요',
    action: '공부 일정 열기',
    listAction: '일정 보기'
  },
  fitness: {
    title: '운동 루틴',
    emptyTitle: '운동 일정이 비어 있어요',
    emptyMeta: '운동 루틴과 체크리스트를 추가하세요',
    action: '운동 일정 열기',
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
  isMemberSession,
  navigate,
  onStartGuest,
  session
}) {
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
          <button type="button" onClick={() => navigate('/login?redirect=/app')}>
            로그인
          </button>
        </div>
      ) : (
        <div>
          <button type="button" onClick={() => navigate('/mypage')}>내 정보</button>
        </div>
      )}
      {accountError ? <p>{accountError}</p> : null}
    </section>
  );
}

export function TodaySchedulePanel({ appOverview, navigate, planMode = 'general' }) {
  const travelPlanPreview = appOverview.travelPlanPreview;
  const isTravelMode = planMode === 'travel';
  const hasTravelPlan = isTravelMode && Boolean(travelPlanPreview?.items?.length);
  const copy = MODE_PANEL_COPY[planMode] || MODE_PANEL_COPY.general;
  const modeStats = appOverview.modeStats?.[planMode] || appOverview.modeStats?.general || {};
  const rows = hasTravelPlan
    ? travelPlaceRows(travelPlanPreview)
    : planMode === 'general'
      ? routeRows(appOverview)
      : schedulerRowsForMode(appOverview, planMode);
  const progress = safeProgress(hasTravelPlan ? travelPlanPreview.progress : modeStats.progress || appOverview.todayProgress);
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
  const progressLabel = hasTravelPlan ? '코스 준비 진행률' : copy.title;
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
          <p>
            <em>{hasTravelPlan ? travelPlanPreview.dDayLabel : `${progress}%`}</em>
            <span>{summaryMeta}</span>
          </p>
          <div className="appHomeTripProgress" aria-label={`${progressLabel} ${progress}%`}>
            <i style={{ width: `${progress}%` }} />
            <b>{progress}%</b>
          </div>
        </div>
        <button type="button" className="appHomeTripContinue" onClick={() => navigate(actionPath)}>
          {hasTravelPlan ? '계획 메모 열기' : copy.action}
          <MemoNavIcon type="chevronRight" />
        </button>
      </div>

      <div className="appHomeScheduleList">
        {rows.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className={`appHomeScheduleRow ${hasTravelPlan ? 'place' : SCHEDULE_ACCENTS[index % SCHEDULE_ACCENTS.length]}${item.done ? ' done' : ''}${item.empty ? ' empty' : ''}`}
            onClick={() => navigate(hasTravelPlan ? actionPath : isTravelMode ? '/planner' : '/scheduler')}
          >
            <time>{hasTravelPlan ? item.order : item.time}</time>
            <strong>{item.title}</strong>
            <span>{item.tag}</span>
            {hasTravelPlan && item.meta ? <small>{item.meta}</small> : null}
            <MemoNavIcon type="chevronRight" />
          </button>
        ))}
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
  const aiCopy = isTravelMode
    ? {
      title: '여행 계획 정리를 도와드려요',
      body: '장소 후보와 체크리스트를 코스 흐름에 맞춰 정리할 수 있어요.',
      action: '코스 만들기',
      path: '/planner'
    }
    : {
      title: '오늘의 메모와 일정을 정리해요',
      body: '흩어진 메모, 일정, 할 일을 한 번에 보기 쉽게 정리할 수 있어요.',
      action: 'AI 정리 열기',
      path: '/notes'
    };

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
            <span>{item.summary}</span>
            <small>{item.label || (item.updatedAt ? item.updatedAt.slice(5, 10) : '지금')}</small>
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
  const panelLabel = isTravelMode ? '여행 준비 현황' : '워크스페이스 현황';
  const items = isTravelMode
    ? [
      { label: '여행 계획', value: `${appOverview.planTypeCounts?.travel || 0}개`, progress: appOverview.travelPlanPreview ? 100 : 0, path: '/plans' },
      { label: '체크리스트', value: `${checklistDone}/${checklistTotal}`, progress: checklistTotal ? Math.round((checklistDone / checklistTotal) * 100) : 0, path: appOverview.travelPlanPreview?.notePath || '/notes' },
      { label: '메모', value: `${modeMemoCount}개`, progress: modeMemoCount ? 65 : 0, path: '/notes' },
      { label: '일정', value: `${appOverview.travelScheduleCount || 0}개`, progress: modeStats.progress || 0, path: '/scheduler' }
    ]
    : [
      { label: '오늘 일정', value: `${appOverview.todayDoneCount || 0}/${appOverview.todayCount || 0}`, progress: appOverview.todayProgress || 0, path: '/scheduler' },
      { label: '이번 주 할 일', value: `${appOverview.weekDoneCount || 0}/${appOverview.weekCount || 0}`, progress: appOverview.weekProgress || 0, path: '/scheduler' },
      { label: '최근 메모', value: `${modeMemoCount}개`, progress: modeMemoCount ? 65 : 0, path: '/notes' },
      { label: MODE_PANEL_COPY[planMode]?.title || '계획', value: `${modeStats.done || 0}/${modeStats.total || 0}`, progress: modeStats.progress || 0, path: '/scheduler' }
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
            <i><b style={{ width: `${safeProgress(item.progress)}%` }} /></i>
          </button>
        ))}
      </div>
    </section>
  );
}
