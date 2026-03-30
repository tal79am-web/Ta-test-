/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // typedRoutes removed — requires Next.js canary
  env: {
    // When NEXT_PUBLIC_API_URL is unset, use the Next.js server's own /api routes (demo mode)
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? '',
  },
};

module.exports = nextConfig;
