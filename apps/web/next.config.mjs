/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@zizilia/api-client',
    '@zizilia/contracts',
    '@zizilia/shared',
    '@zizilia/theme',
    '@zizilia/trade-domain',
  ],
};

export default nextConfig;
