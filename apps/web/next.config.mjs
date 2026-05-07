import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: repoRoot,
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
