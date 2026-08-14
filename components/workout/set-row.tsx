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

/** Placeholder shown before anything has been logged, taken from the plan's target range. */
function suggest(exercise: TodayExercise) {
  if (exercise.kind === "duration") return { field: "durationS", value: exercise.durationMinS };
  if (exercise.kind === "cardio") return { field: "durationS", value: exercise.durationMinS };
  return { field: "reps", value: exercise.repMin };
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
  <label className="flex min-w-0 flex-1 flex-col gap-1">
    <span className="text-[10.5px] uppercase tracking-[0.06em] text-label">{label}</span>
    <span className="flex items-center gap-1">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 rounded-[9px] border border-border bg-surface-2 px-2 py-1.5 text-[13px] tabular-nums text-text-1"
      />
      {suffix && <span className="flex-none text-[11px] text-label">{suffix}</span>}
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
  const hint = suggest(exercise);

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
    <div className="border-t border-border py-2.5 first:border-t-0">
      <div className="flex items-end gap-2">
        <span className="w-[52px] flex-none pb-1.5 text-[11.5px] font-semibold tabular-nums text-text-2">
          {slot.side ? (slot.side === "left" ? "ซ้าย" : "ขวา") : `เซ็ต ${slot.setIndex}`}
        </span>

        {exercise.kind === "strength" && (
          <>
            <NumberField label="น้ำหนัก" value={weight} onChange={setWeight} step={2.5} suffix="kg" />
            <NumberField
              label="ครั้ง"
              value={reps}
              onChange={setReps}
              placeholder={hint.value?.toString()}
            />
          </>
        )}

        {exercise.kind === "bodyweight" && (
          <NumberField
            label="ครั้ง"
            value={reps}
            onChange={setReps}
            placeholder={hint.value?.toString()}
          />
        )}

        {exercise.kind === "duration" && (
          <NumberField
            label="เวลา"
            value={duration}
            onChange={setDuration}
            step={5}
            suffix="วิ"
            placeholder={exercise.durationMinS?.toString()}
          />
        )}

        {exercise.kind === "cardio" && (
          <>
            <NumberField
              label="เวลา"
              value={duration}
              onChange={setDuration}
              step={60}
              suffix="วิ"
              placeholder={exercise.durationMinS?.toString()}
            />
            <NumberField label="ระยะทาง" value={distance} onChange={setDistance} step={100} suffix="ม." />
            <NumberField label="ความชัน" value={incline} onChange={setIncline} step={0.5} suffix="%" />
          </>
        )}

        <button
          type="button"
          onClick={save}
          disabled={pending}
          aria-label={done ? `บันทึกการแก้ไขเซ็ต ${slot.setIndex}` : `บันทึกเซ็ต ${slot.setIndex}`}
          className={cn(
            "grid size-11 flex-none place-items-center rounded-[9px] border transition disabled:opacity-50",
            done
              ? "border-good bg-good text-white"
              : "border-border bg-surface hover:bg-surface-2",
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
            className="grid size-11 flex-none place-items-center rounded-[9px] text-label transition hover:text-text-1 disabled:opacity-50"
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
        <p role="alert" className="mt-1.5 pl-[60px] text-[11.5px] text-text-1">
          บันทึกไม่สำเร็จ · {error}
        </p>
      )}
    </div>
  );
}
