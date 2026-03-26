/**
 * Get an environment variable from process.env.
 * Works in both local dev and GCP Cloud Run (env vars are injected directly via Secret Manager).
 */
export function getEnv(key: string): string | undefined {
  return process.env[key];
}
