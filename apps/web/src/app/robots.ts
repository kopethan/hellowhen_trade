import type { MetadataRoute } from 'next';
import { getSeoUrl } from '../lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/admin/',
        '/account',
        '/account/',
        '/auth',
        '/auth/',
        '/credits',
        '/credits/',
        '/me',
        '/plans',
        '/plans/',
        '/reset-password',
        '/settings',
        '/wallet',
      ],
    },
    sitemap: getSeoUrl('/sitemap.xml'),
  };
}
