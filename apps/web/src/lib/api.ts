import { createApiClient } from '@hellowhen/api-client';
import { getAccessToken } from './webTokenStore';

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:4000';
const localHostnames = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

function isLocalHostname(hostname: string) {
  return localHostnames.has(hostname.toLowerCase());
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

function isLocalOrPrivateHostname(hostname: string) {
  return isLocalHostname(hostname) || isPrivateLanHostname(hostname);
}

function assertSafeBrowserApiUrl(configured: URL, browserHost: string) {
  // Local desktop/LAN development can keep using local API URLs. Once the web app
  // is served from a public host, do not silently call localhost or private LAN APIs.
  if (process.env.NODE_ENV !== 'production' || isLocalOrPrivateHostname(browserHost)) return;
  if (configured.protocol !== 'https:') {
    throw new Error('NEXT_PUBLIC_API_URL must use https:// when the web app is served from a public production host.');
  }
  if (isLocalOrPrivateHostname(configured.hostname)) {
    throw new Error('NEXT_PUBLIC_API_URL must not point to localhost or a private LAN address in public production.');
  }
}

export function getWebApiBaseUrl() {
  if (typeof window === 'undefined') return stripTrailingSlash(configuredApiUrl);

  let configured: URL;
  try {
    configured = new URL(configuredApiUrl, window.location.origin);
  } catch {
    return stripTrailingSlash(configuredApiUrl);
  }

  const browserHost = window.location.hostname;

  // Local desktop dev can use localhost. Mobile web opened through a LAN IP
  // cannot: localhost would point to the phone. Reuse the browser hostname
  // and keep the configured API port, normally 4000.
  if (isLocalHostname(configured.hostname) && !isLocalHostname(browserHost)) {
    configured.hostname = browserHost;
  }

  assertSafeBrowserApiUrl(configured, browserHost);
  return stripTrailingSlash(configured.toString());
}

export const API_URL = getWebApiBaseUrl();

export function resolveWebAssetUrl(value?: string | null, storageKey?: string | null) {
  const raw = (value ?? storageKey ?? '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

  const base = getWebApiBaseUrl();
  const normalized = raw.replace(/^\.\//, '').replace(/^\/+/, '');
  const path = raw.startsWith('/')
    ? raw
    : normalized.startsWith('uploads/')
      ? `/${normalized}`
      : normalized.includes('/')
        ? `/${normalized}`
        : `/uploads/${normalized}`;

  return `${base}${path}`;
}

export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken,
});
