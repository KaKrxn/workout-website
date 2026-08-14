import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_B_ID, SEED, type SeedPlan } from "@/lib/program-seed";
import { addDays, formatISODate, startOfWeekMonday } from "@/lib/date";

/**
 * Creates everything a new account needs that the database trigger can't:
 * equipment, settings, the three plans with their days and items, and four
 * weeks of planned sessions.
 *
 * Report/02-data-model.md §8 — steps 2–6 depend on a real user_id, so they run
 * here at signup rather than in supabase/seed.sql.
 *
 * Idempotent: safe to call again for an already-provisioned user.
 */
export async function provisionUser(userId: string): Promise<void> {
  const admin = createAdminClient();

  // Already done? `plans` is the marker — it is the last thing written.
  const { count } = await admin
    .from("plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) > 0) return;

  // 1. Equipment the user owns (profile.equipment)
  const equipment = SEED.profile.equipment.map((e) => ({
    user_id: userId,
    equipment_id: e.id,
    label: e.name,
    max_weight_kg: e.maxWeightKg ?? null,
    attributes: e.incline === undefined ? {} : { incline: e.incline },
  }));
  const { error: eqErr } = await admin
    .from("user_equipment")
    .upsert(equipment, { onConflict: "user_id,equipment_id" });
  if (eqErr) throw new Error(`provisionUser/equipment: ${eqErr.message}`);

  // 2. Weekly targets and intensity rule (profile.weeklyTarget, profile.intensityRule)
  const { weeklyTarget, intensityRule } = SEED.profile;
  const { error: setErr } = await admin
    .from("user_settings")
    .update({
      weekly_goal_days: weeklyTarget.strengthDays,
      weekly_cardio_goal: weeklyTarget.cardioSessions,
      rir_target_min: intensityRule.min,
      rir_target_max: intensityRule.max,
    })
    .eq("user_id", userId);
  if (setErr) throw new Error(`provisionUser/settings: ${setErr.message}`);

  // 3–4. Plans, their days, and their items
  let activePlanId: string | null = null;

  for (const plan of SEED.plans) {
    const planId = await insertPlan(admin, userId, plan);
    if (plan.id === PLAN_B_ID) activePlanId = planId;
  }

  // 5. Program B is the primary program (Report/01-product-spec.md §5.1)
  if (activePlanId) {
    const { error } = await admin
      .from("user_settings")
      .update({ active_plan_id: activePlanId })
      .eq("user_id", userId);
    if (error) throw new Error(`provisionUser/activePlan: ${error.message}`);

    // 6. Four weeks of planned sessions, so adherence works from week one
    await generatePlannedSessions(userId, activePlanId, 4);
  }
}

type Admin = ReturnType<typeof createAdminClient>;

async function insertPlan(admin: Admin, userId: string, plan: SeedPlan): Promise<string> {
  const { data: planRow, error: planErr } = await admin
    .from("plans")
    .insert({
      user_id: userId,
      seed_id: plan.id,
      name: plan.name,
      split_type: plan.splitType,
      is_active: plan.id === PLAN_B_ID,
      use_when: plan.useWhen,
    })
    .select("id")
    .single();
  if (planErr || !planRow) throw new Error(`provisionUser/plan ${plan.id}: ${planErr?.message}`);

  const { data: dayRows, error: dayErr } = await admin
    .from("plan_days")
    .insert(
      plan.days.map((d) => ({
        plan_id: planRow.id,
        day_of_week: d.dayOfWeek,
        label: d.label,
        focus: d.focus ?? [],
        is_rest: d.isRest,
        is_cardio_day: d.isCardioDay ?? false,
        is_priority_day: d.isPriorityDay ?? false,
        rest_note: d.restNote ?? null,
        note: d.note ?? null,
      })),
    )
    .select("id, day_of_week");
  if (dayErr || !dayRows) throw new Error(`provisionUser/days ${plan.id}: ${dayErr?.message}`);

  // insert() preserves input order, but match on day_of_week rather than relying on it.
  const items = plan.days.flatMap((day) => {
    const row = dayRows.find((r) => r.day_of_week === day.dayOfWeek);
    if (!row) throw new Error(`provisionUser: no plan_day row for ${plan.id}/${day.dayOfWeek}`);

    return day.items.map((item, index) => ({
      plan_day_id: row.id,
      exercise_id: item.exerciseId,
      order_index: index,
      target_sets: item.sets,
      target_rep_min: item.reps?.[0] ?? null,
      target_rep_max: item.reps?.[1] ?? null,
      target_duration_min_s: item.durationS?.[0] ?? null,
      target_duration_max_s: item.durationS?.[1] ?? null,
      per_side: item.perSide ?? false,
      is_key: item.isKey ?? false,
      note: item.note ?? null,
    }));
  });

  if (items.length > 0) {
    const { error: itemErr } = await admin.from("plan_items").insert(items);
    if (itemErr) throw new Error(`provisionUser/items ${plan.id}: ${itemErr.message}`);
  }

  return planRow.id;
}

/**
 * Writes `weeks` weeks of `status='planned'` sessions from a plan's days,
 * starting from the current week. Skips rest days — a planned rest is not a
 * session, and the heatmap draws it from the plan, not from a row
 * (Report/04-analytics-spec.md G2).
 *
 * Idempotent via the (user_id, date, plan_day_id) unique constraint.
 * Also used by the weekly cron (Report/06-deploy-vercel.md §7).
 */
export async function generatePlannedSessions(
  userId: string,
  planId: string,
  weeks = 4,
  from: Date = new Date(),
): Promise<number> {
  const admin = createAdminClient();

  const { data: days, error } = await admin
    .from("plan_days")
    .select("id, day_of_week, focus, is_rest")
    .eq("plan_id", planId);
  if (error) throw new Error(`generatePlannedSessions: ${error.message}`);
  if (!days?.length) return 0;

  const weekStart = startOfWeekMonday(from);
  const rows: {
    user_id: string;
    plan_id: string;
    plan_day_id: string;
    date: string;
    status: "planned";
    focus: string[];
  }[] = [];

  for (let w = 0; w < weeks; w++) {
    for (const day of days) {
      if (day.is_rest || day.day_of_week === null) continue; // add-on days aren't scheduled

      // startOfWeekMonday returns Monday; day_of_week is 0=Sunday, so Sunday is +6.
      const offset = day.day_of_week === 0 ? 6 : day.day_of_week - 1;
      rows.push({
        user_id: userId,
        plan_id: planId,
        plan_day_id: day.id,
        date: formatISODate(addDays(weekStart, w * 7 + offset)),
        status: "planned",
        focus: day.focus ?? [],
      });
    }
  }

  // ignoreDuplicates so re-running never overwrites a session already completed.
  const { error: insErr, count } = await admin
    .from("sessions")
    .upsert(rows, { onConflict: "user_id,date,plan_day_id", ignoreDuplicates: true, count: "exact" });
  if (insErr) throw new Error(`generatePlannedSessions/insert: ${insErr.message}`);

  return count ?? 0;
}
