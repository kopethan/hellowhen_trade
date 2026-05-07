import { API_URL } from '../../lib/api';

export function resolveMediaUrl(url?: string | null) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('file://') || url.startsWith('data:')) return url;
  return `${API_URL.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
}
