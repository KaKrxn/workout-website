import { authorizeCron } from "@/lib/cron";
import { recordJobRun } from "@/lib/job-run";
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

  const result = await recordJobRun("generate-sessions", async () => {
    const admin = createAdminClient();

    const { data: settings, error } = await admin
      .from("user_settings")
      .select("user_id, active_plan_id")
      .not("active_plan_id", "is", null);

    if (error) throw new Error(`could not list users: ${error.message}`);

    let created = 0;
    const failed: string[] = [];

    for (const row of settings ?? []) {
      try {
        created += await generatePlannedSessions(row.user_id, row.active_plan_id!, 4);
      } catch (err) {
        // One broken account must not stop the rest of the run. The ids land in
        // `detail` so the health page can surface them rather than losing them
        // to a log line nobody reads.
        failed.push(row.user_id);
        console.error(`generate-sessions: user ${row.user_id}`, err);
      }
    }

    return { users: settings?.length ?? 0, created, failed };
  });

  // `ok` means the run completed without throwing; per-user problems live in
  // `detail.failed`. Keeping those separate stops a single bad account from
  // looking identical to the job never running at all — the health page alerts
  // on either, but they need different fixes.
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
