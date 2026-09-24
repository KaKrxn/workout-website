"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "./actions";

/**
 * Button that runs an admin action and reports the outcome inline.
 *
 * Inline rather than a toast, per Report/03-ui-spec.md §7 — the result belongs
 * next to the thing it acted on.
 */
export function ActionButton({
  label,
  action,
  confirm,
}: {
  label: string;
  action: () => Promise<ActionResult>;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  const run = () => {
    if (confirm && !window.confirm(confirm)) return;
    setResult(null);
    start(async () => setResult(await action()));
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-[9px] border border-border bg-surface px-2.5 py-1.5 text-[12px] font-semibold transition hover:bg-surface-2 disabled:opacity-60"
      >
        {pending ? "กำลังทำงาน…" : label}
      </button>
      {result && (
        <span
          role="status"
          className={`text-[11.5px] ${result.ok ? "text-good-text" : "text-text-1"}`}
        >
          {result.ok ? result.message : `ไม่สำเร็จ · ${result.error}`}
        </span>
      )}
    </span>
  );
}
