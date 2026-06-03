import { API_URL } from './api';

const fallbackPublicWebUrl = 'https://www.hellowhen.com';
const configuredPublicWebUrl = process.env.EXPO_PUBLIC_WEB_URL ?? '';

const localHostnames = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function isDevelopmentRuntime() {
  return process.env.NODE_ENV !== 'production';
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

function isLocalOrPrivateOrigin(url: URL) {
  const hostname = url.hostname.toLowerCase();
  return localHostnames.has(hostname) || isPrivateLanHostname(hostname);
}

function normalizeOrigin(value?: string | null, options: { allowLocal: boolean } = { allowLocal: false }) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!options.allowLocal && (url.protocol !== 'https:' || isLocalOrPrivateOrigin(url))) return null;
    return trimTrailingSlash(url.origin);
  } catch {
    return null;
  }
}

function deriveDevWebOriginFromApiUrl() {
  if (!isDevelopmentRuntime()) return null;
  try {
    const apiUrl = new URL(API_URL);
    if (apiUrl.protocol !== 'http:' && apiUrl.protocol !== 'https:') return null;
    apiUrl.port = '3000';
    apiUrl.pathname = '/';
    apiUrl.search = '';
    apiUrl.hash = '';
    return normalizeOrigin(apiUrl.toString(), { allowLocal: true });
  } catch {
    return null;
  }
}

export function getPublicWebOrigin() {
  const allowLocal = isDevelopmentRuntime();
  const configuredOrigin = normalizeOrigin(configuredPublicWebUrl, { allowLocal });
  if (configuredOrigin) return configuredOrigin;

  const derivedDevOrigin = deriveDevWebOriginFromApiUrl();
  if (derivedDevOrigin) return derivedDevOrigin;

  return fallbackPublicWebUrl;
}

export function buildPublicTradeUrl(tradeId: string) {
  return `${getPublicWebOrigin()}/trades/${encodeURIComponent(tradeId)}`;
}
