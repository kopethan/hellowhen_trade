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

export function getWebApiBaseUrl() {
  if (typeof window === 'undefined') return stripTrailingSlash(configuredApiUrl);

  try {
    const configured = new URL(configuredApiUrl, window.location.origin);
    const browserHost = window.location.hostname;

    // Local desktop dev can use localhost. Mobile web opened through a LAN IP
    // cannot: localhost would point to the phone. Reuse the browser hostname
    // and keep the configured API port, normally 4000.
    if (isLocalHostname(configured.hostname) && !isLocalHostname(browserHost)) {
      configured.hostname = browserHost;
    }

    return stripTrailingSlash(configured.toString());
  } catch {
    return stripTrailingSlash(configuredApiUrl);
  }
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
