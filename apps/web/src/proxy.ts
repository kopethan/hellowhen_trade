import { NextResponse, type NextRequest } from 'next/server';
import { WEB_ONBOARDING_GUIDE_COMPLETED_COOKIE } from './features/onboarding-guide/onboardingGuideConstants';

const ONBOARDING_EXCLUDED_PREFIXES = [
  '/onboarding-guide',
  '/auth',
  '/admin',
  '/reset-password',
  '/credits',
  '/legal',
  '/support',
  '/api',
  '/_next',
];

const PUBLIC_FILE_PATTERN = /\.(?:avif|ico|jpg|jpeg|png|svg|webp|gif|css|js|map|txt|xml|json|woff2?)$/i;
const CRAWLER_PATTERN = /bot|crawler|spider|crawling|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot/i;

function isOnboardingExcludedRoute(pathname: string) {
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/favicon.ico') return true;
  if (PUBLIC_FILE_PATTERN.test(pathname)) return true;
  return ONBOARDING_EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isCrawler(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') ?? '';
  return CRAWLER_PATTERN.test(userAgent);
}

function buildNextPath(request: NextRequest) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (request.method !== 'GET' && request.method !== 'HEAD') return NextResponse.next();
  if (isOnboardingExcludedRoute(pathname)) return NextResponse.next();
  if (isCrawler(request)) return NextResponse.next();

  const hasCompletedOnboarding = request.cookies.get(WEB_ONBOARDING_GUIDE_COMPLETED_COOKIE)?.value === 'true';
  if (hasCompletedOnboarding) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/onboarding-guide';
  url.search = `?next=${encodeURIComponent(buildNextPath(request))}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
