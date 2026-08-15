import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface AdminUserRow {
  id: string;
  email: string | null;
  displayName: string;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
  activePlanName: string | null;
  lastSession: string | null;
  sessions90d: number;
  upcomingSessions: number;
}

/**
 * Every account, with the bits the console needs to triage one.
 *
 * Goes through admin_list_users() rather than a direct select because email
 * lives in auth.users, which PostgREST does not expose. The function checks
 * is_admin() itself.
 */
export async function listUsers(): Promise<AdminUserRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users");

  if (error) throw new Error(`listUsers: ${error.message}`);

  return (data ?? []).map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at,
    isAdmin: u.is_admin,
    activePlanName: u.active_plan_name,
    lastSession: u.last_session,
    sessions90d: Number(u.sessions_90d),
    upcomingSessions: Number(u.upcoming_sessions),
  }));
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface JobRunEntry {
  id: string;
  job: string;
  startedAt: string;
  finishedAt: string | null;
  ok: boolean | null;
  detail: Record<string, unknown>;
  error: string | null;
}

export async function listAuditLog(limit = 200): Promise<AuditEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, actor_id, actor_email, action, target, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listAuditLog: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    actorId: r.actor_id,
    actorEmail: r.actor_email,
    action: r.action,
    target: r.target,
    detail: (r.detail ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
  }));
}

export async function listJobRuns(limit = 50): Promise<JobRunEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_runs")
    .select("id, job, started_at, finished_at, ok, detail, error")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listJobRuns: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    job: r.job,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    ok: r.ok,
    detail: (r.detail ?? {}) as Record<string, unknown>,
    error: r.error,
  }));
}
