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
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
];

const productionSecurityHeaders = process.env.NODE_ENV === 'production'
  ? [{ key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' }]
  : [];

const plansEnabled = process.env.NEXT_PUBLIC_PLANS_ENABLED?.toLowerCase() === 'true';
const privateNoIndexHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
];

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
          ...privateNoIndexHeaders,
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
      {
        source: '/account/:path*',
        headers: privateNoIndexHeaders,
      },
      {
        source: '/plans/:path*',
        headers: privateNoIndexHeaders,
      },
    ];
  },
  async redirects() {
    if (plansEnabled) return [];
    return [
      { source: '/plans', destination: '/trades', permanent: true },
      { source: '/plans/:path*', destination: '/trades', permanent: true },
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
