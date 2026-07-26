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
        aria-current={active === 'home' ? 'page' : undefined}
        onClick={() => navigate('/app')}
      >
        <MemoNavIcon type="home" />
        <span>홈</span>
      </button>
      <button
        type="button"
        className={`mobileWorkspaceTabButton ${active === 'notes' ? 'active' : ''}`}
        aria-current={active === 'notes' ? 'page' : undefined}
        onClick={openNotes}
      >
        <MemoNavIcon type="board" />
        <span>메모</span>
      </button>
      <button
        type="button"
        className={`mobileWorkspaceTabButton ${active === 'schedule' ? 'active' : ''}`}
        aria-current={active === 'schedule' ? 'page' : undefined}
        onClick={() => navigate('/scheduler')}
      >
        <MemoNavIcon type="calendar" />
        <span>일정</span>
      </button>
    </nav>
  );
}
