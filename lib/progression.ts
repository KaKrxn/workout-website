import { DUMBBELL_MAX_KG, WEIGHT_INCREMENT_KG } from "@/lib/program-seed";
import type { ExerciseKind } from "@/lib/program-seed";

export interface ProgressionSet {
  setIndex: number;
  side: "left" | "right" | null;
  reps: number | null;
  weightKg: number | null;
  durationS: number | null;
  isWarmup?: boolean;
}

export type ProgressionKind =
  | "new"
  | "repeat"
  | "add_weight"
  | "ceiling"
  | "deload"
  | "unsupported";

export interface ProgressionTarget {
  kind: ProgressionKind;
  lastLine: string | null;
  todayLine: string;
  badge: string | null;
  targetReps: number[] | null;
  targetDurationS: number[] | null;
  targetWeightKg: number | null;
}

export function computeProgressionTarget({
  kind,
  previousSets,
  repMin,
  repMax,
  durationMinS,
  durationMaxS,
  weightIncrementKg = WEIGHT_INCREMENT_KG,
  maxWeightKg = DUMBBELL_MAX_KG,
  stalledWeeks = 0,
}: {
  kind: ExerciseKind;
  previousSets: ProgressionSet[];
  repMin: number | null;
  repMax: number | null;
  durationMinS: number | null;
  durationMaxS: number | null;
  weightIncrementKg?: number;
  maxWeightKg?: number | null;
  stalledWeeks?: number;
}): ProgressionTarget {
  const workSets = previousSets
    .filter((set) => !set.isWarmup)
    .sort((a, b) => a.setIndex - b.setIndex || sideOrder(a.side) - sideOrder(b.side));

  if (workSets.length === 0) {
    return {
      kind: "new",
      lastLine: null,
      todayLine:
        kind === "duration" || kind === "cardio"
          ? durationRange(durationMinS, durationMaxS)
          : kind === "strength"
          ? "Start with a weight you can do about 10 reps with, leaving 2-3 RIR"
          : "Start inside the target range and leave 1-3 RIR",
      badge: null,
      targetReps: null,
      targetDurationS: null,
      targetWeightKg: null,
    };
  }

  if (kind === "duration" || kind === "cardio") {
    const durations = workSets.map((set) => set.durationS).filter((v): v is number => v != null);
    if (durations.length === 0) return unsupported("No previous duration");
    const maxDuration = durationMaxS ?? Math.max(...durations);
    const targetDurationS = durations.map((duration) => Math.min(duration + 5, maxDuration));
    return {
      kind: "repeat",
      lastLine: durations.map(formatSeconds).join(" / "),
      todayLine: targetDurationS.map(formatSeconds).join(" / "),
      badge: null,
      targetReps: null,
      targetDurationS,
      targetWeightKg: null,
    };
  }

  const reps = workSets.map((set) => set.reps).filter((v): v is number => v != null);
  if (reps.length === 0 || repMax == null) return unsupported("No previous reps");

  const weightKg = latestWeight(workSets);
  const lastLine =
    weightKg == null
      ? reps.join(" / ")
      : `${formatWeight(weightKg)} x ${reps.join(" / ")}`;

  if (stalledWeeks >= 3 && weightKg != null) {
    const deloadWeight = roundToIncrement(weightKg * 0.9, weightIncrementKg);
    return {
      kind: "deload",
      lastLine,
      todayLine: `${formatWeight(deloadWeight)} x ${(repMin ?? Math.max(1, repMax - 4))}-${repMax}`,
      badge: "Deload",
      targetReps: null,
      targetDurationS: null,
      targetWeightKg: deloadWeight,
    };
  }

  const allAtTop = reps.every((rep) => rep >= repMax);
  if (kind === "strength" && allAtTop && weightKg != null) {
    const nextWeight = roundToIncrement(weightKg + weightIncrementKg, weightIncrementKg);
    if (maxWeightKg != null && nextWeight > maxWeightKg) {
      return {
        kind: "ceiling",
        lastLine,
        todayLine: `${formatWeight(weightKg)} x ${repMin ?? repMax}-${Math.min(repMax, (repMin ?? repMax) + 2)}`,
        badge: "Ceiling",
        targetReps: null,
        targetDurationS: null,
        targetWeightKg: weightKg,
      };
    }

    return {
      kind: "add_weight",
      lastLine,
      todayLine: `${formatWeight(nextWeight)} x ${repMin ?? repMax}-${Math.min(repMax, (repMin ?? repMax) + 2)}`,
      badge: "+weight ready",
      targetReps: null,
      targetDurationS: null,
      targetWeightKg: nextWeight,
    };
  }

  const targetReps = reps.map((rep) => Math.min(rep + 1, repMax));
  return {
    kind: allAtTop ? "repeat" : "repeat",
    lastLine,
    todayLine:
      kind === "strength" && weightKg != null
        ? `${formatWeight(weightKg)} x ${targetReps.join(" / ")}`
        : targetReps.join(" / "),
    badge: null,
    targetReps,
    targetDurationS: null,
    targetWeightKg: weightKg,
  };
}

export function roundToIncrement(value: number, increment: number) {
  if (increment <= 0) return value;
  return Math.round(value / increment) * increment;
}

function latestWeight(sets: ProgressionSet[]) {
  return sets.findLast((set) => set.weightKg != null)?.weightKg ?? null;
}

function sideOrder(side: "left" | "right" | null) {
  if (side === "left") return 0;
  if (side === "right") return 1;
  return -1;
}

function formatWeight(value: number) {
  return `${Number(value.toFixed(2))} kg`;
}

function formatSeconds(value: number) {
  return value >= 120 ? `${Math.round(value / 60)} min` : `${value} sec`;
}

function durationRange(min: number | null, max: number | null) {
  if (min == null) return "Start inside the target range and leave 1-3 RIR";
  if (max == null || max === min) return formatSeconds(min);
  return `${formatSeconds(min)}-${formatSeconds(max)}`;
}

function unsupported(reason: string): ProgressionTarget {
  return {
    kind: "unsupported",
    lastLine: null,
    todayLine: reason,
    badge: null,
    targetReps: null,
    targetDurationS: null,
    targetWeightKg: null,
  };
}
