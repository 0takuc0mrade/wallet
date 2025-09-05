import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: config => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  },
   eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
