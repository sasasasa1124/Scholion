import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Tell Turbopack the workspace root includes the parent directory (for CSV files)
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
};

export default nextConfig;
