"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { TodayExercise } from "@/lib/queries/today";
import { SetRow, type SetSlot } from "./set-row";

/** `4 x 8-12` / `3 x 30-60 sec` — the second line of the row. */
function targetLine(ex: TodayExercise): string {
  const sets = `${ex.targetSets}`;
  if (ex.kind === "duration" || ex.kind === "cardio") {
    const [a, b] = [ex.durationMinS, ex.durationMaxS];
    if (a == null) return sets;
    const fmt = (s: number) => (s >= 120 ? `${Math.round(s / 60)} minutes` : `${s} sec`);
    return `${a === b || b == null ? fmt(a) : `${fmt(a)}-${fmt(b)}`}`;
  }
  const [a, b] = [ex.repMin, ex.repMax];
  if (a == null) return sets;
  const range = a === b || b == null ? `${a}` : `${a}-${b}`;
  return `${sets} x ${range}${ex.perSide ? " per side" : ""}`;
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
    <article
      className={cn(
        "rounded-[20px] border border-border bg-surface",
        open && "bg-[#121a14]/95",
      )}
    >
      {/* Hit target is the full row, comfortably over 44px (03-ui-spec.md §8) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[clamp(12px,1.2vw,20px)] p-[clamp(14px,1.45vw,22px)] text-left"
      >
        <span
          className={cn(
            "grid size-[clamp(38px,3.5vw,56px)] flex-none place-items-center rounded-[12px] border-[1.8px] transition",
            complete ? "border-[#5fd482] bg-s1 text-on-accent" : "border-white/70 bg-surface-2 text-text-1",
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className={cn("size-[54%] transition-opacity", complete ? "opacity-100" : "opacity-100")}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {complete ? <path d="M4 12.5 9.5 18 20 6.5" /> : <circle cx="12" cy="12" r="7.5" strokeWidth={2} />}
          </svg>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[clamp(17px,1.65vw,27px)] font-extrabold">
            {exercise.isKey && (
              <span className="size-2 flex-none rounded-full bg-s1" aria-label="ท่าหลัก" />
            )}
            <span className={cn("truncate", complete && "text-text-2")}>
              {exercise.name}
            </span>
          </span>
          <span className="mt-1 block text-[clamp(14px,1.25vw,20px)] tabular-nums text-text-2">
            {targetLine(exercise)}
          </span>
          {exercise.note && (
            <span className="mt-1 block text-[12px] leading-snug text-text-2">
              {exercise.note}
            </span>
          )}
          {exercise.progression && (
            <span className="mt-2 grid gap-1 text-[12px] leading-snug text-text-2 min-[640px]:grid-cols-2">
              <span>
                <b className="text-text-1">Last time</b>{" "}
                {exercise.progression.lastLine ?? "No previous session"}
              </span>
              <span>
                <b className="text-text-1">Today</b> {exercise.progression.todayLine}
              </span>
            </span>
          )}
        </span>

        <span className="flex-none pl-2 text-right text-[clamp(14px,1.25vw,20px)] tabular-nums text-text-1">
          {exercise.progression?.badge && (
            <span className="mb-1 block rounded-full bg-[#eb6834]/15 px-2 py-1 text-[11px] font-extrabold text-[#ff946f]">
              {exercise.progression.badge}
            </span>
          )}
          {summary ? (
            <>
              <b className="block font-medium text-text-1">{summary}</b>
            </>
          ) : (
            <span className="text-text-2">
              {exercise.sets.length}/{expectedSlots}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="pb-[clamp(14px,1.4vw,22px)] pl-[clamp(58px,5vw,86px)] pr-[clamp(14px,1.45vw,22px)]">
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
    </article>
  );
}
