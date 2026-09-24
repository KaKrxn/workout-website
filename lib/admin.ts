import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

/**
 * Confirms the caller is an admin, or renders 404.
 *
 * 404 rather than 403: a 403 confirms the route exists, which tells someone
 * probing exactly where to keep pushing.
 *
 * This is a convenience, not the security boundary — that lives in the RLS
 * policies (Report/08-admin-spec.md §2). Even if this check were bypassed the
 * queries behind it would return nothing.
 *
 * **Call it again inside every server action.** Guarding a layout protects
 * rendering; a server action is a separate endpoint that anyone can invoke
 * directly once they know its id.
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) notFound();

  return user.id;
}

/** True/false instead of a 404 — for deciding whether to render the admin link. */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.rpc("is_admin");
  return data === true;
}

/**
 * Appends to the audit log. The table has no update or delete policy, so
 * entries cannot be rewritten from the app.
 */
export async function auditLog(
  actorId: string,
  action: string,
  target?: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    target: target ?? null,
    detail: detail as Json,
  });

  // Never let bookkeeping swallow the action that succeeded — but do make the
  // gap loud, since an unlogged admin action is exactly what the log is for.
  if (error) console.error(`audit log failed for ${action}:`, error.message);
}
