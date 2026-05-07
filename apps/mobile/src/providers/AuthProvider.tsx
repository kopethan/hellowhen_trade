import React, { createContext, useContext, useMemo, useState } from 'react';
import type { AuthUser } from '@zizilia/contracts';
import { api } from '../lib/api';
import { clearAccessToken, setAccessToken } from '../lib/tokenStore';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isSubmitting: boolean;
  authError: string | null;
  clearAuthError: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getFriendlyAuthError(error: unknown) {
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : null;

  if (status === 401) {
    return 'The email or password is not correct.';
  }

  if (status === 409) {
    return 'An account with this email already exists.';
  }

  if (status) {
    return 'The auth service responded with an error. Please try again.';
  }

  return 'Could not reach the API. Check EXPO_PUBLIC_API_URL and make sure the API server is running.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user),
    isSubmitting,
    authError,
    clearAuthError() {
      setAuthError(null);
    },
    async login(email, password) {
      setIsSubmitting(true);
      setAuthError(null);
      try {
        const result = await api.auth.login({ email, password });
        await setAccessToken(result.accessToken);
        setUser(result.user);
      } catch (error) {
        const message = getFriendlyAuthError(error);
        setAuthError(message);
        throw new Error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    async register(email, password, displayName) {
      setIsSubmitting(true);
      setAuthError(null);
      try {
        const result = await api.auth.register({ email, password, displayName });
        await setAccessToken(result.accessToken);
        setUser(result.user);
      } catch (error) {
        const message = getFriendlyAuthError(error);
        setAuthError(message);
        throw new Error(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    async logout() {
      await clearAccessToken();
      setUser(null);
    },
  }), [authError, isSubmitting, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
