import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser, ForgotPasswordResponse } from '@hellowhen/contracts';
import { api } from '../lib/api';
import { useAppSettings } from './AppSettingsProvider';
import { clearAuthTokens, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from '../lib/tokenStore';

type AuthProfilePatch = Partial<NonNullable<AuthUser['profile']>>;
type AuthMeResponse = { user: AuthUser; accessToken?: string; refreshToken?: string };
type ApiLikeError = { status?: number };
type TwoFactorRequired = { requiresTwoFactor: true; challengeToken: string; message: string };

type AuthContextValue = {
  user: AuthUser | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, confirmPassword: string | undefined, acceptedTerms: boolean, countryCode?: string, preferredCurrency?: 'eur' | 'usd' | 'gbp') => Promise<void>;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<ForgotPasswordResponse>;
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

function isAuthError(error: unknown) {
  return Boolean(error && typeof error === 'object' && (((error as ApiLikeError).status === 401) || ((error as ApiLikeError).status === 403)));
}

async function persistReturnedTokens(result: { accessToken?: string; refreshToken?: string }) {
  if (result.accessToken) await setAccessToken(result.accessToken);
  if (result.refreshToken) await setRefreshToken(result.refreshToken);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { refreshSettings } = useAppSettings();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  async function applyAuthResult(result: AuthMeResponse) {
    await persistReturnedTokens(result);
    setUser(result.user);
    await refreshSettings().catch(() => undefined);
  }

  async function refreshSession() {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;
    const result = await api.auth.refresh({ refreshToken }) as AuthMeResponse;
    await applyAuthResult(result);
    return result;
  }

  async function refreshMe() {
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
  }

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      try {
        const token = await getAccessToken();
        const refreshToken = await getRefreshToken();
        if (!token && !refreshToken) return;
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
          await clearAuthTokens();
          if (mounted) setUser(null);
        }
      } finally {
        if (mounted) setHydrated(true);
      }
    }
    void hydrate();
    return () => { mounted = false; };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    hydrated,
    isAuthenticated: Boolean(user),
    async login(email, password) {
      const result = await api.auth.login({ email, password });
      if (isTwoFactorRequired(result)) throw new Error(result.message || 'Two-step verification is required.');
      await applyAuthResult(result as AuthMeResponse);
    },
    async register(email, password, displayName, confirmPassword, acceptedTerms, countryCode, preferredCurrency) {
      const result = await api.auth.register({ email, password, confirmPassword, displayName, acceptedTerms, countryCode, preferredCurrency });
      await applyAuthResult(result as AuthMeResponse);
    },
    async loginWithGoogleIdToken(idToken) {
      const result = await api.auth.google({ idToken });
      if (isTwoFactorRequired(result)) throw new Error(result.message || 'Two-step verification is required.');
      await applyAuthResult(result as AuthMeResponse);
    },
    forgotPassword(email) {
      return api.auth.forgotPassword({ email });
    },
    async reauthenticate(input) {
      await api.auth.reauthenticate(input);
      await refreshMe().catch(() => undefined);
    },
    updateLocalProfile(profile) {
      setUser((current) => current ? { ...current, profile: { ...(current.profile ?? {}), ...profile } } : current);
    },
    async logout() {
      const refreshToken = await getRefreshToken();
      if (refreshToken) await api.auth.logout({ refreshToken }).catch(() => undefined);
      await clearAuthTokens();
      setUser(null);
    },
    async logoutAll() {
      await api.auth.logoutAll().catch(() => undefined);
      await clearAuthTokens();
      setUser(null);
    },
    refreshMe,
  }), [hydrated, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
