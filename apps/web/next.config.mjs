import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const sharedDistEntry = fileURLToPath(new URL('../../packages/shared/dist/index.js', import.meta.url));
const { loadEnvConfig } = nextEnv;
loadEnvConfig(repoRoot);

const baseSecurityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const productionSecurityHeaders = process.env.NODE_ENV === 'production'
  ? [{ key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' }]
  : [];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: repoRoot,
    resolveAlias: {
      '@hellowhen/shared': '../../packages/shared/dist/index.js',
    },
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@hellowhen/shared': sharedDistEntry,
    };
    return config;
  },
  async headers() {
    const securityHeaders = [...baseSecurityHeaders, ...productionSecurityHeaders];
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
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
