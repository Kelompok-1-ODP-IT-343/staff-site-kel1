import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // menghasilkan .next/standalone untuk runtime container
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "is3.cloudhost.id",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "satuatap.my.id",
        port: "",
        pathname: "/**",
      },
    ],
  },
  // agar build tidak gagal karena lint errors
  eslint: {
    ignoreDuringBuilds: true,
  },
  // agar build tidak gagal karena type errors
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    // If we have a public API base URL, we call it directly (no proxy rewrites)
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      return [];
    }
    // Legacy/fallback proxy mode: provide safe defaults to avoid undefined destinations
    const coreTarget = process.env.API_PROXY_TARGET_CORE || "http://localhost:18080";
    const creditTarget = process.env.API_PROXY_TARGET_CREDIT || "http://localhost:9009";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${coreTarget}/api/v1/:path*`,
      },
      {
        source: "/credit-api/:path*",
        destination: `${creditTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
