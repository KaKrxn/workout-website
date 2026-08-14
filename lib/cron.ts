import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Gate for cron endpoints.
 *
 * Vercel attaches `Authorization: Bearer <CRON_SECRET>` automatically once the
 * variable is set. Without this check the endpoints are open to anyone who knows
 * the path (Report/06-deploy-vercel.md §7).
 */
export function authorizeCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;

  // Refuse rather than run unauthenticated if the secret was never configured.
  if (!secret) {
    console.error("CRON_SECRET is not set — refusing to run the job");
    return new Response("Not configured", { status: 500 });
  }

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  // Constant-time compare; timingSafeEqual throws on a length mismatch.
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}
