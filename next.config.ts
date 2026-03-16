import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

if (process.env.NODE_ENV === "development") {
  try {
    // @ts-ignore – optional dep, not yet installed
    const { setupDevPlatform } = await import("@cloudflare/next-on-pages/next-dev");
    await setupDevPlatform();
  } catch {
    // @cloudflare/next-on-pages not installed or wrangler not configured – skip
  }
}

export default nextConfig;
