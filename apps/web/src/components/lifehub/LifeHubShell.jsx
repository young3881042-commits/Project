import { Suspense } from 'react';
import MemoNavIcon from '../MemoNavIcon.jsx';
import { fullDateLabel } from '../../utils/lifeHubFormatters.js';
import LifeHubPackIcon from './LifeHubPackIcon.jsx';

export const ROUTE_META = {
  home: { title: '홈', path: '/app', icon: 'home' },
  memo: { title: '메모', path: '/memo', icon: 'edit' },
  schedule: { title: '일정', path: '/schedule', icon: 'calendar' },
  finance: { title: '가계부', path: '/finance', icon: 'chart' },
  more: { title: '설정', path: '/more', icon: 'settings' }
};

export const PRIMARY_TABS = ['home', 'schedule', 'memo', 'finance'];

export function routeTitle(route) {
  return ROUTE_META[route]?.title || '홈';
}

export function routeIcon(route) {
  return ROUTE_META[route]?.icon || 'home';
}

export default function LifeHubShell({ route, path, model, navigate, children }) {
  const activeTab = PRIMARY_TABS.includes(route) ? route : '';
  const shellRoute = route;
  const title = routeTitle(route);
  const icon = routeIcon(shellRoute);
  const currentPath = (path || window.location.pathname || '').split('?')[0];

  const go = (nextPath) => {
    if (navigate) navigate(nextPath);
    else {
      window.history.pushState({}, '', nextPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className={`lifeHubRoot lifeHubRoute-${shellRoute}`}>
      <main className={`lifeHubApp lifeHubApp-${route}`} aria-label="Orbit 생활관리 앱">
        <header className="lifeHubTopBar">
          <div className="lifeHubTopTitle">
            <span className={route === 'home' ? 'lifeHubTopIcon pack' : 'lifeHubTopIcon'}>
              {route === 'home' ? <LifeHubPackIcon name="calendar" /> : <MemoNavIcon type={icon} />}
            </span>
            <div>
              <span>{route === 'home' ? 'Orbit' : fullDateLabel(model.today)}</span>
              <h1>{title}</h1>
            </div>
          </div>
          {route !== 'more' ? (
            <button
              type="button"
              className="lifeHubTopAction"
              onClick={() => go('/more')}
              aria-label="앱 설정과 데이터 관리 열기"
            >
              <MemoNavIcon type="settings" />
            </button>
          ) : null}
        </header>
        <Suspense fallback={(
          <section className="lifeHubRouteLoading" aria-busy="true" aria-live="polite">
            <span aria-hidden="true" />
            <p>화면을 불러오는 중이에요.</p>
          </section>
        )}>
          {children}
        </Suspense>
      </main>
      <nav className="lifeHubBottomNav" aria-label="Orbit 하단 메뉴">
        {PRIMARY_TABS.map((tab) => {
          const meta = ROUTE_META[tab];
          const active = activeTab === tab || currentPath === meta.path;
          return (
            <button
              type="button"
              key={tab}
              className={active ? 'active' : ''}
              onClick={() => go(meta.path)}
              aria-current={active ? 'page' : undefined}
            >
              <MemoNavIcon type={meta.icon} />
              <span>{meta.title}</span>
            </button>
          );
        })}
      </nav>
      <div className="lifeHubLiveRegion" aria-live="polite">
        {routeTitle(route)} 화면을 열었습니다.
      </div>
    </div>
  );
}
