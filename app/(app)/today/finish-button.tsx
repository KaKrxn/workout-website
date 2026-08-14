"use client";

import { useTransition } from "react";
import { finishSession, startSession } from "./actions";

export function StartButton({ sessionId }: { sessionId: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void startSession(sessionId))}
      className="rounded-[10px] bg-s1 px-4 py-2.5 text-[13px] font-semibold text-on-accent transition hover:brightness-110 disabled:opacity-60"
    >
      {pending ? "กำลังเริ่ม…" : "เริ่มเลย →"}
    </button>
  );
}

export function FinishButton({ sessionId }: { sessionId: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void finishSession(sessionId))}
      className="w-full rounded-[10px] border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold transition hover:bg-surface-2 disabled:opacity-60"
    >
      {pending ? "กำลังบันทึก…" : "จบเวิร์คเอาท์"}
    </button>
  );
}
