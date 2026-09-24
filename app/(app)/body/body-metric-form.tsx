"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { todayISO } from "@/lib/date";
import { logBodyMetric, type BodyActionState } from "./actions";

const initialState: BodyActionState = { ok: false, error: null };

const METRICS = [
  ["weight", "Weight"],
  ["body_fat_pct", "Body fat %"],
  ["measure_shoulder", "Shoulder"],
  ["measure_chest", "Chest"],
  ["measure_waist", "Waist"],
  ["measure_arm", "Arm"],
  ["measure_neck", "Neck"],
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-[10px] bg-s1 px-4 py-2.5 text-[13px] font-bold text-on-accent transition hover:brightness-110 disabled:opacity-60"
    >
      {pending ? "Saving..." : "Save"}
    </button>
  );
}

export function BodyMetricForm() {
  const [state, formAction] = useActionState<BodyActionState, FormData>(
    logBodyMetric,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-3 rounded-[20px] border border-border bg-surface p-4 min-[720px]:grid-cols-[1fr_1fr_1fr_auto]">
      <label className="grid gap-1 text-[12px] text-text-2">
        Date
        <input
          name="date"
          type="date"
          defaultValue={todayISO()}
          required
          className="rounded-[9px] border border-border bg-surface-2 px-3 py-2 text-[14px] text-text-1"
        />
      </label>
      <label className="grid gap-1 text-[12px] text-text-2">
        Metric
        <select
          name="metricId"
          className="rounded-[9px] border border-border bg-surface-2 px-3 py-2 text-[14px] text-text-1"
        >
          {METRICS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-[12px] text-text-2">
        Value
        <input
          name="value"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          required
          className="rounded-[9px] border border-border bg-surface-2 px-3 py-2 text-[14px] text-text-1"
        />
      </label>
      <div className="flex items-end">
        <SubmitButton />
      </div>
      {(state.error || state.ok) && (
        <p
          role={state.error ? "alert" : undefined}
          className="min-[720px]:col-span-4 text-[12.5px] text-text-2"
        >
          {state.error ?? "Saved"}
        </p>
      )}
    </form>
  );
}
