import { headers } from "next/headers";

/**
 * The base URL of this deployment, correct in every environment.
 * See Report/06-deploy-vercel.md §5.
 *
 * Order matters:
 *   1. NEXT_PUBLIC_SITE_URL      — the real domain, set by hand in production
 *   2. NEXT_PUBLIC_VERCEL_URL    — this specific preview deployment
 *   3. the incoming request host — self-hosting, and local development
 *
 * Getting this wrong is why OAuth on a preview deployment bounces the user back
 * to localhost.
 */
export async function getSiteURL(): Promise<string> {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
  if (configured) return withProtocol(configured);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

const withProtocol = (url: string) =>
  url.startsWith("http") ? url.replace(/\/$/, "") : `https://${url.replace(/\/$/, "")}`;
