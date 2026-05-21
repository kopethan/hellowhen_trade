const ACCESS_TOKEN_KEY = 'hellowhen_access_token';
const REFRESH_TOKEN_KEY = 'hellowhen_refresh_token';
export const AUTH_TOKENS_CHANGED_EVENT = 'hellowhen:auth-tokens-changed';

function emitAuthTokensChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(AUTH_TOKENS_CHANGED_EVENT));
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  emitAuthTokensChanged();
}

export function clearAccessToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  emitAuthTokensChanged();
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  emitAuthTokensChanged();
}

export function clearRefreshToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  emitAuthTokensChanged();
}

export function clearAuthTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  emitAuthTokensChanged();
}
