"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin, auditLog } from "@/lib/admin";
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
