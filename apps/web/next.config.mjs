import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const { loadEnvConfig } = nextEnv;
loadEnvConfig(repoRoot);

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: repoRoot,
  },
  async headers() {
    return [
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
  transpilePackages: [
    '@hellowhen/api-client',
    '@hellowhen/contracts',
    '@hellowhen/shared',
    '@hellowhen/theme',
    '@hellowhen/trade-domain',
  ],
};

export default nextConfig;
