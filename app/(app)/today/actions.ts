"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * A logged set.
 *
 * `clientId` is generated in the browser so a replayed request — an offline
 * queue flushing twice, a double tap — is absorbed by the unique index rather
 * than creating a duplicate (Report/02-data-model.md §9).
 */
const logSetSchema = z.object({
  sessionId: z.string().uuid(),
  exerciseId: z.string().min(1),
  clientId: z.string().uuid(),
  setIndex: z.number().int().min(1).max(50),
  side: z.enum(["left", "right"]).nullable().default(null),
  reps: z.number().int().min(0).max(999).nullable().default(null),
  weightKg: z.number().min(0).max(999).nullable().default(null),
  durationS: z.number().int().min(0).max(86400).nullable().default(null),
  distanceM: z.number().min(0).max(1_000_000).nullable().default(null),
  inclinePct: z.number().min(0).max(100).nullable().default(null),
  rir: z.number().int().min(0).max(5).nullable().default(null),
  isWarmup: z.boolean().default(false),
});

export type LogSetInput = z.input<typeof logSetSchema>;

export async function logSet(input: LogSetInput): Promise<ActionResult> {
  const parsed = logSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const v = parsed.data;
  const supabase = await createClient();

  // RLS checks the session belongs to the caller; no user_id needed here.
  const { error } = await supabase.from("session_sets").upsert(
    {
      session_id: v.sessionId,
      exercise_id: v.exerciseId,
      client_id: v.clientId,
      set_index: v.setIndex,
      side: v.side,
      reps: v.reps,
      weight_kg: v.weightKg,
      duration_s: v.durationS,
      distance_m: v.distanceM,
      incline_pct: v.inclinePct,
      rir: v.rir,
      is_warmup: v.isWarmup,
    },
    { onConflict: "client_id" },
  );

  if (error) return { ok: false, error: error.message };

  // First set logged implicitly starts the session.
  await supabase
    .from("sessions")
    .update({ status: "partial", started_at: new Date().toISOString() })
    .eq("id", v.sessionId)
    .eq("status", "planned");

  revalidatePath("/today");
  return { ok: true };
}

export async function deleteSet(setId: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(setId).success) {
    return { ok: false, error: "invalid id" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("session_sets").delete().eq("id", setId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/today");
  return { ok: true };
}

export async function startSession(sessionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({ status: "partial", started_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("status", "planned");

  if (error) return { ok: false, error: error.message };
  revalidatePath("/today");
  return { ok: true };
}

export async function finishSession(sessionId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/today");
  revalidatePath("/history");
  return { ok: true };
}
