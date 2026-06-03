import type { Metadata } from 'next';

export const seoSiteName = 'Hellowhen Trade';
export const seoDefaultTitle = 'Hellowhen Trade — Exchange skills, services, needs, and offers';
export const seoDefaultDescription = 'Hellowhen Trade helps adults exchange skills, services, small help, creative work, needs, and offers without money.';

const fallbackSiteUrl = 'https://www.hellowhen.com';

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getSeoSiteUrl() {
  const rawValue = process.env.NEXT_PUBLIC_WEB_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_WEB_APP_URL ?? process.env.WEB_APP_URL ?? fallbackSiteUrl;
  try {
    const url = new URL(rawValue);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallbackSiteUrl;
    return trimTrailingSlash(url.origin);
  } catch {
    return fallbackSiteUrl;
  }
}

export function getSeoUrl(pathname = '/') {
  const base = getSeoSiteUrl();
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${normalizedPath}`;
}

type PublicPageMetadataInput = {
  title?: string;
  description?: string;
  pathname?: string;
  noIndex?: boolean;
};

export function publicPageMetadata({ title = seoDefaultTitle, description = seoDefaultDescription, pathname = '/', noIndex = false }: PublicPageMetadataInput = {}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: getSeoUrl(pathname),
    },
    openGraph: {
      type: 'website',
      siteName: seoSiteName,
      title,
      description,
      url: getSeoUrl(pathname),
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    robots: noIndex ? {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    } : {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}

export function noIndexMetadata(title = seoSiteName): Metadata {
  return publicPageMetadata({ title, noIndex: true });
}

export const seoSitemapPaths = [
  '/',
  '/trades',
  '/needs',
  '/offers',
  '/support',
  '/legal',
  '/legal/privacy',
  '/legal/terms',
  '/legal/safety',
  '/legal/refund-dispute',
] as const;
