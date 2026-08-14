"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { TodayExercise } from "@/lib/queries/today";
import { SetRow, type SetSlot } from "./set-row";

/** `4 เซ็ต × 8–12 ครั้ง` / `3 เซ็ต × 30–60 วินาที` — the second line of the row. */
function targetLine(ex: TodayExercise): string {
  const sets = `${ex.targetSets} เซ็ต`;
  if (ex.kind === "duration" || ex.kind === "cardio") {
    const [a, b] = [ex.durationMinS, ex.durationMaxS];
    if (a == null) return sets;
    const fmt = (s: number) => (s >= 120 ? `${Math.round(s / 60)} นาที` : `${s} วินาที`);
    return `${sets} × ${a === b || b == null ? fmt(a) : `${fmt(a)}–${fmt(b)}`}`;
  }
  const [a, b] = [ex.repMin, ex.repMax];
  if (a == null) return sets;
  const range = a === b || b == null ? `${a}` : `${a}–${b}`;
  return `${sets} × ${range} ครั้ง${ex.perSide ? " ต่อข้าง" : ""}`;
}

/** Right-hand summary of what has actually been logged so far. */
function loggedSummary(ex: TodayExercise): string | null {
  if (ex.sets.length === 0) return null;
  if (ex.kind === "duration" || ex.kind === "cardio") {
    return ex.sets.map((s) => (s.durationS != null ? `${s.durationS}วิ` : "—")).join(" / ");
  }
  return ex.sets.map((s) => s.reps ?? "—").join(" / ");
}

/** The plan asks for N sets; per-side exercises need a left and a right for each. */
function buildSlots(ex: TodayExercise): SetSlot[] {
  const sides: ("left" | "right" | null)[] = ex.perSide ? ["left", "right"] : [null];
  const planned: SetSlot[] = [];

  for (let i = 1; i <= ex.targetSets; i++) {
    for (const side of sides) {
      planned.push({
        setIndex: i,
        side,
        logged: ex.sets.find((s) => s.setIndex === i && s.side === side) ?? null,
      });
    }
  }

  // Anything logged beyond the plan still has to be shown, not silently dropped.
  for (const s of ex.sets) {
    if (!planned.some((p) => p.setIndex === s.setIndex && p.side === s.side)) {
      planned.push({ setIndex: s.setIndex, side: s.side, logged: s });
    }
  }

  return planned.sort((a, b) => a.setIndex - b.setIndex || (a.side ?? "").localeCompare(b.side ?? ""));
}

export function ExerciseRow({
  exercise,
  sessionId,
  defaultOpen = false,
}: {
  exercise: TodayExercise;
  sessionId: string;
  defaultOpen?: boolean;
}) {
  const slots = buildSlots(exercise);
  const expectedSlots = exercise.targetSets * (exercise.perSide ? 2 : 1);
  const complete = exercise.sets.length >= expectedSlots;

  const [open, setOpen] = useState(defaultOpen || (!complete && exercise.sets.length > 0));

  const summary = loggedSummary(exercise);
  const lastWeightKg = exercise.sets.findLast((s) => s.weightKg != null)?.weightKg ?? null;

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Hit target is the full row, comfortably over 44px (03-ui-spec.md §8) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 py-3 text-left"
      >
        <span
          className={cn(
            "mt-0.5 grid size-[22px] flex-none place-items-center rounded-[7px] border-[1.8px] transition",
            complete ? "border-good bg-good" : "border-axis",
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className={cn("size-3 transition-opacity", complete ? "opacity-100" : "opacity-0")}
            fill="none"
            stroke="#fff"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12.5 9.5 18 20 6.5" />
          </svg>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold">
            {exercise.isKey && (
              <span className="size-1.5 flex-none rounded-full bg-s1" aria-label="ท่าหลัก" />
            )}
            <span className={cn("truncate", complete && "text-label line-through")}>
              {exercise.name}
            </span>
          </span>
          <span className="mt-px block text-[12px] tabular-nums text-label">
            {targetLine(exercise)}
          </span>
          {exercise.note && (
            <span className="mt-1 block text-[11.5px] leading-snug text-text-2">
              {exercise.note}
            </span>
          )}
        </span>

        <span className="flex-none pl-2 text-right text-[12px] tabular-nums text-text-2">
          {summary ? (
            <>
              <span className="block text-[10.5px] uppercase tracking-[0.06em] text-label">
                บันทึกแล้ว
              </span>
              <b className="block text-text-1">{summary}</b>
            </>
          ) : (
            <span className="text-label">
              {exercise.sets.length}/{expectedSlots}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="pb-3 pl-[34px] pr-1">
          {slots.map((slot) => (
            <SetRow
              key={`${slot.setIndex}-${slot.side ?? "both"}`}
              exercise={exercise}
              slot={slot}
              sessionId={sessionId}
              lastWeightKg={lastWeightKg}
            />
          ))}
        </div>
      )}
    </div>
  );
}
