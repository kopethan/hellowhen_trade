import { API_URL } from '../../lib/api';

export function resolveMediaUrl(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return '';
  return `${API_URL.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
}
