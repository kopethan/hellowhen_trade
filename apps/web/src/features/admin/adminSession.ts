'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearAuthTokens, getAccessToken } from '../../lib/webTokenStore';

const legacyAdminTokenKey = 'hellowhen:admin_access_token';

export function clearLegacyAdminToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(legacyAdminTokenKey);
}

export function readAdminSessionToken() {
  clearLegacyAdminToken();
  return getAccessToken() ?? '';
}

export function useAdminSessionToken() {
  const [token, setToken] = useState('');

  const refreshToken = useCallback(() => {
    setToken(readAdminSessionToken());
  }, []);

  useEffect(() => {
    refreshToken();
    window.addEventListener('storage', refreshToken);
    window.addEventListener('focus', refreshToken);
    return () => {
      window.removeEventListener('storage', refreshToken);
      window.removeEventListener('focus', refreshToken);
    };
  }, [refreshToken]);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }), [token]);

  return { token, headers, refreshToken };
}

export function clearAdminBrowserSession() {
  clearLegacyAdminToken();
  clearAuthTokens();
}

export function adminSessionRequiredMessage() {
  return 'Use a signed-in admin account before loading this internal console.';
}

export function adminRequestFailedMessage() {
  return 'Could not load this internal console. The account may not have admin access, two-step verification may be required, or this section may be disabled for launch mode.';
}
