import { headers } from "next/headers";

/**
 * Returns the authenticated user's email from Cloudflare Access headers.
 * Falls back to "local@dev" in local development.
 */
export async function getUserEmail(): Promise<string> {
  const h = await headers();
  return h.get("Cf-Access-Authenticated-User-Email") ?? "local@dev";
}
