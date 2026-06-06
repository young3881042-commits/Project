const configuredLoginUrl = import.meta.env?.VITE_LOGIN_URL?.trim();
export const APP_LOGIN_URL = configuredLoginUrl || '/login';

function safeRedirectPath(path, fallback = '/') {
  const candidate = `${path || fallback || '/'}`;
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/login') || candidate.startsWith('/signup')) {
    return fallback || '/';
  }
  return candidate;
}

export function currentAppPath() {
  if (typeof window === 'undefined') return '/';
  const pathname = window.location.pathname || '/';
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return `${path}${window.location.search || ''}`;
}

export function loginUrlForRedirect(redirect = '/') {
  const safeRedirect = safeRedirectPath(redirect, '/');
  const separator = APP_LOGIN_URL.includes('?') ? '&' : '?';
  return `${APP_LOGIN_URL}${separator}redirect=${encodeURIComponent(safeRedirect)}`;
}

export function loginUrlForCurrentLocation(fallback = '/') {
  return loginUrlForRedirect(safeRedirectPath(currentAppPath(), fallback));
}

export function redirectToLogin(fallback = '/') {
  if (typeof window === 'undefined') return;
  window.location.assign(loginUrlForCurrentLocation(fallback));
}
