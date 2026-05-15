'use client';

import type { AuthUser, ForgotPasswordResponse, ResetPasswordResponse } from '@hellowhen/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { clearAuthTokens, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from '../lib/webTokenStore';
import { useWebAppSettings } from './WebAppSettingsProvider';

type AuthProfilePatch = Partial<NonNullable<AuthUser['profile']>>;
type AuthMeResponse = { user: AuthUser; accessToken?: string; refreshToken?: string };
type ApiLikeError = { status?: number };
type TwoFactorRequired = { requiresTwoFactor: true; challengeToken: string; message: string };

const CACHED_USER_STORAGE_KEY = 'hellowhen_auth_user_v1';

type AuthContextValue = {
  user: AuthUser | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<TwoFactorRequired | void>;
  register: (input: { email: string; password: string; confirmPassword: string; displayName: string; acceptedTerms: boolean; ageConfirmed: boolean; declaredAgeBucket: '18_plus'; countryCode: string; preferredCurrency?: 'eur' | 'usd' | 'gbp' }) => Promise<void>;
  forgotPassword: (email: string) => Promise<ForgotPasswordResponse>;
  resetPassword: (token: string, password: string, confirmPassword: string) => Promise<ResetPasswordResponse>;
  completeTwoFactorLogin: (input: { challengeToken: string; code: string }) => Promise<void>;
  reauthenticate: (input: { password?: string; code?: string }) => Promise<void>;
  updateLocalProfile: (profile: AuthProfilePatch) => void;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isTwoFactorRequired(value: unknown): value is TwoFactorRequired {
  return Boolean(value && typeof value === 'object' && (value as TwoFactorRequired).requiresTwoFactor === true);
}

function persistReturnedTokens(result: { accessToken?: string; refreshToken?: string }) {
  if (typeof result.accessToken === 'string' && result.accessToken.length > 0) setAccessToken(result.accessToken);
  if (typeof result.refreshToken === 'string' && result.refreshToken.length > 0) setRefreshToken(result.refreshToken);
}

function isAuthError(error: unknown) {
  return Boolean(error && typeof error === 'object' && (((error as ApiLikeError).status === 401) || ((error as ApiLikeError).status === 403)));
}

function readCachedUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHED_USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) as AuthUser : null;
  } catch {
    return null;
  }
}

function saveCachedUser(nextUser: AuthUser | null) {
  if (typeof window === 'undefined') return;
  if (nextUser) window.localStorage.setItem(CACHED_USER_STORAGE_KEY, JSON.stringify(nextUser));
  else window.localStorage.removeItem(CACHED_USER_STORAGE_KEY);
}

export function WebAuthProvider({ children }: { children: React.ReactNode }) {
  const { refreshSettings } = useWebAppSettings();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const applyAuthResult = useCallback(async (result: AuthMeResponse) => {
    persistReturnedTokens(result);
    setUser(result.user);
    saveCachedUser(result.user);
    // Settings sync is a secondary convenience fetch. Auth should still complete
    // when the account/session was created successfully but settings refresh is
    // delayed or temporarily unavailable.
    await refreshSettings().catch(() => undefined);
  }, [refreshSettings]);

  const refreshSession = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    const result = await api.auth.refresh({ refreshToken }) as AuthMeResponse;
    await applyAuthResult(result);
    return result;
  }, [applyAuthResult]);

  const refreshMe = useCallback(async () => {
    try {
      const result = await api.auth.me() as AuthMeResponse;
      await applyAuthResult(result);
    } catch (error) {
      if (isAuthError(error)) {
        const refreshed = await refreshSession();
        if (refreshed) return;
      }
      throw error;
    }
  }, [applyAuthResult, refreshSession]);

  useEffect(() => {
    let mounted = true;
    async function hydrateSession() {
      try {
        const token = getAccessToken();
        const refreshToken = getRefreshToken();
        if (!token && !refreshToken) return;
        const cachedUser = readCachedUser();
        if (cachedUser && mounted) setUser(cachedUser);
        try {
          const result = token ? await api.auth.me() as AuthMeResponse : await api.auth.refresh({ refreshToken: refreshToken! }) as AuthMeResponse;
          if (!mounted) return;
          await applyAuthResult(result);
        } catch (error) {
          if (isAuthError(error) && refreshToken) {
            const result = await api.auth.refresh({ refreshToken }) as AuthMeResponse;
            if (!mounted) return;
            await applyAuthResult(result);
          } else {
            throw error;
          }
        }
      } catch (error) {
        if (isAuthError(error)) {
          clearAuthTokens();
          saveCachedUser(null);
          if (mounted) setUser(null);
        }
      } finally {
        if (mounted) setHydrated(true);
      }
    }
    void hydrateSession();
    return () => { mounted = false; };
  }, [applyAuthResult]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    hydrated,
    isAuthenticated: Boolean(user),
    async login(email, password) {
      const result = await api.auth.login({ email, password });
      if (isTwoFactorRequired(result)) return result;
      await applyAuthResult(result as AuthMeResponse);
      return undefined;
    },
    async register(input) {
      const result = await api.auth.register(input);
      await applyAuthResult(result as AuthMeResponse);
    },
    forgotPassword(email) {
      return api.auth.forgotPassword({ email });
    },
    resetPassword(token, password, confirmPassword) {
      return api.auth.resetPassword({ token, password, confirmPassword });
    },
    async completeTwoFactorLogin(input) {
      const result = await api.auth.loginTwoFactor(input);
      await applyAuthResult(result as AuthMeResponse);
    },
    async reauthenticate(input) {
      await api.auth.reauthenticate(input);
      await refreshMe().catch(() => undefined);
    },
    updateLocalProfile(profile) {
      setUser((current) => {
        if (!current) return current;
        const nextUser = { ...current, profile: { ...(current.profile ?? {}), ...profile } };
        saveCachedUser(nextUser);
        return nextUser;
      });
    },
    async logout() {
      const refreshToken = getRefreshToken();
      if (refreshToken) await api.auth.logout({ refreshToken }).catch(() => undefined);
      clearAuthTokens();
      saveCachedUser(null);
      setUser(null);
    },
    async logoutAll() {
      await api.auth.logoutAll().catch(() => undefined);
      clearAuthTokens();
      saveCachedUser(null);
      setUser(null);
    },
    refreshMe,
  }), [applyAuthResult, hydrated, refreshMe, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useWebAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useWebAuth must be used within WebAuthProvider');
  return value;
}
