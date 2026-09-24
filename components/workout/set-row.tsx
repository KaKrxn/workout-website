"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { LoggedSet, TodayExercise } from "@/lib/queries/today";
import { logSet, deleteSet } from "@/app/(app)/today/actions";

export interface SetSlot {
  setIndex: number;
  side: "left" | "right" | null;
  logged: LoggedSet | null;
}

/** Placeholder shown before anything has been logged, preferring the computed target. */
function suggest(exercise: TodayExercise, slot: SetSlot) {
  const index = exercise.perSide
    ? (slot.setIndex - 1) * 2 + (slot.side === "right" ? 1 : 0)
    : slot.setIndex - 1;

  if (exercise.kind === "duration" || exercise.kind === "cardio") {
    return {
      field: "durationS",
      value: exercise.progression?.targetDurationS?.[index] ?? exercise.durationMinS,
    };
  }

  return {
    field: "reps",
    value: exercise.progression?.targetReps?.[index] ?? exercise.repMin,
  };
}

const NumberField = ({
  label,
  value,
  onChange,
  step = 1,
  suffix,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: number;
  suffix?: string;
  placeholder?: string;
}) => (
  <label className="flex min-w-0 flex-1 flex-col gap-2">
    <span className="text-[clamp(13px,1.15vw,19px)] font-medium text-text-2">{label}</span>
    <span className="flex items-center gap-1">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 rounded-[9px] border border-white/[0.06] bg-surface-2 px-3 py-[clamp(9px,1vw,14px)] text-[clamp(16px,1.35vw,24px)] font-bold tabular-nums text-text-1"
      />
      {suffix && <span className="flex-none text-[clamp(11px,1vw,15px)] text-text-2">{suffix}</span>}
    </span>
  </label>
);

export function SetRow({
  exercise,
  slot,
  sessionId,
  lastWeightKg,
}: {
  exercise: TodayExercise;
  slot: SetSlot;
  sessionId: string;
  lastWeightKg: number | null;
}) {
  const { logged } = slot;
  const hint = suggest(exercise, slot);

  const [reps, setReps] = useState(logged?.reps?.toString() ?? "");
  const [weight, setWeight] = useState(
    logged?.weightKg?.toString() ?? (lastWeightKg != null ? String(lastWeightKg) : ""),
  );
  const [duration, setDuration] = useState(logged?.durationS?.toString() ?? "");
  const [distance, setDistance] = useState(logged?.distanceM?.toString() ?? "");
  const [incline, setIncline] = useState(logged?.inclinePct?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const num = (s: string) => (s.trim() === "" ? null : Number(s));

  const save = () => {
    setError(null);
    startTransition(async () => {
      const res = await logSet({
        sessionId,
        exerciseId: exercise.exerciseId,
        // Reuse the id when editing so the upsert lands on the same row.
        clientId: logged?.clientId ?? crypto.randomUUID(),
        setIndex: slot.setIndex,
        side: slot.side,
        reps: num(reps),
        weightKg: num(weight),
        durationS: num(duration),
        distanceM: num(distance),
        inclinePct: num(incline),
      });
      if (!res.ok) setError(res.error);
    });
  };

  const remove = () => {
    if (!logged) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteSet(logged.id);
      if (!res.ok) setError(res.error);
    });
  };

  const done = logged !== null;

  return (
    <div className="border-t border-white/45 py-[clamp(12px,1.2vw,18px)] first:border-t-0">
      <div className="flex items-end gap-[clamp(10px,1.1vw,18px)]">
        <span className="w-[clamp(66px,6vw,110px)] flex-none pb-3 text-[clamp(13px,1.15vw,19px)] font-medium tabular-nums text-text-2">
          {slot.side ? (slot.side === "left" ? "Left" : "Right") : `Set ${slot.setIndex}`}
        </span>

        {exercise.kind === "strength" && (
          <>
            <NumberField label="kg" value={weight} onChange={setWeight} step={2.5} />
            <NumberField
              label="Reps"
              value={reps}
              onChange={setReps}
              placeholder={hint.value?.toString()}
            />
          </>
        )}

        {exercise.kind === "bodyweight" && (
          <NumberField
            label="Reps"
            value={reps}
            onChange={setReps}
            placeholder={hint.value?.toString()}
          />
        )}

        {exercise.kind === "duration" && (
          <NumberField
            label="Time"
            value={duration}
            onChange={setDuration}
            step={5}
            suffix="sec"
            placeholder={exercise.durationMinS?.toString()}
          />
        )}

        {exercise.kind === "cardio" && (
          <>
            <NumberField
              label="Time"
              value={duration}
              onChange={setDuration}
              step={60}
              suffix="sec"
              placeholder={exercise.durationMinS?.toString()}
            />
            <NumberField label="Distance" value={distance} onChange={setDistance} step={100} suffix="m" />
            <NumberField label="Incline" value={incline} onChange={setIncline} step={0.5} suffix="%" />
          </>
        )}

        <button
          type="button"
          onClick={save}
          disabled={pending}
          aria-label={done ? `บันทึกการแก้ไขเซ็ต ${slot.setIndex}` : `บันทึกเซ็ต ${slot.setIndex}`}
          className={cn(
            "grid size-[clamp(48px,4.4vw,72px)] flex-none place-items-center rounded-[10px] border transition disabled:opacity-50",
            done
              ? "border-[#5fd482] bg-s1 text-on-accent"
              : "border-[#5fd482] bg-s1 text-on-accent hover:brightness-110",
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-[15px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12.5 9.5 18 20 6.5" />
          </svg>
        </button>

        {done && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label={`ลบเซ็ต ${slot.setIndex}`}
            className="grid size-[clamp(44px,3.8vw,62px)] flex-none place-items-center rounded-[9px] text-text-2 transition hover:text-text-1 disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-[15px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M5 7h14M10 7V5h4v2M8 7l.7 12h6.6L16 7" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 pl-[clamp(66px,6vw,110px)] text-[12px] text-text-1">
          บันทึกไม่สำเร็จ · {error}
        </p>
      )}
    </div>
  );
}
