import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@soc/ui", "@soc/types"],
  // Self-contained server bundle (only the deps the built app actually
  // needs) copied into the runtime stage of the Docker image, instead of
  // shipping the full workspace node_modules.
  output: "standalone",
};

export default nextConfig;
