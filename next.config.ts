import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence multi-lockfile root inference by pinning this app as the root
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
