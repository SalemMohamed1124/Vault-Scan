import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  devIndicators: false,
  serverExternalPackages: [],
  output: "standalone",
};

export default nextConfig;
