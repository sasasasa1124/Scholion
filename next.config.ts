import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Tell Turbopack the workspace root includes the parent directory (for CSV files)
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  // csv-parse and postgres are Node.js-only; keep them out of any edge bundles
  serverExternalPackages: ["csv-parse", "csv-parse/sync", "postgres"],
};

export default nextConfig;
