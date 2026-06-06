export const APP_LOGIN_URL = 'http://34.42.232.172/login';

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
  return `${APP_LOGIN_URL}?redirect=${encodeURIComponent(safeRedirect)}`;
}

export function loginUrlForCurrentLocation(fallback = '/') {
  return loginUrlForRedirect(safeRedirectPath(currentAppPath(), fallback));
}

export function redirectToLogin(fallback = '/') {
  if (typeof window === 'undefined') return;
  window.location.assign(loginUrlForCurrentLocation(fallback));
}
