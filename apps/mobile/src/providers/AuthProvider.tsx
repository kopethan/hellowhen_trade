import React, { createContext, useContext, useMemo, useState } from 'react';
import type { AuthUser, ForgotPasswordResponse } from '@hellowhen/contracts';
import { api } from '../lib/api';
import { clearAccessToken, setAccessToken } from '../lib/tokenStore';

type AuthProfilePatch = Partial<NonNullable<AuthUser['profile']>>;

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, confirmPassword?: string, acceptedTerms?: boolean) => Promise<void>;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<ForgotPasswordResponse>;
  updateLocalProfile: (profile: AuthProfilePatch) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user),
    async login(email, password) {
      const result = await api.auth.login({ email, password });
      await setAccessToken(result.accessToken);
      setUser(result.user);
    },
    async register(email, password, displayName, confirmPassword, acceptedTerms) {
      const result = await api.auth.register({ email, password, confirmPassword, displayName, acceptedTerms });
      await setAccessToken(result.accessToken);
      setUser(result.user);
    },
    async loginWithGoogleIdToken(idToken) {
      const result = await api.auth.google({ idToken });
      await setAccessToken(result.accessToken);
      setUser(result.user);
    },
    forgotPassword(email) {
      return api.auth.forgotPassword({ email });
    },
    updateLocalProfile(profile) {
      setUser((current) => current ? { ...current, profile: { ...(current.profile ?? {}), ...profile } } : current);
    },
    async logout() {
      await clearAccessToken();
      setUser(null);
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
