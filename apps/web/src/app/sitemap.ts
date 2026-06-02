import type { MetadataRoute } from 'next';
import { getSeoUrl, seoSitemapPaths } from '../lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return seoSitemapPaths.map((pathname) => ({
    url: getSeoUrl(pathname),
    lastModified: now,
    changeFrequency: pathname === '/' || pathname === '/trades' ? 'daily' : 'weekly',
    priority: pathname === '/' || pathname === '/trades' ? 1 : 0.7,
  }));
}
