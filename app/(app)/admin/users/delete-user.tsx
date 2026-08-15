"use client";

import { useState, useTransition } from "react";
import { deleteUserAccount } from "../actions";
import type { ActionResult } from "../actions";

/**
 * Account deletion, behind typing the address.
 *
 * The typed value is also re-checked on the server against the real record —
 * this is a guard against misclicks, not a security control.
 */
export function DeleteUser({ userId, email }: { userId: string; email: string | null }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[9px] border border-border px-2.5 py-1.5 text-[12px] font-semibold text-text-2 transition hover:bg-surface-2 hover:text-text-1"
      >
        ลบบัญชี
      </button>
    );
  }

  return (
    <div className="w-full rounded-[10px] border border-s2/40 bg-s2/5 p-3">
      <p className="text-[12.5px] leading-relaxed text-text-1">
        ลบ <b>{email ?? userId}</b> ถาวร — ข้อมูลการฝึก สัดส่วนร่างกาย และรูปถ่ายทั้งหมดจะหายไปด้วย
        กู้คืนไม่ได้
      </p>
      <p className="mt-1.5 text-[11.5px] text-text-2">พิมพ์อีเมลของบัญชีนี้เพื่อยืนยัน</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={email ?? ""}
          className="min-w-[220px] flex-1 rounded-[9px] border border-border bg-surface px-2.5 py-1.5 text-[13px]"
        />
        <button
          type="button"
          disabled={pending || typed.trim() !== (email ?? "")}
          onClick={() =>
            start(async () => setResult(await deleteUserAccount(userId, typed)))
          }
          className="rounded-[9px] bg-s2 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {pending ? "กำลังลบ…" : "ลบถาวร"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
            setResult(null);
          }}
          className="rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold transition hover:bg-surface-2"
        >
          ยกเลิก
        </button>
      </div>
      {result && !result.ok && (
        <p role="alert" className="mt-2 text-[11.5px] text-text-1">
          {result.error}
        </p>
      )}
    </div>
  );
}
