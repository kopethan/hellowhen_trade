import { Platform } from 'react-native';
import { createApiClient } from '@hellowhen/api-client';
import { getAccessToken } from './tokenStore';

const localHostnames = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

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

export const API_URL = getMobileApiUrl();

export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken,
});
