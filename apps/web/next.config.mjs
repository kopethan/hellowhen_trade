/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@hellowhen/api-client',
    '@hellowhen/contracts',
    '@hellowhen/shared',
    '@hellowhen/theme',
    '@hellowhen/trade-domain',
  ],
};

export default nextConfig;
