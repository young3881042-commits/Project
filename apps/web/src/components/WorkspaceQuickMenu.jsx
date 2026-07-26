import MemoNavIcon from './MemoNavIcon.jsx';

const WORKSPACE_QUICK_LINKS = [
  { key: 'home', label: '홈', path: '/app', icon: 'home' },
  { key: 'notes', label: '메모', path: '/notes', icon: 'board' },
  { key: 'schedule', label: '일정', path: '/scheduler', icon: 'calendar' }
];

export default function WorkspaceQuickMenu({ active = 'home', navigate, className = '', ariaLabel = '바로가기' }) {
  return (
    <nav className={`workspaceQuickMenu ${className}`.trim()} aria-label={ariaLabel}>
      {WORKSPACE_QUICK_LINKS.map((item) => (
        <button
          type="button"
          key={item.key}
          className={active === item.key ? 'active' : ''}
          onClick={() => navigate(item.path)}
        >
          <MemoNavIcon type={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
