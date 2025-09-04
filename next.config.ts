import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    if (!isDev) return []; // no extra headers in production
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
            { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;