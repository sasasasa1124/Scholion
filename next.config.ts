import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Tell Turbopack the workspace root includes the parent directory (for CSV files)
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  // csv-parse and fs are Node.js-only; keep them out of edge/Worker bundles
  serverExternalPackages: ["csv-parse", "csv-parse/sync"],
  webpack(config) {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false };
    return config;
  },
};

export default nextConfig;
