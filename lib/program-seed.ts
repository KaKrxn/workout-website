import seedJson from "@/Report/data/program-seed.json";

/**
 * Typed view over Report/data/program-seed.json.
 *
 * The JSON is the single source of truth for the training programs — it is used
 * both to generate supabase/seed.sql (the global exercise library) and to
 * provision a new user's plans. Do not restate its contents anywhere else.
 */

export type ExerciseKind = "strength" | "bodyweight" | "cardio" | "duration";

export type Muscle =
  | "back_lat" | "shoulders" | "chest" | "legs"
  | "arms" | "core" | "glutes" | "cardio" | "neck";

export interface SeedExercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  muscle: Muscle;
  secondary?: string[];
  equipment?: string[];
  repRange?: [number, number];
  durationRangeS?: [number, number];
  holdS?: [number, number];
  perSide?: boolean;
  isKeyLift?: boolean;
  note?: string;
}

export interface SeedPlanItem {
  exerciseId: string;
  sets: number;
  reps?: [number, number];
  durationS?: [number, number];
  holdS?: [number, number];
  perSide?: boolean;
  isKey?: boolean;
  note?: string;
}

export interface SeedPlanDay {
  dayOfWeek: number | null;
  label: string;
  isRest: boolean;
  isCardioDay?: boolean;
  isPriorityDay?: boolean;
  focus?: string[];
  restNote?: string;
  note?: string;
  items: SeedPlanItem[];
}

export interface SeedPlan {
  id: string;
  name: string;
  splitType: string;
  isDefault: boolean;
  useWhen: string;
  note?: string;
  days: SeedPlanDay[];
}

export interface ProgramSeed {
  version: string;
  profile: {
    equipment: { id: string; name: string; maxWeightKg?: number; incline?: boolean }[];
    musclePriority: Muscle[];
    weeklyTarget: {
      strengthDays: number;
      cardioSessions: number;
      cardioMinutesMin: number;
      cardioMinutesMax: number;
    };
    intensityRule: { type: string; min: number; max: number; note: string };
  };
  exercises: SeedExercise[];
  plans: SeedPlan[];
  progressiveOverload: {
    rule: string;
    weightIncrementKg: number;
    deloadTrigger: { stalledWeeks: number; action: string };
  };
  bodyMetrics: {
    id: string;
    label: string;
    unit: string;
    cadence: string;
    direction: "up" | "down";
    target?: number;
    formula?: string;
    note?: string;
  }[];
  cardioTarget: { sessionsPerWeek: [number, number]; minutesPerSession: [number, number] };
}

export const SEED = seedJson as unknown as ProgramSeed;

export const PLAN_A_ID = "plan_a_bodyweight";
export const PLAN_B_ID = "plan_b_dumbbell";
export const ADDON_NECK_ID = "addon_neck";

export const getSeedPlan = (seedId: string) =>
  SEED.plans.find((p) => p.id === seedId);

/** The dumbbell ceiling, used by the progression logic (03-ui-spec.md §2.4). */
export const DUMBBELL_MAX_KG =
  SEED.profile.equipment.find((e) => e.id === "dumbbell_adj_25")?.maxWeightKg ?? 25;

export const WEIGHT_INCREMENT_KG = SEED.progressiveOverload.weightIncrementKg;
export const DELOAD_STALLED_WEEKS = SEED.progressiveOverload.deloadTrigger.stalledWeeks;

/**
 * Muscle-group priority for the V-taper goal (Report/01-product-spec.md §2).
 * Fixed order — the balance chart sorts by this, never by value
 * (Report/04-analytics-spec.md G6).
 */
export const MUSCLE_PRIORITY = SEED.profile.musclePriority;

/**
 * Which day of program A stands in for which day of program B.
 *
 * The pairing is by muscle focus, not by weekday, which is what lets the streak
 * survive a swap: the system counts "this muscle group was trained", not "this
 * exercise was performed" (Report/01-product-spec.md §5.1).
 *
 * Keyed by program B's day_of_week, valued with program A's.
 */
export const AB_DAY_PAIRING: Record<number, number> = {
  1: 1, // chest + shoulders + triceps
  2: 3, // back
  3: 2, // legs
  4: 4, // cardio day ⇄ rest day — A has no cardio session
  5: 5, // upper body
  6: 6, // legs + core
  0: 0, // rest
};

/** Inverse of AB_DAY_PAIRING, for swapping back from A to B. */
export const BA_DAY_PAIRING: Record<number, number> = Object.fromEntries(
  Object.entries(AB_DAY_PAIRING).map(([b, a]) => [a, Number(b)]),
);
