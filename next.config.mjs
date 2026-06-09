/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['playwright', '@axe-core/playwright', 'lighthouse'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
