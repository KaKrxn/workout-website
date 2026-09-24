"use client";

import { useState, useTransition } from "react";
import type { TodayPlanVariant } from "@/lib/queries/today";
import { cn } from "@/lib/utils";
import { switchSessionPlan } from "./actions";

export function VariantPicker({
  sessionId,
  activePlanDayId,
  variants,
  loggedSets,
  disabled = false,
}: {
  sessionId: string;
  activePlanDayId: string;
  variants: TodayPlanVariant[];
  loggedSets: number;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (variants.length < 2) return null;

  const choose = (variant: TodayPlanVariant) => {
    if (variant.id === activePlanDayId || pending || disabled) return;
    if (
      loggedSets > 0 &&
      !window.confirm("เปลี่ยนแผนวันนี้? เซ็ตที่ log ไว้จะยังอยู่ และถ้าไม่อยู่ในแผนใหม่จะแสดงใน Off-plan")
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await switchSessionPlan(sessionId, variant.id);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="grid gap-2" aria-label="เลือก plan variant วันนี้">
      <div className="flex flex-wrap gap-2">
        {variants.map((variant) => {
          const active = variant.id === activePlanDayId;
          return (
            <button
              key={variant.id}
              type="button"
              disabled={pending || disabled}
              onClick={() => choose(variant)}
              className={cn(
                "rounded-[10px] border px-3 py-2 text-[12px] font-extrabold transition disabled:opacity-45",
                active
                  ? "border-[#5fd482] bg-s1 text-on-accent"
                  : "border-border bg-surface-2 text-text-1 hover:border-[#5fd482]/70",
              )}
              title={`${variant.label} · ${variant.exerciseCount} exercises`}
            >
              {variant.variantLabel}
              {variant.isDefault && !active ? " · default" : ""}
            </button>
          );
        })}
      </div>
      {error && <p className="text-[12px] text-text-1">เปลี่ยน Plan ไม่สำเร็จ · {error}</p>}
    </div>
  );
}
