import { authorizeCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Nightly: recomputes daily_stats for the last 7 days across all users.
 *
 * The triggers already keep it correct in normal operation. This is the safety
 * net for the cases they miss — a bulk offline sync inserted with triggers
 * disabled, or a trigger that errored (Report/02-data-model.md §6).
 *
 * Runs 19:00 UTC = 02:00 in Bangkok.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const admin = createAdminClient();

  // service_role only — the function crosses every user's rows.
  const { data, error } = await admin.rpc("refresh_recent_daily_stats", { p_days: 7 });

  if (error) {
    console.error("refresh-stats:", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, refreshed: data });
}
