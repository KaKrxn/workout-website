"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const intOrNull = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.coerce.number().int().min(0).nullable(),
);

function done() {
  revalidatePath("/schedule");
  revalidatePath("/today");
}

export async function renamePlanDayVariant(formData: FormData): Promise<void> {
  const parsed = z
    .object({
      id: uuid,
      variantLabel: z.string().trim().min(1).max(48),
    })
    .safeParse({
      id: formData.get("id"),
      variantLabel: formData.get("variantLabel"),
    });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_days")
    .update({ variant_label: parsed.data.variantLabel })
    .eq("id", parsed.data.id);

  if (error) throw new Error(error.message);
  done();
}

export async function setDefaultVariant(formData: FormData): Promise<void> {
  const parsed = z.object({ id: uuid }).safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("invalid id");

  const supabase = await createClient();
  const { data: target, error: readError } = await supabase
    .from("plan_days")
    .select("id, plan_id, day_of_week")
    .eq("id", parsed.data.id)
    .single();

  if (readError || !target) throw new Error(readError?.message ?? "variant not found");
  if (target.day_of_week == null) throw new Error("add-on days cannot be default");

  const { error: clearError } = await supabase
    .from("plan_days")
    .update({ is_default: false })
    .eq("plan_id", target.plan_id)
    .eq("day_of_week", target.day_of_week);
  if (clearError) throw new Error(clearError.message);

  const { error } = await supabase.from("plan_days").update({ is_default: true }).eq("id", target.id);
  if (error) throw new Error(error.message);

  done();
}

export async function duplicateVariant(formData: FormData): Promise<void> {
  const parsed = z.object({ id: uuid }).safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("invalid id");

  const supabase = await createClient();
  const { data: source, error: sourceError } = await supabase
    .from("plan_days")
    .select(
      "plan_id, day_of_week, label, focus, is_rest, is_cardio_day, is_priority_day, rest_note, note, variant_label, variant_order",
    )
    .eq("id", parsed.data.id)
    .single();

  if (sourceError || !source) throw new Error(sourceError?.message ?? "variant not found");
  if (source.day_of_week == null) throw new Error("add-on days are not editable in this view yet");

  const { data: siblings } = await supabase
    .from("plan_days")
    .select("variant_label, variant_order")
    .eq("plan_id", source.plan_id)
    .eq("day_of_week", source.day_of_week);

  const existingLabels = new Set((siblings ?? []).map((row) => row.variant_label));
  const label = nextCopyLabel(source.variant_label, existingLabels);
  const nextOrder = Math.max(0, ...(siblings ?? []).map((row) => row.variant_order)) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("plan_days")
    .insert({
      plan_id: source.plan_id,
      day_of_week: source.day_of_week,
      label: source.label,
      focus: source.focus ?? [],
      is_rest: source.is_rest,
      is_cardio_day: source.is_cardio_day,
      is_priority_day: source.is_priority_day,
      rest_note: source.rest_note,
      note: source.note,
      variant_label: label,
      variant_order: nextOrder,
      is_default: false,
    })
    .select("id")
    .single();

  if (insertError || !inserted) throw new Error(insertError?.message ?? "duplicate failed");

  const { data: items, error: itemsError } = await supabase
    .from("plan_items")
    .select(
      "exercise_id, order_index, target_sets, target_rep_min, target_rep_max, target_duration_min_s, target_duration_max_s, per_side, is_key, note",
    )
    .eq("plan_day_id", parsed.data.id)
    .order("order_index");

  if (itemsError) throw new Error(itemsError.message);

  if (items?.length) {
    const { error: copyError } = await supabase.from("plan_items").insert(
      items.map((item) => ({
        ...item,
        plan_day_id: inserted.id,
      })),
    );
    if (copyError) throw new Error(copyError.message);
  }

  done();
}

export async function deleteVariant(formData: FormData): Promise<void> {
  const parsed = z.object({ id: uuid }).safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("invalid id");

  const supabase = await createClient();
  const { data: target, error: targetError } = await supabase
    .from("plan_days")
    .select("id, plan_id, day_of_week, is_default")
    .eq("id", parsed.data.id)
    .single();
  if (targetError || !target) throw new Error(targetError?.message ?? "variant not found");
  if (target.day_of_week == null) throw new Error("add-on days are not editable in this view yet");

  const [{ count: sessionCount }, { data: siblings }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("plan_day_id", target.id),
    supabase
      .from("plan_days")
      .select("id, variant_order")
      .eq("plan_id", target.plan_id)
      .eq("day_of_week", target.day_of_week)
      .neq("id", target.id)
      .order("variant_order")
      .limit(1),
  ]);

  if ((sessionCount ?? 0) > 0) {
    throw new Error("cannot delete a variant that already has sessions");
  }
  if (!siblings?.length) {
    throw new Error("keep at least one variant for this day");
  }

  const { error } = await supabase.from("plan_days").delete().eq("id", target.id);
  if (error) throw new Error(error.message);

  if (target.is_default) {
    const { error: promoteError } = await supabase
      .from("plan_days")
      .update({ is_default: true })
      .eq("id", siblings[0].id);
    if (promoteError) throw new Error(promoteError.message);
  }

  done();
}

export async function addPlanItem(formData: FormData): Promise<void> {
  const parsed = z
    .object({
      planDayId: uuid,
      exerciseId: z.string().trim().min(1),
    })
    .safeParse({
      planDayId: formData.get("planDayId"),
      exerciseId: formData.get("exerciseId"),
    });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const supabase = await createClient();
  const [{ data: exercise, error: exerciseError }, { data: lastItem, error: orderError }] =
    await Promise.all([
      supabase
        .from("exercises")
        .select("kind, rep_min, rep_max, duration_min_s, duration_max_s, per_side")
        .eq("id", parsed.data.exerciseId)
        .single(),
      supabase
        .from("plan_items")
        .select("order_index")
        .eq("plan_day_id", parsed.data.planDayId)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (exerciseError || !exercise) throw new Error(exerciseError?.message ?? "exercise not found");
  if (orderError) throw new Error(orderError.message);

  const { error } = await supabase.from("plan_items").insert({
    plan_day_id: parsed.data.planDayId,
    exercise_id: parsed.data.exerciseId,
    order_index: (lastItem?.order_index ?? -1) + 1,
    target_sets: exercise.kind === "cardio" ? 1 : 3,
    target_rep_min: exercise.rep_min,
    target_rep_max: exercise.rep_max,
    target_duration_min_s: exercise.duration_min_s,
    target_duration_max_s: exercise.duration_max_s,
    per_side: exercise.per_side,
    is_key: false,
    note: null,
  });
  if (error) throw new Error(error.message);

  done();
}

export async function updatePlanItem(formData: FormData): Promise<void> {
  const parsed = z
    .object({
      id: uuid,
      targetSets: z.coerce.number().int().min(1).max(20),
      targetRepMin: intOrNull,
      targetRepMax: intOrNull,
      targetDurationMinS: intOrNull,
      targetDurationMaxS: intOrNull,
      perSide: z.boolean(),
      isKey: z.boolean(),
      note: z.string().trim().max(240).nullable(),
    })
    .safeParse({
      id: formData.get("id"),
      targetSets: formData.get("targetSets"),
      targetRepMin: formData.get("targetRepMin"),
      targetRepMax: formData.get("targetRepMax"),
      targetDurationMinS: formData.get("targetDurationMinS"),
      targetDurationMaxS: formData.get("targetDurationMaxS"),
      perSide: formData.get("perSide") === "on",
      isKey: formData.get("isKey") === "on",
      note: formData.get("note") || null,
    });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_items")
    .update({
      target_sets: parsed.data.targetSets,
      target_rep_min: parsed.data.targetRepMin,
      target_rep_max: parsed.data.targetRepMax,
      target_duration_min_s: parsed.data.targetDurationMinS,
      target_duration_max_s: parsed.data.targetDurationMaxS,
      per_side: parsed.data.perSide,
      is_key: parsed.data.isKey,
      note: parsed.data.note,
    })
    .eq("id", parsed.data.id);

  if (error) throw new Error(error.message);
  done();
}

export async function removePlanItem(formData: FormData): Promise<void> {
  const parsed = z.object({ id: uuid }).safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("invalid id");

  const supabase = await createClient();
  const { error } = await supabase.from("plan_items").delete().eq("id", parsed.data.id);
  if (error) throw new Error(error.message);

  done();
}

export async function movePlanItem(formData: FormData): Promise<void> {
  const parsed = z
    .object({
      id: uuid,
      direction: z.coerce.number().int().refine((value) => value === -1 || value === 1),
    })
    .safeParse({
      id: formData.get("id"),
      direction: formData.get("direction"),
    });
  if (!parsed.success) throw new Error("invalid move");

  const supabase = await createClient();
  const { data: item, error: itemError } = await supabase
    .from("plan_items")
    .select("id, plan_day_id, order_index")
    .eq("id", parsed.data.id)
    .single();
  if (itemError || !item) throw new Error(itemError?.message ?? "item not found");

  const neighborQuery = supabase
    .from("plan_items")
    .select("id, order_index")
    .eq("plan_day_id", item.plan_day_id)
    .order("order_index", { ascending: parsed.data.direction === 1 })
    .limit(1);

  const { data: neighbor, error: neighborError } =
    parsed.data.direction === -1
      ? await neighborQuery.lt("order_index", item.order_index).maybeSingle()
      : await neighborQuery.gt("order_index", item.order_index).maybeSingle();
  if (neighborError) throw new Error(neighborError.message);
  if (!neighbor) return;

  const tempOrder = -1_000_000_000 + Math.floor(Math.random() * 1_000_000);
  const { error: tempError } = await supabase
    .from("plan_items")
    .update({ order_index: tempOrder })
    .eq("id", item.id);
  if (tempError) throw new Error(tempError.message);

  const { error: neighborUpdateError } = await supabase
    .from("plan_items")
    .update({ order_index: item.order_index })
    .eq("id", neighbor.id);
  if (neighborUpdateError) throw new Error(neighborUpdateError.message);

  const { error } = await supabase
    .from("plan_items")
    .update({ order_index: neighbor.order_index })
    .eq("id", item.id);
  if (error) throw new Error(error.message);

  done();
}

function nextCopyLabel(base: string, existing: Set<string>) {
  for (let i = 2; i < 100; i++) {
    const label = `${base} ${i}`;
    if (!existing.has(label)) return label;
  }
  return `${base} copy`;
}
