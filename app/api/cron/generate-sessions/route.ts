import { authorizeCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePlannedSessions } from "@/lib/provision";

/**
 * Weekly: keeps four weeks of `status='planned'` sessions ahead of every user,
 * so adherence always has a denominator (Report/06-deploy-vercel.md §7).
 *
 * Runs Sunday 18:00 UTC = Monday 01:00 in Bangkok. Idempotent — the
 * (user_id, date, plan_day_id) unique constraint absorbs repeats, and existing
 * sessions are never overwritten.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const admin = createAdminClient();

  const { data: settings, error } = await admin
    .from("user_settings")
    .select("user_id, active_plan_id")
    .not("active_plan_id", "is", null);

  if (error) {
    console.error("generate-sessions: could not list users", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  let created = 0;
  const failed: string[] = [];

  for (const row of settings ?? []) {
    try {
      created += await generatePlannedSessions(row.user_id, row.active_plan_id!, 4);
    } catch (err) {
      // One broken user must not stop the rest of the run.
      failed.push(row.user_id);
      console.error(`generate-sessions: user ${row.user_id}`, err);
    }
  }

  return Response.json({
    ok: failed.length === 0,
    users: settings?.length ?? 0,
    created,
    failed,
  });
}
