export const ONLINE_PLACE_PROVIDER_KEYS = [
  'zoom',
  'google_meet',
  'microsoft_teams',
  'discord',
  'eventbrite',
  'youtube',
  'website',
  'generic_link',
] as const;

export type OnlinePlaceProviderKey = typeof ONLINE_PLACE_PROVIDER_KEYS[number];

export type OnlinePlaceProviderMetadata = {
  provider: OnlinePlaceProviderKey;
  label: string;
  hostname: string;
  normalizedUrl: string;
};

const PROVIDER_LABELS: Record<OnlinePlaceProviderKey, string> = {
  zoom: 'Zoom',
  google_meet: 'Google Meet',
  microsoft_teams: 'Microsoft Teams',
  discord: 'Discord',
  eventbrite: 'Eventbrite',
  youtube: 'YouTube',
  website: 'Website',
  generic_link: 'Generic link',
};

const ALLOWED_ONLINE_PLACE_PROTOCOLS = new Set(['http:', 'https:']);

function parseOnlinePlaceUrl(value: unknown): URL | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!ALLOWED_ONLINE_PLACE_PROTOCOLS.has(parsed.protocol)) return null;
    if (!parsed.hostname) return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizedHostname(value: string) {
  return value.trim().toLowerCase().replace(/^www\./, '');
}

function hostMatches(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function hostContainsProviderBrand(hostname: string, brand: string) {
  return hostname === brand || hostname.startsWith(`${brand}.`) || hostname.includes(`.${brand}.`);
}

function isIpLikeHost(hostname: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
}

function detectKnownProvider(hostname: string): OnlinePlaceProviderKey | null {
  if (hostMatches(hostname, 'zoom.us') || hostMatches(hostname, 'zoom.com')) return 'zoom';
  if (hostname === 'meet.google.com') return 'google_meet';
  if (hostMatches(hostname, 'teams.microsoft.com') || hostMatches(hostname, 'teams.live.com') || hostMatches(hostname, 'teams.office.com')) {
    return 'microsoft_teams';
  }
  if (hostMatches(hostname, 'discord.com') || hostMatches(hostname, 'discord.gg')) return 'discord';
  if (hostContainsProviderBrand(hostname, 'eventbrite')) return 'eventbrite';
  if (hostMatches(hostname, 'youtube.com') || hostMatches(hostname, 'youtu.be')) return 'youtube';
  return null;
}

export function normalizeOnlinePlaceUrl(value: unknown): string | null {
  const parsed = parseOnlinePlaceUrl(value);
  if (!parsed) return null;
  return parsed.toString();
}

export function isValidOnlinePlaceUrl(value: unknown): value is string {
  return Boolean(normalizeOnlinePlaceUrl(value));
}

export function getOnlinePlaceUrlValidationError(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return 'Online places require a valid http:// or https:// link.';
  return normalizeOnlinePlaceUrl(value) ? null : 'Use a valid http:// or https:// link.';
}

export function getOnlinePlaceProviderLabel(provider: OnlinePlaceProviderKey): string {
  return PROVIDER_LABELS[provider] ?? PROVIDER_LABELS.generic_link;
}

export function getOnlinePlaceProviderMetadata(value: unknown): OnlinePlaceProviderMetadata | null {
  const normalizedUrl = normalizeOnlinePlaceUrl(value);
  if (!normalizedUrl) return null;
  const parsed = new URL(normalizedUrl);
  const hostname = normalizedHostname(parsed.hostname);
  const provider = detectKnownProvider(hostname) ?? (hostname.includes('.') && !isIpLikeHost(hostname) ? 'website' : 'generic_link');
  return {
    provider,
    label: getOnlinePlaceProviderLabel(provider),
    hostname,
    normalizedUrl,
  };
}
