'use client';

import type { AuthUser, ForgotPasswordResponse, ResetPasswordResponse } from '@hellowhen/contracts';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { clearAccessToken, getAccessToken, setAccessToken } from '../lib/webTokenStore';
import { useWebAppSettings } from './WebAppSettingsProvider';

type AuthProfilePatch = Partial<NonNullable<AuthUser['profile']>>;

type AuthContextValue = {
  user: AuthUser | null;
  hydrated: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; confirmPassword: string; displayName: string; acceptedTerms: boolean; countryCode: string; preferredCurrency: 'eur' | 'usd' | 'gbp' }) => Promise<void>;
  forgotPassword: (email: string) => Promise<ForgotPasswordResponse>;
  resetPassword: (token: string, password: string, confirmPassword: string) => Promise<ResetPasswordResponse>;
  updateLocalProfile: (profile: AuthProfilePatch) => void;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function WebAuthProvider({ children }: { children: React.ReactNode }) {
  const { refreshSettings } = useWebAppSettings();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refreshMe = useCallback(async () => {
    const result = await api.auth.me();
    setAccessToken(result.accessToken);
    setUser(result.user);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function hydrateSession() {
      try {
        const token = getAccessToken();
        if (!token) return;
        const result = await api.auth.me();
        if (!mounted) return;
        setAccessToken(result.accessToken);
        setUser(result.user);
        await refreshSettings().catch(() => undefined);
      } catch {
        clearAccessToken();
        if (mounted) setUser(null);
      } finally {
        if (mounted) setHydrated(true);
      }
    }
    void hydrateSession();
    return () => { mounted = false; };
  }, [refreshSettings]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    hydrated,
    isAuthenticated: Boolean(user),
    async login(email, password) {
      const result = await api.auth.login({ email, password });
      setAccessToken(result.accessToken);
      setUser(result.user);
      await refreshSettings().catch(() => undefined);
    },
    async register(input) {
      const result = await api.auth.register(input);
      setAccessToken(result.accessToken);
      setUser(result.user);
      await refreshSettings().catch(() => undefined);
    },
    forgotPassword(email) {
      return api.auth.forgotPassword({ email });
    },
    resetPassword(token, password, confirmPassword) {
      return api.auth.resetPassword({ token, password, confirmPassword });
    },
    updateLocalProfile(profile) {
      setUser((current) => current ? { ...current, profile: { ...(current.profile ?? {}), ...profile } } : current);
    },
    async logout() {
      clearAccessToken();
      setUser(null);
    },
    refreshMe,
  }), [hydrated, refreshMe, refreshSettings, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useWebAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useWebAuth must be used within WebAuthProvider');
  return value;
}
