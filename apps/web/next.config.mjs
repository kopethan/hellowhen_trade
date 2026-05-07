import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: repoRoot,
  },
  transpilePackages: [
    '@zizilia/api-client',
    '@zizilia/contracts',
    '@zizilia/shared',
    '@zizilia/theme',
    '@zizilia/trade-domain',
  ],
};

export default nextConfig;
