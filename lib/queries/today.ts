import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ExerciseKind, Muscle } from "@/lib/program-seed";
import {
  computeProgressionTarget,
  type ProgressionSet,
  type ProgressionTarget,
} from "@/lib/progression";

export type Client = SupabaseClient<Database>;

export interface LoggedSet {
  id: string;
  /** Reused when editing, so the upsert updates in place instead of inserting a duplicate. */
  clientId: string;
  setIndex: number;
  side: "left" | "right" | null;
  reps: number | null;
  weightKg: number | null;
  durationS: number | null;
  distanceM: number | null;
  inclinePct: number | null;
  rir: number | null;
  isWarmup: boolean;
}

export interface TodayExercise {
  planItemId: string;
  exerciseId: string;
  name: string;
  kind: ExerciseKind;
  muscle: Muscle;
  targetSets: number;
  repMin: number | null;
  repMax: number | null;
  durationMinS: number | null;
  durationMaxS: number | null;
  perSide: boolean;
  isKey: boolean;
  note: string | null;
  sets: LoggedSet[];
  progression: ProgressionTarget | null;
}

export interface TodayPlanVariant {
  id: string;
  label: string;
  variantLabel: string;
  variantOrder: number;
  isDefault: boolean;
  isRest: boolean;
  exerciseCount: number;
}

export interface TodayWorkout {
  date: string;
  session: {
    id: string;
    status: "planned" | "completed" | "skipped" | "partial";
    startedAt: string | null;
    endedAt: string | null;
  } | null;
  planDay: {
    id: string;
    label: string;
    focus: string[];
    isRest: boolean;
    isCardioDay: boolean;
    isPriorityDay: boolean;
    variantLabel: string;
    isDefault: boolean;
    restNote: string | null;
    note: string | null;
  } | null;
  planName: string | null;
  planSeedId: string | null;
  exercises: TodayExercise[];
  variants: TodayPlanVariant[];
  offPlanExercises: TodayExercise[];
}

/**
 * Everything the Today page needs for one date.
 *
 * Reads through the user's own client, so RLS scopes it — there is no
 * `user_id` filter here on purpose, and adding one would be redundant.
 */
export async function getWorkoutForDate(
  supabase: Client,
  date: string,
): Promise<TodayWorkout> {
  const empty: TodayWorkout = {
    date,
    session: null,
    planDay: null,
    planName: null,
    planSeedId: null,
    exercises: [],
    variants: [],
    offPlanExercises: [],
  };

  const { data: session } = await supabase
    .from("sessions")
    .select(
      `id, status, started_at, ended_at, plan_day_id, plan_id,
       plan_days ( id, day_of_week, label, focus, is_rest, is_cardio_day, is_priority_day, variant_label, variant_order, is_default, rest_note, note ),
       plans ( name, seed_id )`,
    )
    .eq("date", date)
    .order("status", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!session) return empty;

  const planDay = session.plan_days;

  const result: TodayWorkout = {
    date,
    session: {
      id: session.id,
      status: session.status as TodayWorkout["session"] extends null
        ? never
        : "planned" | "completed" | "skipped" | "partial",
      startedAt: session.started_at,
      endedAt: session.ended_at,
    },
    planDay: planDay
      ? {
          id: planDay.id,
          label: planDay.label,
          focus: planDay.focus ?? [],
          isRest: planDay.is_rest,
          isCardioDay: planDay.is_cardio_day,
          isPriorityDay: planDay.is_priority_day,
          variantLabel: planDay.variant_label,
          isDefault: planDay.is_default,
          restNote: planDay.rest_note,
          note: planDay.note,
        }
      : null,
    planName: session.plans?.name ?? null,
    planSeedId: session.plans?.seed_id ?? null,
    exercises: [],
    variants: [],
    offPlanExercises: [],
  };

  if (!planDay) return result;

  const variantsQuery =
    session.plan_id && planDay.day_of_week != null
      ? supabase
          .from("plan_days")
          .select("id, label, variant_label, variant_order, is_default, is_rest, plan_items ( id )")
          .eq("plan_id", session.plan_id)
          .eq("day_of_week", planDay.day_of_week)
          .order("variant_order")
      : Promise.resolve({ data: [] });

  const [{ data: variants }, { data: items }, { data: sets }] = await Promise.all([
    variantsQuery,
    supabase
      .from("plan_items")
      .select(
        `id, exercise_id, order_index, target_sets, target_rep_min, target_rep_max,
         target_duration_min_s, target_duration_max_s, per_side, is_key, note,
         exercises ( name, kind, muscle )`,
      )
      .eq("plan_day_id", planDay.id)
      .order("order_index"),
    supabase
      .from("session_sets")
      .select(
        "id, client_id, exercise_id, set_index, side, reps, weight_kg, duration_s, distance_m, incline_pct, rir, is_warmup, exercises ( name, kind, muscle )",
      )
      .eq("session_id", session.id)
      .order("set_index"),
  ]);

  result.variants = (variants ?? []).map((variant) => ({
    id: variant.id,
    label: variant.label,
    variantLabel: variant.variant_label,
    variantOrder: variant.variant_order,
    isDefault: variant.is_default,
    isRest: variant.is_rest,
    exerciseCount: variant.plan_items?.length ?? 0,
  }));

  const previousSetsByExercise = await getPreviousSetsByExercise(
    supabase,
    date,
    (items ?? []).map((item) => item.exercise_id),
  );

  const setsByExercise = new Map<string, LoggedSet[]>();
  const exerciseMeta = new Map<string, { name: string; kind: ExerciseKind; muscle: Muscle }>();
  for (const s of sets ?? []) {
    const list = setsByExercise.get(s.exercise_id) ?? [];
    list.push({
      id: s.id,
      clientId: s.client_id,
      setIndex: s.set_index,
      side: s.side as LoggedSet["side"],
      reps: s.reps,
      weightKg: s.weight_kg,
      durationS: s.duration_s,
      distanceM: s.distance_m,
      inclinePct: s.incline_pct,
      rir: s.rir,
      isWarmup: s.is_warmup,
    });
    setsByExercise.set(s.exercise_id, list);
    exerciseMeta.set(s.exercise_id, {
      name: s.exercises?.name ?? s.exercise_id,
      kind: (s.exercises?.kind ?? "strength") as ExerciseKind,
      muscle: (s.exercises?.muscle ?? "chest") as Muscle,
    });
  }

  const plannedExerciseIds = new Set((items ?? []).map((item) => item.exercise_id));

  result.exercises = (items ?? []).map((item) => {
    const kind = (item.exercises?.kind ?? "strength") as ExerciseKind;
    return {
      planItemId: item.id,
      exerciseId: item.exercise_id,
      name: item.exercises?.name ?? item.exercise_id,
      kind,
      muscle: (item.exercises?.muscle ?? "chest") as Muscle,
      targetSets: item.target_sets,
      repMin: item.target_rep_min,
      repMax: item.target_rep_max,
      durationMinS: item.target_duration_min_s,
      durationMaxS: item.target_duration_max_s,
      perSide: item.per_side,
      isKey: item.is_key,
      note: item.note,
      sets: setsByExercise.get(item.exercise_id) ?? [],
      progression: computeProgressionTarget({
        kind,
        previousSets: previousSetsByExercise.get(item.exercise_id) ?? [],
        repMin: item.target_rep_min,
        repMax: item.target_rep_max,
        durationMinS: item.target_duration_min_s,
        durationMaxS: item.target_duration_max_s,
      }),
    };
  });

  result.offPlanExercises = Array.from(setsByExercise.entries())
    .filter(([exerciseId]) => !plannedExerciseIds.has(exerciseId))
    .map(([exerciseId, loggedSets]) => {
      const meta = exerciseMeta.get(exerciseId);
      return {
        planItemId: `off-plan-${exerciseId}`,
        exerciseId,
        name: meta?.name ?? exerciseId,
        kind: meta?.kind ?? "strength",
        muscle: meta?.muscle ?? "chest",
        targetSets: Math.max(...loggedSets.map((set) => set.setIndex), loggedSets.length, 1),
        repMin: null,
        repMax: null,
        durationMinS: null,
        durationMaxS: null,
        perSide: loggedSets.some((set) => set.side != null),
        isKey: false,
        note: "Logged in this session, but not part of the selected plan variant.",
        sets: loggedSets,
        progression: null,
      };
    });

  return result;
}

async function getPreviousSetsByExercise(
  supabase: Client,
  date: string,
  exerciseIds: string[],
): Promise<Map<string, ProgressionSet[]>> {
  const byExercise = new Map<string, {
    sessionId: string;
    sets: ProgressionSet[];
  }>();

  if (exerciseIds.length === 0) return new Map();

  const { data } = await supabase
    .from("session_sets")
    .select(
      `exercise_id, set_index, side, reps, weight_kg, duration_s, is_warmup,
       sessions!inner ( id, date, status )`,
    )
    .in("exercise_id", exerciseIds)
    .lt("sessions.date", date)
    .in("sessions.status", ["completed", "partial"])
    .order("completed_at", { ascending: false })
    .limit(200);

  for (const row of data ?? []) {
    const session = row.sessions;
    if (!session) continue;

    const current = byExercise.get(row.exercise_id);
    if (current && current.sessionId !== session.id) continue;

    const entry = current ?? { sessionId: session.id, sets: [] };
    entry.sets.push({
      setIndex: row.set_index,
      side: row.side as "left" | "right" | null,
      reps: row.reps,
      weightKg: row.weight_kg,
      durationS: row.duration_s,
      isWarmup: row.is_warmup,
    });
    byExercise.set(row.exercise_id, entry);
  }

  return new Map(Array.from(byExercise.entries()).map(([exerciseId, entry]) => [exerciseId, entry.sets]));
}
