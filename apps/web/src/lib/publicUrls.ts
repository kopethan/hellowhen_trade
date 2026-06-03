const configuredPublicWebUrl =
  process.env.NEXT_PUBLIC_WEB_URL ??
  process.env.NEXT_PUBLIC_WEB_APP_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  '';

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return trimTrailingSlash(url.origin);
  } catch {
    return null;
  }
}

export function getPublicWebOrigin() {
  const configuredOrigin = normalizeOrigin(configuredPublicWebUrl);
  if (configuredOrigin) return configuredOrigin;

  if (typeof window !== 'undefined') {
    const windowOrigin = normalizeOrigin(window.location.origin);
    if (windowOrigin) return windowOrigin;
  }

  return '';
}

export function buildPublicTradeUrl(tradeId: string) {
  const origin = getPublicWebOrigin();
  const path = `/trades/${encodeURIComponent(tradeId)}`;
  return origin ? `${origin}${path}` : path;
}

export async function copyTextToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the hidden textarea fallback below.
    }
  }

  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
