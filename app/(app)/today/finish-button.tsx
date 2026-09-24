"use client";

import { useEffect, useState, useTransition } from "react";
import { finishSession, startSession } from "./actions";

export function StartButton({
  sessionId,
  autoStart = false,
}: {
  sessionId: string;
  autoStart?: boolean;
}) {
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!autoStart) return;
    start(() => void startSession(sessionId));
  }, [autoStart, sessionId]);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void startSession(sessionId))}
      className="grid min-h-[70px] w-full place-items-center rounded-[20px] bg-s1 px-4 py-3 text-center text-[clamp(30px,3.4vw,64px)] font-black leading-none text-on-accent transition hover:brightness-110 disabled:opacity-60"
    >
      {pending ? "Starting" : "Start"}
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
      className="ft-finish-button transition hover:brightness-110 disabled:opacity-60"
    >
      {pending ? "Saving..." : "Finish Workout"}
    </button>
  );
}

export function SessionTimer({
  startedAt,
  endedAt,
}: {
  startedAt: string | null;
  endedAt: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || endedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt, endedAt]);

  if (!startedAt) return "00:00:00";

  const end = endedAt ? new Date(endedAt).getTime() : now;
  return formatTimer(end - new Date(startedAt).getTime());
}

function formatTimer(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((n) => n.toString().padStart(2, "0")).join(":");
}
