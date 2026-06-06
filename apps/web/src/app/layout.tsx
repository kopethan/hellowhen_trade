import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { WebMobileShell } from '../components/WebMobileShell';
import { WebAppProviders } from '../providers/WebAppProviders';
import { getSeoSiteUrl, seoDefaultDescription, seoDefaultTitle, seoSiteName } from '../lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(getSeoSiteUrl()),
  title: {
    default: seoDefaultTitle,
    template: `%s | ${seoSiteName}`,
  },
  description: seoDefaultDescription,
  applicationName: seoSiteName,
  icons: { icon: '/favicon.svg' },
  openGraph: {
    type: 'website',
    siteName: seoSiteName,
    title: seoDefaultTitle,
    description: seoDefaultDescription,
    url: getSeoSiteUrl(),
  },
  twitter: {
    card: 'summary',
    title: seoDefaultTitle,
    description: seoDefaultDescription,
  },
};

const themeScript = `
(function () {
  try {
    var settingsRaw = window.localStorage.getItem('hellowhen_app_settings_v1');
    var settings = settingsRaw ? JSON.parse(settingsRaw) : null;
    var stored = settings && settings.appearance ? settings.appearance : window.localStorage.getItem('hellowhen:appearance');
    var appearance = stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'system';
    var theme = appearance === 'dark' || appearance === 'light'
      ? appearance
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var language = settings && settings.language ? settings.language : 'system';
    var candidates = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    var resolvedLanguage = language === 'fr' || language === 'en' ? language : 'en';
    if (language === 'system') {
      for (var i = 0; i < candidates.length; i += 1) {
        var base = String(candidates[i] || '').toLowerCase().replace('_', '-').split('-')[0];
        if (base === 'fr' || base === 'en') { resolvedLanguage = base; break; }
      }
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.appearance = appearance;
    document.documentElement.dataset.language = resolvedLanguage;
    document.documentElement.lang = resolvedLanguage;
  } catch (error) {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.dataset.appearance = 'system';
    document.documentElement.dataset.language = 'en';
    document.documentElement.lang = 'en';
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script id="hellowhen-theme" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <WebAppProviders><WebMobileShell>{children}</WebMobileShell></WebAppProviders>
      </body>
    </html>
  );
}
