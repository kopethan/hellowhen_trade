import { Platform } from 'react-native';
import { createApiClient, type HellowhenApiClient } from '@hellowhen/api-client';
import type { AuthResponse } from '@hellowhen/contracts';
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from './tokenStore';

const localHostnames = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

type ApiLikeError = {
  code?: string;
  status?: number;
  body?: unknown;
};

type ApiFunction = (...args: unknown[]) => Promise<unknown>;

const authRetryBlockedMethods = new Set([
  'login',
  'register',
  'google',
  'loginTwoFactor',
  'refresh',
  'logout',
  'logoutAll',
  'forgotPassword',
  'resetPassword',
]);

let refreshSessionPromise: Promise<AuthResponse | null> | null = null;

function getDefaultDevApiUrl() {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }

  return 'http://localhost:4000';
}

function isPrivateLanHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (/^10\./.test(normalized)) return true;
  if (/^192\.168\./.test(normalized)) return true;
  const match = normalized.match(/^172\.(\d{1,2})\./);
  if (!match) return false;
  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function parseApiUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLocalOrPrivateApiUrl(value: string) {
  const parsed = parseApiUrl(value);
  if (!parsed) return false;
  return localHostnames.has(parsed.hostname.toLowerCase()) || isPrivateLanHostname(parsed.hostname);
}

function isDevelopmentRuntime() {
  return process.env.NODE_ENV !== 'production';
}

function assertSafeProductionApiUrl(value: string) {
  if (isDevelopmentRuntime()) return;
  const parsed = parseApiUrl(value);
  if (!parsed || parsed.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_URL must use https:// in production mobile builds.');
  }
  if (isLocalOrPrivateApiUrl(value)) {
    throw new Error('EXPO_PUBLIC_API_URL must not point to localhost or a private LAN address in production builds.');
  }
}

function getMobileApiUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) {
    assertSafeProductionApiUrl(configured);
    return configured;
  }

  if (isDevelopmentRuntime()) return getDefaultDevApiUrl();
  throw new Error('EXPO_PUBLIC_API_URL is required for production mobile builds.');
}

function isUnauthorizedError(error: unknown) {
  return Boolean(error && typeof error === 'object' && (error as ApiLikeError).status === 401);
}

function shouldRetryUnauthorized(path: string[]) {
  const [namespace, method] = path;
  if (namespace === 'auth' && method && authRetryBlockedMethods.has(method)) return false;
  return true;
}

async function parseRefreshError(response: Response): Promise<never> {
  let body: unknown = null;
  try { body = await response.json(); } catch { /* ignore malformed error body */ }
  const error = new Error(`API request failed: ${response.status}`);
  Object.assign(error, { code: 'HELLOWHEN_API_ERROR', status: response.status, body });
  throw error;
}

async function refreshMobileSessionOnce() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) await parseRefreshError(response);

  const result = await response.json() as AuthResponse;
  await setAccessToken(result.accessToken);
  if (result.refreshToken) await setRefreshToken(result.refreshToken);
  return result;
}

export async function refreshMobileSession() {
  if (!refreshSessionPromise) {
    refreshSessionPromise = refreshMobileSessionOnce().finally(() => {
      refreshSessionPromise = null;
    });
  }

  return refreshSessionPromise;
}

function wrapApiFunction(fn: ApiFunction, path: string[]): ApiFunction {
  return async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (!isUnauthorizedError(error) || !shouldRetryUnauthorized(path)) throw error;

      const refreshed = await refreshMobileSession().catch(() => null);
      if (!refreshed) throw error;

      return fn(...args);
    }
  };
}

function withMobileAuthRetry<T>(node: T, path: string[] = []): T {
  if (typeof node === 'function') {
    return wrapApiFunction(node as ApiFunction, path) as T;
  }

  if (!node || typeof node !== 'object') return node;

  return new Proxy(node as Record<PropertyKey, unknown>, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property === 'symbol') return value;
      return withMobileAuthRetry(value, [...path, property]);
    },
  }) as T;
}

export const API_URL = getMobileApiUrl();

const baseApi = createApiClient({
  baseUrl: API_URL,
  getAccessToken,
});

export const api: HellowhenApiClient = withMobileAuthRetry(baseApi);
