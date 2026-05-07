import React, { createContext, useContext, useMemo, useState } from 'react';
import type { AuthUser } from '@hellowhen/contracts';
import { api } from '../lib/api';
import { clearAccessToken, setAccessToken } from '../lib/tokenStore';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
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
    async register(email, password, displayName) {
      const result = await api.auth.register({ email, password, displayName });
      await setAccessToken(result.accessToken);
      setUser(result.user);
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
