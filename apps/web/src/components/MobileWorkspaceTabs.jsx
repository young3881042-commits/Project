import MemoNavIcon from './MemoNavIcon.jsx';

export default function MobileWorkspaceTabs({ active = 'notes', navigate, onNotes }) {
  const openNotes = () => {
    onNotes?.();
    navigate('/notes');
  };

  return (
    <nav className="notesMobileActionBar" aria-label="모바일 하단 탭">
      <button
        type="button"
        className={`notesMobileTabButton ${active === 'home' ? 'active' : ''}`}
        onClick={() => navigate('/app')}
      >
        <MemoNavIcon type="home" />
        <span>홈</span>
      </button>
      <button
        type="button"
        className={`notesMobileTabButton ${active === 'notes' ? 'active' : ''}`}
        onClick={openNotes}
      >
        <MemoNavIcon type="board" />
        <span>노트</span>
      </button>
      <button
        type="button"
        className={`notesMobileTabButton ${active === 'schedule' ? 'active' : ''}`}
        onClick={() => navigate('/scheduler')}
      >
        <MemoNavIcon type="calendar" />
        <span>일정</span>
      </button>
    </nav>
  );
}
