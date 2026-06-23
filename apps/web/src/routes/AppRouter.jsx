import { useEffect, useState } from 'react';
import LifeHubApp from '../LifeHubApp.jsx';
import AccountPage from '../pages/account/AccountPage.jsx';
import AdminAnalysisPage from '../pages/admin/AdminAnalysisPage.jsx';
import AnalysisFileEditorPage from '../pages/admin/AnalysisFileEditorPage.jsx';
import AppAuthPage from '../pages/auth/AppAuthPage.jsx';
import BudgetPage from '../pages/budget/BudgetPage.jsx';
import ConnectionsPage from '../pages/connections/ConnectionsPage.jsx';
import AppHomePage from '../pages/home/AppHomePage.jsx';
import MorePage from '../pages/more/MorePage.jsx';
import NotesPage from '../pages/notes/NotesPage.jsx';
import PortfolioHomePage from '../pages/portfolio/PortfolioHomePage.jsx';
import ReadingPage from '../pages/reading/ReadingPageRoute.jsx';
import SchedulerPage from '../pages/scheduler/SchedulerPage.jsx';
import TravelPage from '../pages/travel/TravelPage.jsx';
import WorkoutPage from '../pages/workout/WorkoutPage.jsx';

const DEFAULT_APP_PATH = '/app';
const CONNECTIONS_PATH = '/connect';
const LIFEHUB_PATHS = ['/app', '/home', '/assistant', '/memo', '/schedule', '/more', '/reading', '/workout', '/travel', '/finance'];

function currentPath() {
  return window.location.pathname + window.location.search;
}

function redirectPathForRoute(routePath) {
  if (routePath === '/' || routePath === '/apps') {
    return DEFAULT_APP_PATH;
  }
  if (routePath === '/connections') {
    return CONNECTIONS_PATH;
  }
  return '';
}

function isLifeHubRoute(routePath) {
  return LIFEHUB_PATHS.some((basePath) => routePath === basePath || routePath.startsWith(`${basePath}/`));
}

export default function AppRouter() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const handlePop = () => setPath(currentPath());
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const navigate = (nextPath) => {
    if (!nextPath || nextPath === path) {
      return;
    }
    window.history.pushState({}, '', nextPath);
    setPath(currentPath());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const routePath = path.split('?')[0];
  const redirectPath = redirectPathForRoute(routePath);
  const activeRoutePath = redirectPath || routePath;

  useEffect(() => {
    if (redirectPath) {
      window.history.replaceState({}, '', redirectPath);
      setPath(currentPath());
    }
  }, [redirectPath]);

  if (activeRoutePath === '/analysis' || activeRoutePath.startsWith('/analysis/')) {
    return <AnalysisFileEditorPage navigate={navigate} />;
  }

  if (activeRoutePath === '/analysisadmin' || activeRoutePath.startsWith('/analysisadmin/')) {
    return <AdminAnalysisPage navigate={navigate} />;
  }

  if (activeRoutePath === '/scheduler' || activeRoutePath.startsWith('/scheduler/')) {
    return <SchedulerPage navigate={navigate} />;
  }

  if (activeRoutePath === '/connect' || activeRoutePath.startsWith('/connect/')) {
    return <ConnectionsPage navigate={navigate} />;
  }

  if (isLifeHubRoute(activeRoutePath)) {
    return <LifeHubApp path={path} navigate={navigate} />;
  }

  if (activeRoutePath === '/notes' || activeRoutePath.startsWith('/notes/')) {
    return <NotesPage navigate={navigate} />;
  }

  if (activeRoutePath === '/portfolio' || activeRoutePath.startsWith('/portfolio/')) {
    return <PortfolioHomePage navigate={navigate} />;
  }

  if (activeRoutePath === '/more' || activeRoutePath.startsWith('/more/')) {
    return <MorePage navigate={navigate} />;
  }

  if (activeRoutePath === '/mypage' || activeRoutePath.startsWith('/mypage/')) {
    return <AccountPage navigate={navigate} />;
  }

  if (activeRoutePath === '/budget' || activeRoutePath.startsWith('/budget/')) {
    return <BudgetPage navigate={navigate} />;
  }

  if (activeRoutePath === '/workout' || activeRoutePath.startsWith('/workout/')) {
    return <WorkoutPage navigate={navigate} />;
  }

  if (activeRoutePath === '/reading' || activeRoutePath.startsWith('/reading/')) {
    return <ReadingPage navigate={navigate} />;
  }

  if (activeRoutePath === '/login') {
    return <AppAuthPage mode="login" navigate={navigate} />;
  }

  if (activeRoutePath === '/signup') {
    return <AppAuthPage mode="signup" navigate={navigate} />;
  }

  if (activeRoutePath === '/app' || activeRoutePath.startsWith('/app/')) {
    return <AppHomePage navigate={navigate} />;
  }

  return <TravelPage path={path} navigate={navigate} />;
}
