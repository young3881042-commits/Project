import MemoNavIcon from '../MemoNavIcon.jsx';

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

function buildWorkspaceHomeData(appOverview, mode) {
  const workspace = normalizeWorkspaceMode(mode);
  const fallback = FALLBACK_WORKSPACE_DATA[workspace];
  const modeStats = appOverview?.modeStats?.[workspace] || {};
  const memoCount = Number(appOverview?.memoCountsByMode?.[workspace] || 0);
  const scheduleCount = Number(modeStats.total || 0);
  const planCount = workspace === 'travel' ? Number(appOverview?.travelPlanCount || 0) : 0;
  const previewItems = appOverview?.modePreviewItems?.[workspace] || [];
  const recentMemos = appOverview?.recentMemoItems?.[workspace] || [];
  const seededRecentOnly = Boolean(recentMemos.length) && recentMemos.every((item) => `${item.id || ''}`.startsWith('seed-'));
  const hasRealWorkspaceData = Boolean(scheduleCount || planCount || previewItems.length || (memoCount && !seededRecentOnly));

  if (!hasRealWorkspaceData) {
    return {
      ...fallback,
      workspace,
      label: workspaceLabel(workspace)
    };
  }

  return {
    workspace,
    label: workspaceLabel(workspace),
    recentMemos: recentMemos.length ? recentMemos.slice(0, 2) : fallback.recentMemos
  };
}

export default function HomeRecentMemoCard({ appOverview = {}, navigate, planMode = 'personal' }) {
  const data = buildWorkspaceHomeData(appOverview, planMode);
  return (
    <section className="appHomeCard appHomeRecentCard" aria-label="최근 메모">
      <header className="appHomeCardHeader">
        <span>
          <MemoNavIcon type="file" />
          <strong>최근 메모</strong>
        </span>
        <button type="button" onClick={() => navigate('/notes')}>
          전체보기
          <MemoNavIcon type="chevronRight" />
        </button>
      </header>
      <div className="appHomeMemoList">
        {data.recentMemos.slice(0, 2).map((item, index) => (
          <button type="button" key={item.id || item.title} onClick={() => navigate(item.path || '/notes')}>
            <span>
              <strong>{item.title}</strong>
              <small>{formatMemoDate(item.updatedAt, index === 0 ? '2026.05.30' : '2026.05.29')} · {item.label || data.label}</small>
            </span>
            <MemoNavIcon type="chevronRight" />
          </button>
        ))}
      </div>
    </section>
  );
}
