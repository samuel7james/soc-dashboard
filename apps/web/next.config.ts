import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@soc/ui", "@soc/types"],
};

export default nextConfig;
