import { Component, useEffect, useState } from 'react';
import LifeHubApp from '../LifeHubApp.jsx';

const DEFAULT_APP_PATH = '/app';
const LIFEHUB_PATHS = new Set([
  '/app',
  '/home',
  '/memo',
  '/schedule',
  '/workout',
  '/diet',
  '/finance',
  '/more',
  '/ai',
  '/ai/edit',
  '/ai/settings'
]);

// These source screens remain in the repository for reference, but the local
// Android/PWA build does not import them or ship their heavy editor assets.
const LEGACY_ROUTE_ROOTS = new Set([
  'analysis', 'analysisadmin', 'apps', 'assistant', 'budget', 'connect', 'connections',
  'destinations', 'login', 'mypage', 'notes', 'partners', 'planner', 'plans',
  'portfolio', 'reading', 'scheduler', 'signup', 'travel'
]);

const ROUTE_STATE_SHELL_STYLE = {
  minHeight: '100dvh',
  display: 'grid',
  placeItems: 'center',
  padding: '24px',
  background: '#f4f7f8',
  color: '#172033'
};

const ROUTE_STATE_CARD_STYLE = {
  width: 'min(100%, 420px)',
  display: 'grid',
  gap: '12px',
  padding: '28px',
  border: '1px solid #d9e2ea',
  borderRadius: '12px',
  background: '#ffffff',
  textAlign: 'center'
};

function currentPath() {
  return window.location.pathname + window.location.search;
}

function normalizeRoutePath(routePath) {
  return routePath.replace(/\/+$/, '') || '/';
}

function redirectPathForRoute(routePath) {
  if (routePath === '/') return DEFAULT_APP_PATH;
  const root = routePath.split('/').filter(Boolean)[0] || '';
  if (LEGACY_ROUTE_ROOTS.has(root)) return DEFAULT_APP_PATH;
  return '';
}

function RouteNotFound({ navigate }) {
  return (
    <main style={ROUTE_STATE_SHELL_STYLE} aria-labelledby="routeNotFoundTitle">
      <section style={ROUTE_STATE_CARD_STYLE}>
        <span aria-hidden="true">404</span>
        <h1 id="routeNotFoundTitle" style={{ margin: 0, fontSize: '1.45rem' }}>페이지를 찾을 수 없어요</h1>
        <p style={{ margin: 0, color: '#617084', lineHeight: 1.6 }}>
          주소를 다시 확인하거나 앱 홈으로 돌아가 주세요.
        </p>
        <button
          type="button"
          onClick={() => navigate(DEFAULT_APP_PATH)}
          style={{
            minHeight: '46px',
            border: 0,
            borderRadius: '8px',
            background: '#0f766e',
            color: '#ffffff',
            font: 'inherit',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          앱 홈으로 돌아가기
        </button>
      </section>
    </main>
  );
}

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Failed to load route', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main style={ROUTE_STATE_SHELL_STYLE} aria-labelledby="routeLoadErrorTitle">
        <section style={ROUTE_STATE_CARD_STYLE}>
          <span aria-hidden="true">!</span>
          <h1 id="routeLoadErrorTitle" style={{ margin: 0, fontSize: '1.45rem' }}>화면을 불러오지 못했어요</h1>
          <p style={{ margin: 0, color: '#617084', lineHeight: 1.6 }}>
            네트워크 연결을 확인한 뒤 다시 시도해 주세요.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: '46px',
              border: 0,
              borderRadius: '8px',
              background: '#0f766e',
              color: '#ffffff',
              font: 'inherit',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            다시 불러오기
          </button>
        </section>
      </main>
    );
  }
}

function RouteFocus({ routePath, children }) {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const heading = document.querySelector('main h1');
      const target = heading || document.querySelector('main');
      if (!target) return;
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [routePath]);
  return children;
}

export default function AppRouter() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const handlePop = () => setPath(currentPath());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = (nextPath) => {
    if (!nextPath || nextPath === currentPath()) {
      return;
    }
    window.history.pushState({}, '', nextPath);
    setPath(currentPath());
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  };

  const routePath = normalizeRoutePath(path.split('?')[0]);
  const redirectPath = redirectPathForRoute(routePath);
  const activeRoutePath = redirectPath || routePath;

  useEffect(() => {
    if (redirectPath) {
      window.history.replaceState({}, '', redirectPath);
      setPath(currentPath());
    }
  }, [redirectPath]);

  let page;

  if (LIFEHUB_PATHS.has(activeRoutePath)) {
    page = <LifeHubApp path={redirectPath || path} navigate={navigate} />;
  } else {
    page = <RouteNotFound navigate={navigate} />;
  }

  return (
    <RouteErrorBoundary key={activeRoutePath}>
      <RouteFocus routePath={activeRoutePath}>{page}</RouteFocus>
    </RouteErrorBoundary>
  );
}
