import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ExerciseKind, Muscle } from "@/lib/program-seed";

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
    restNote: string | null;
    note: string | null;
  } | null;
  planName: string | null;
  planSeedId: string | null;
  exercises: TodayExercise[];
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
  };

  const { data: session } = await supabase
    .from("sessions")
    .select(
      `id, status, started_at, ended_at, plan_day_id, plan_id,
       plan_days ( id, label, focus, is_rest, is_cardio_day, is_priority_day, rest_note, note ),
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
          restNote: planDay.rest_note,
          note: planDay.note,
        }
      : null,
    planName: session.plans?.name ?? null,
    planSeedId: session.plans?.seed_id ?? null,
    exercises: [],
  };

  if (!planDay) return result;

  const [{ data: items }, { data: sets }] = await Promise.all([
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
        "id, client_id, exercise_id, set_index, side, reps, weight_kg, duration_s, distance_m, incline_pct, rir, is_warmup",
      )
      .eq("session_id", session.id)
      .order("set_index"),
  ]);

  const setsByExercise = new Map<string, LoggedSet[]>();
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
  }

  result.exercises = (items ?? []).map((item) => ({
    planItemId: item.id,
    exerciseId: item.exercise_id,
    name: item.exercises?.name ?? item.exercise_id,
    kind: (item.exercises?.kind ?? "strength") as ExerciseKind,
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
  }));

  return result;
}
