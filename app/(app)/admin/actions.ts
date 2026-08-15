"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, auditLog } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionUser, generatePlannedSessions } from "@/lib/provision";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * Every action re-checks requireAdmin(). The layout guard protects rendering,
 * not POSTs — a server action is its own endpoint, callable directly by anyone
 * who knows its id (Report/09-admin-implementation-plan.md §6.3).
 *
 * All three are idempotent, so a double click is harmless.
 */

export async function rebuildRecentStats(): Promise<ActionResult> {
  const actorId = await requireAdmin();

  // service_role: the function crosses every user's rows by design.
  const { data, error } = await createAdminClient().rpc("refresh_recent_daily_stats", {
    p_days: 7,
  });
  if (error) return { ok: false, error: error.message };

  await auditLog(actorId, "stats.rebuild", null, { days: 7, refreshed: data });
  revalidatePath("/admin");
  return { ok: true, message: `คำนวณใหม่ ${data} วัน-ผู้ใช้` };
}

export async function reprovisionUser(userId: string): Promise<ActionResult> {
  const actorId = await requireAdmin();
  if (!z.string().uuid().safeParse(userId).success) {
    return { ok: false, error: "invalid user id" };
  }

  try {
    await provisionUser(userId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  await auditLog(actorId, "user.reprovision", userId);
  revalidatePath("/admin");
  return { ok: true, message: "ตั้งค่าเริ่มต้นให้ผู้ใช้เรียบร้อย" };
}

export async function grantAdmin(userId: string): Promise<ActionResult> {
  const actorId = await requireAdmin();
  if (!z.string().uuid().safeParse(userId).success) {
    return { ok: false, error: "invalid user id" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("admin_users").insert({ user_id: userId });
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "บัญชีนี้เป็นผู้ดูแลอยู่แล้ว" : error.message,
    };
  }

  await auditLog(actorId, "admin.grant", userId);
  revalidatePath("/admin/admins");
  revalidatePath("/admin/users");
  return { ok: true, message: "ให้สิทธิ์ผู้ดูแลแล้ว" };
}

export async function revokeAdmin(userId: string): Promise<ActionResult> {
  const actorId = await requireAdmin();
  if (!z.string().uuid().safeParse(userId).success) {
    return { ok: false, error: "invalid user id" };
  }

  // The database refuses to remove the last administrator — that guard is a
  // trigger, not a check here, so it holds for anything that skips this action.
  const supabase = await createClient();
  const { error } = await supabase.from("admin_users").delete().eq("user_id", userId);
  if (error) {
    return {
      ok: false,
      error: error.message.includes("last administrator")
        ? "ถอนไม่ได้ — เหลือผู้ดูแลคนสุดท้าย ให้สิทธิ์คนอื่นก่อน"
        : error.message,
    };
  }

  await auditLog(actorId, "admin.revoke", userId);
  revalidatePath("/admin/admins");
  revalidatePath("/admin/users");
  return { ok: true, message: "ถอนสิทธิ์ผู้ดูแลแล้ว" };
}

/**
 * Removes the auth user; every table cascades from there.
 *
 * The only place the service-role client is used for a destructive action —
 * auth.users sits outside RLS, so there is no policy-based route to it.
 */
export async function deleteUserAccount(
  userId: string,
  confirmEmail: string,
): Promise<ActionResult> {
  const actorId = await requireAdmin();
  if (!z.string().uuid().safeParse(userId).success) {
    return { ok: false, error: "invalid user id" };
  }
  if (userId === actorId) {
    return { ok: false, error: "ลบบัญชีตัวเองจากหน้านี้ไม่ได้" };
  }

  const admin = createAdminClient();

  // Re-read the address server-side and compare: the confirmation has to be
  // checked against the real record, not against whatever the form also sent.
  const { data: target, error: readErr } = await admin.auth.admin.getUserById(userId);
  if (readErr || !target?.user) return { ok: false, error: "ไม่พบบัญชีนี้" };
  if (target.user.email !== confirmEmail.trim()) {
    return { ok: false, error: "อีเมลยืนยันไม่ตรงกับบัญชีที่จะลบ" };
  }

  // Audit before deleting: afterwards there is no row left to describe.
  await auditLog(actorId, "user.delete", userId, { email: target.user.email });

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/users");
  return { ok: true, message: `ลบบัญชี ${target.user.email} แล้ว` };
}

export async function generateSessionsForUser(userId: string): Promise<ActionResult> {
  const actorId = await requireAdmin();
  if (!z.string().uuid().safeParse(userId).success) {
    return { ok: false, error: "invalid user id" };
  }

  const admin = createAdminClient();
  const { data: settings, error } = await admin
    .from("user_settings")
    .select("active_plan_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!settings?.active_plan_id) {
    return { ok: false, error: "ผู้ใช้ยังไม่มีโปรแกรมที่ใช้งานอยู่ — กด 'ตั้งค่าเริ่มต้น' ก่อน" };
  }

  let created: number;
  try {
    created = await generatePlannedSessions(userId, settings.active_plan_id, 4);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  await auditLog(actorId, "user.generate_sessions", userId, { created });
  revalidatePath("/admin");
  return { ok: true, message: `สร้างตารางล่วงหน้า ${created} วัน` };
}
