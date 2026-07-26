import MemoNavIcon from './MemoNavIcon.jsx';
import MobileWorkspaceTabs from './MobileWorkspaceTabs.jsx';

const DESKTOP_NAV_ITEMS = [
  { key: 'home', label: '홈', path: '/app', icon: 'home' },
  { key: 'notes', label: '메모', path: '/notes', icon: 'board' },
  { key: 'schedule', label: '일정', path: '/scheduler', icon: 'calendar' }
];

function MobileProfileCard({ profile }) {
  if (!profile) return null;
  const name = profile.name || 'Guest';
  const label = profile.label || '로그인';
  const initial = profile.initial || name.slice(0, 1).toUpperCase();

  return (
    <button
      type="button"
      className="mobilePageProfileCard"
      onClick={profile.onClick}
      aria-label={label}
    >
      <span>{initial}</span>
      <strong>{name}</strong>
      <small>{label}</small>
    </button>
  );
}

function DesktopWorkspaceHeader({ activeTab, navigate, profile }) {
  return (
    <header className="desktopWorkspaceHeader">
      <div className="desktopWorkspaceHeaderInner">
        <button type="button" className="desktopWorkspaceBrand" onClick={() => navigate('/app')}>
          <span><MemoNavIcon type="spark" /></span>
          <span>
            <strong>ai-assitant</strong>
            <small>Personal workspace</small>
          </span>
        </button>
        <nav className="desktopWorkspaceNav" aria-label="주요 메뉴">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const active = activeTab === item.key;
            return (
              <button
                type="button"
                key={item.key}
                className={active ? 'active' : ''}
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(item.path)}
              >
                <MemoNavIcon type={item.icon} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <MobileProfileCard profile={profile} />
      </div>
    </header>
  );
}

export function MobilePageHeader({
  icon = 'home',
  title,
  subtitle,
  profile,
  onBack,
  backLabel = '뒤로'
}) {
  return (
    <header className={`mobilePageHeader${onBack ? ' hasBack' : ''}`}>
      <div className="mobilePageHeaderTitle">
        {onBack ? (
          <button type="button" className="mobilePageBackButton" onClick={onBack} aria-label={backLabel}>
            <MemoNavIcon type="chevronLeft" />
          </button>
        ) : null}
        <span className="mobilePageHeaderIcon">
          <MemoNavIcon type={icon} />
        </span>
        <div>
          <h1>{title}</h1>
          {subtitle ? <small>{subtitle}</small> : null}
        </div>
      </div>
      <MobileProfileCard profile={profile} />
    </header>
  );
}

export default function MobilePageShell({
  activeTab,
  children,
  className = '',
  contentClassName = '',
  hideBottomNav = false,
  icon,
  navigate,
  onBack,
  profile,
  title,
  subtitle
}) {
  return (
    <main className={['mobilePageShell', hideBottomNav ? 'mobilePageShellNoNav' : '', className].filter(Boolean).join(' ')}>
      <DesktopWorkspaceHeader activeTab={activeTab} navigate={navigate} profile={profile} />
      <MobilePageHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        profile={profile}
        onBack={onBack}
      />
      <div className={['mobilePageContent', contentClassName].filter(Boolean).join(' ')}>
        {children}
      </div>
      {!hideBottomNav && activeTab ? <MobileWorkspaceTabs active={activeTab} navigate={navigate} /> : null}
    </main>
  );
}
