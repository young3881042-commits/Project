import MemoNavIcon from './MemoNavIcon.jsx';

export default function MobileWorkspaceTabs({ active = 'notes', navigate, onNotes }) {
  const openNotes = () => {
    onNotes?.();
    navigate('/notes');
  };

  return (
    <nav className="mobileWorkspaceTabs" aria-label="모바일 하단 탭">
      <button
        type="button"
        className={`mobileWorkspaceTabButton ${active === 'home' ? 'active' : ''}`}
        onClick={() => navigate('/app')}
      >
        <MemoNavIcon type="home" />
        <span>홈</span>
      </button>
      <button
        type="button"
        className={`mobileWorkspaceTabButton ${active === 'notes' ? 'active' : ''}`}
        onClick={openNotes}
      >
        <MemoNavIcon type="board" />
        <span>노트</span>
      </button>
      <button
        type="button"
        className={`mobileWorkspaceTabButton ${active === 'schedule' ? 'active' : ''}`}
        onClick={() => navigate('/scheduler')}
      >
        <MemoNavIcon type="calendar" />
        <span>일정</span>
      </button>
      <button
        type="button"
        className={`mobileWorkspaceTabButton ${active === 'trip' ? 'active' : ''}`}
        onClick={() => navigate('/planner')}
      >
        <MemoNavIcon type="trip" />
        <span>여행</span>
      </button>
    </nav>
  );
}
