import "server-only";

import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/date";
import type { JobName } from "@/lib/job-run";

/**
 * Data for the admin system-health section
 * (Report/09-admin-implementation-plan.md §7).
 *
 * Everything reads through the admin's own client, so the RLS policies added in
 * 20260815000200 are what grant the wider view — there is no service-role client
 * here. The one exception is drift, which needs session_sets and therefore goes
 * through an aggregate-only function.
 */

export interface JobStatus {
  job: JobName;
  startedAt: string | null;
  finishedAt: string | null;
  ok: boolean | null;
  detail: Record<string, unknown>;
  error: string | null;
  /** Set when the job needs attention, with the reason. */
  alert: string | null;
}

export interface UserFlag {
  id: string;
  displayName: string;
  createdAt: string;
}

export interface DriftRow {
  userId: string;
  date: string;
  stored: number;
  actual: number;
}

export interface AdminHealth {
  jobs: JobStatus[];
  noUpcomingSessions: UserFlag[];
  neverProvisioned: UserFlag[];
  drift: DriftRow[];
  userCount: number;
}

/** How stale a job may get before the card turns into an alert. */
const MAX_AGE_HOURS: Record<JobName, number> = {
  // Weekly, so a day of slack on top of seven.
  "generate-sessions": 8 * 24,
  // Nightly, so a half-day of slack on top of one.
  "refresh-stats": 36,
};

function assessJob(job: JobName, row: JobStatus | undefined): JobStatus {
  const base: JobStatus = row ?? {
    job,
    startedAt: null,
    finishedAt: null,
    ok: null,
    detail: {},
    error: null,
    alert: null,
  };

  if (!base.startedAt) {
    return { ...base, alert: "ยังไม่เคยรันเลย" };
  }

  const ageHours = (Date.now() - new Date(base.startedAt).getTime()) / 3_600_000;
  if (ageHours > MAX_AGE_HOURS[job]) {
    return { ...base, alert: `ไม่ได้รันมา ${Math.floor(ageHours / 24)} วัน` };
  }

  // Started but never closed — a timeout or a crash mid-run. Distinct from
  // "never ran", and it needs a different fix, so say so separately.
  if (base.ok === null) {
    return { ...base, alert: "เริ่มแล้วแต่ไม่จบ (อาจ timeout)" };
  }

  if (base.ok === false) {
    return { ...base, alert: base.error ?? "รันไม่สำเร็จ" };
  }

  const failed = base.detail?.failed;
  if (Array.isArray(failed) && failed.length > 0) {
    return { ...base, alert: `สำเร็จ แต่มี ${failed.length} บัญชีที่พลาด` };
  }

  return base;
}

export async function getAdminHealth(): Promise<AdminHealth> {
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: runs }, { data: users }, { data: settings }, { data: upcoming }, { data: drift }] =
    await Promise.all([
      supabase
        .from("job_runs")
        .select("job, started_at, finished_at, ok, detail, error")
        .order("started_at", { ascending: false })
        .limit(40),
      supabase.from("users").select("id, display_name, created_at").order("created_at"),
      supabase.from("user_settings").select("user_id, active_plan_id"),
      supabase
        .from("sessions")
        .select("user_id")
        .eq("status", "planned")
        .gt("date", today),
      supabase.rpc("admin_stats_drift", { p_days: 7 }),
    ]);

  // Most recent run per job.
  const latest = new Map<string, JobStatus>();
  for (const r of runs ?? []) {
    if (latest.has(r.job)) continue;
    latest.set(r.job, {
      job: r.job as JobName,
      startedAt: r.started_at,
      finishedAt: r.finished_at,
      ok: r.ok,
      detail: (r.detail ?? {}) as Record<string, unknown>,
      error: r.error,
      alert: null,
    });
  }

  const withUpcoming = new Set((upcoming ?? []).map((s) => s.user_id));
  const provisioned = new Set(
    (settings ?? []).filter((s) => s.active_plan_id !== null).map((s) => s.user_id),
  );

  const toFlag = (u: { id: string; display_name: string; created_at: string }): UserFlag => ({
    id: u.id,
    displayName: u.display_name,
    createdAt: u.created_at,
  });

  return {
    jobs: (["generate-sessions", "refresh-stats"] as JobName[]).map((j) =>
      assessJob(j, latest.get(j)),
    ),
    // A user with no plan is already flagged as unprovisioned; listing them
    // twice would just be noise.
    noUpcomingSessions: (users ?? [])
      .filter((u) => provisioned.has(u.id) && !withUpcoming.has(u.id))
      .map(toFlag),
    neverProvisioned: (users ?? []).filter((u) => !provisioned.has(u.id)).map(toFlag),
    drift: (drift ?? []).map((d) => ({
      userId: d.user_id,
      date: d.date,
      stored: Number(d.stored),
      actual: Number(d.actual),
    })),
    userCount: users?.length ?? 0,
  };
}
