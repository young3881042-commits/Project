import MemoNavIcon from './MemoNavIcon.jsx';
import MobileWorkspaceTabs from './MobileWorkspaceTabs.jsx';

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
          <strong>{title}</strong>
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
