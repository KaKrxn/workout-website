import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

export type JobName = "generate-sessions" | "refresh-stats";

export type JobResult<T> =
  | { ok: true; detail: T }
  | { ok: false; error: string };

/**
 * Runs a cron job and records the outcome in `job_runs`, whether it succeeds or
 * throws (Report/09-admin-implementation-plan.md §5).
 *
 * The row is written up front and closed afterwards, so a job that is killed
 * mid-run — a function timeout, say — leaves a row with `ok` still null rather
 * than no row at all. "Started and never finished" and "never started" are
 * different failures and the health page needs to tell them apart.
 *
 * Bookkeeping never fails the job: if the insert or update errors, that is
 * logged and the job's own result still stands.
 */
export async function recordJobRun<T>(
  job: JobName,
  fn: () => Promise<T>,
): Promise<JobResult<T>> {
  const admin = createAdminClient();

  const { data: row, error: insertError } = await admin
    .from("job_runs")
    .insert({ job })
    .select("id")
    .single();

  if (insertError) {
    console.error(`job_runs: could not open a run for ${job}:`, insertError.message);
  }

  const close = async (patch: { ok: boolean; detail?: Json; error?: string }) => {
    if (!row) return;
    const { error } = await admin
      .from("job_runs")
      .update({ finished_at: new Date().toISOString(), ...patch })
      .eq("id", row.id);
    if (error) console.error(`job_runs: could not close run ${row.id}:`, error.message);
  };

  try {
    const detail = await fn();
    await close({ ok: true, detail: (detail ?? {}) as Json });
    return { ok: true, detail };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`${job} failed:`, err);
    await close({ ok: false, error });
    return { ok: false, error };
  }
}
