import type { Metadata } from 'next';
import type { MediaAssetDto } from '@hellowhen/contracts/src/media';
import { tradeSchema, type TradeDto } from '@hellowhen/contracts/src/trade';
import { isWebDemoDataEnabled } from './demoMode';
import { mockTrades } from './mockData';
import { getSeoUrl, publicPageMetadata, seoSiteName } from './seo';

const defaultTradePreviewDescription = 'Open this public Hellowhen Trade to exchange skills, services, needs, and offers without money.';
const unavailableTradeTitle = 'Trade unavailable';
const unavailableTradeDescription = 'This Hellowhen Trade is unavailable, private, expired, or no longer public.';
const fallbackApiUrl = 'http://localhost:4000';
const localHostnames = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, '');
}

function getServerApiBaseUrl() {
  const rawValue = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.API_URL?.trim() || fallbackApiUrl;
  try {
    const url = new URL(rawValue);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return stripTrailingSlash(url.toString());
  } catch {
    return null;
  }
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

function isShareableHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (localHostnames.has(url.hostname.toLowerCase()) || isPrivateLanHostname(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeText(value?: string | null) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number) {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalizeTradeResponse(value: unknown): TradeDto | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = 'trade' in value && value.trade && typeof value.trade === 'object' ? value.trade : value;
  const parsed = tradeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

async function fetchPublicTradeForMetadata(tradeId: string) {
  const apiBase = getServerApiBaseUrl();
  if (!apiBase) return null;

  try {
    const response = await fetch(`${apiBase}/trades/${encodeURIComponent(tradeId)}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return normalizeTradeResponse(await response.json());
  } catch {
    return null;
  }
}

async function loadPublicTradeForMetadata(tradeId: string) {
  const liveTrade = await fetchPublicTradeForMetadata(tradeId);
  if (liveTrade) return liveTrade;

  if (!isWebDemoDataEnabled()) return null;
  return mockTrades.find((trade) => trade.id === tradeId && trade.isPublic && trade.status === 'active') ?? null;
}

function getTradePreviewTitle(trade: TradeDto) {
  if (trade.postType === 'open_need') return normalizeText(trade.need?.title) || normalizeText(trade.title) || seoSiteName;
  if (trade.postType === 'open_offer') return normalizeText(trade.offer?.title) || normalizeText(trade.title) || seoSiteName;

  const needTitle = normalizeText(trade.need?.title);
  const offerTitle = normalizeText(trade.offer?.title);
  if (needTitle && offerTitle) return `${needTitle} ↔ ${offerTitle}`;
  return normalizeText(trade.title) || seoSiteName;
}

function getTradePreviewDescription(trade: TradeDto) {
  const needTitle = normalizeText(trade.need?.title);
  const offerTitle = normalizeText(trade.offer?.title);

  if (trade.postType === 'open_need' && needTitle) {
    return truncateText(`Open Need: ${needTitle}. Share an offer or ask to trade on Hellowhen Trade.`, 180);
  }
  if (trade.postType === 'open_offer' && offerTitle) {
    return truncateText(`Open Offer: ${offerTitle}. Share a need or ask to trade on Hellowhen Trade.`, 180);
  }
  if (needTitle && offerTitle) {
    return truncateText(`Need: ${needTitle}. Offer: ${offerTitle}. Open this public trade on Hellowhen Trade.`, 180);
  }

  const title = normalizeText(trade.title);
  if (title) return truncateText(`${title}. ${defaultTradePreviewDescription}`, 180);
  return defaultTradePreviewDescription;
}

function isPreviewImageCandidate(asset: MediaAssetDto) {
  return asset.status === 'active' && asset.mimeType.toLowerCase().startsWith('image/') && Boolean(asset.url || asset.storageKey);
}

function resolveMetadataImageUrl(asset: MediaAssetDto) {
  const rawUrl = normalizeText(asset.url);
  if (/^data:|^blob:/i.test(rawUrl)) return null;
  if (rawUrl && isShareableHttpUrl(rawUrl)) return rawUrl;

  const apiBase = getServerApiBaseUrl();
  if (!apiBase) return null;

  const rawPath = normalizeText(asset.storageKey || asset.url);
  if (!rawPath || /^data:|^blob:/i.test(rawPath)) return null;
  if (/^https?:\/\//i.test(rawPath) && !isShareableHttpUrl(rawPath)) return null;

  const normalizedPath = rawPath.replace(/^\.\//, '').replace(/^\/+/, '');
  const path = rawPath.startsWith('/')
    ? rawPath
    : normalizedPath.startsWith('uploads/')
      ? `/${normalizedPath}`
      : normalizedPath.includes('/')
        ? `/${normalizedPath}`
        : `/uploads/${normalizedPath}`;
  const absoluteUrl = `${apiBase}${path}`;
  return isShareableHttpUrl(absoluteUrl) ? absoluteUrl : null;
}

function getTradePreviewImageUrl(trade: TradeDto) {
  const media = [
    ...(trade.need?.media ?? []),
    ...(trade.offer?.media ?? []),
    ...(trade.media ?? []),
  ];

  for (const asset of media) {
    if (!isPreviewImageCandidate(asset)) continue;
    const url = resolveMetadataImageUrl(asset);
    if (url) return url;
  }

  return null;
}

function unavailableTradeMetadata(pathname: string): Metadata {
  return publicPageMetadata({
    title: unavailableTradeTitle,
    description: unavailableTradeDescription,
    pathname,
    noIndex: true,
  });
}

export async function publicTradeDetailMetadata(tradeId: string): Promise<Metadata> {
  const pathname = `/trades/${encodeURIComponent(tradeId)}`;
  const canonicalUrl = getSeoUrl(pathname);
  const trade = await loadPublicTradeForMetadata(tradeId);

  if (!trade || !trade.isPublic || trade.status !== 'active') {
    return unavailableTradeMetadata(pathname);
  }

  const title = truncateText(getTradePreviewTitle(trade), 90);
  const description = getTradePreviewDescription(trade);
  const imageUrl = getTradePreviewImageUrl(trade);
  const images = imageUrl ? [{ url: imageUrl, alt: `${title} preview` }] : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: 'website',
      siteName: seoSiteName,
      title,
      description,
      url: canonicalUrl,
      locale: 'en_US',
      alternateLocale: ['fr_FR'],
      images,
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}
