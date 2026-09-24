"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const settingsSchema = z.object({
  locale: z.enum(["th", "en"]),
  theme: z.enum(["light", "dark", "system"]),
  weeklyGoalDays: z.coerce.number().int().min(1).max(7),
  weeklyCardioGoal: z.coerce.number().int().min(0).max(7),
  vtaperTarget: z.coerce.number().min(1).max(3),
});

export type SettingsState = { ok: boolean; error: string | null };

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = settingsSchema.safeParse({
    locale: formData.get("locale"),
    theme: formData.get("theme"),
    weeklyGoalDays: formData.get("weeklyGoalDays"),
    weeklyCardioGoal: formData.get("weeklyCardioGoal"),
    vtaperTarget: formData.get("vtaperTarget"),
  });

  if (!parsed.success) return { ok: false, error: "ตรวจสอบค่าที่กรอกอีกครั้ง" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ต้องเข้าสู่ระบบก่อน" };

  const { error } = await supabase
    .from("user_settings")
    .update({
      locale: parsed.data.locale,
      theme: parsed.data.theme,
      weekly_goal_days: parsed.data.weeklyGoalDays,
      weekly_cardio_goal: parsed.data.weeklyCardioGoal,
      vtaper_target: parsed.data.vtaperTarget,
    })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  (await cookies()).set("locale", parsed.data.locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  return { ok: true, error: null };
}
