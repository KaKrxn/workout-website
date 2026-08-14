"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { signIn, signUp, signInWithGoogle, type AuthState } from "./actions";

const COPY = {
  login: {
    title: "เข้าสู่ระบบ",
    submit: "เข้าสู่ระบบ",
    switchText: "ยังไม่มีบัญชี?",
    switchCta: "สมัครใช้งาน",
    switchHref: "/signup",
  },
  signup: {
    title: "สมัครใช้งาน",
    submit: "สมัครใช้งาน",
    switchText: "มีบัญชีอยู่แล้ว?",
    switchCta: "เข้าสู่ระบบ",
    switchHref: "/login",
  },
} as const;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-[10px] bg-s1 px-4 py-2.5 text-[13px] font-semibold text-on-accent transition hover:brightness-110 disabled:opacity-60"
    >
      {pending ? "กำลังดำเนินการ…" : label}
    </button>
  );
}

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction] = useActionState<AuthState, FormData>(action, { error: null });
  const copy = COPY[mode];

  return (
    <div className="w-full max-w-[380px]">
      <h1 className="text-[22px] font-bold tracking-[-0.02em]">{copy.title}</h1>
      <p className="mt-1 text-[13px] text-text-2">
        {mode === "signup"
          ? "สร้างบัญชีเพื่อเริ่มบันทึกการฝึกของคุณ"
          : "เข้าสู่ระบบเพื่อดูเวิร์คเอาท์ของวันนี้"}
      </p>

      <form action={formAction} className="mt-6 space-y-3">
        <input type="hidden" name="next" value={next} />

        <div>
          <label htmlFor="email" className="mb-1 block text-[11.5px] text-label">
            อีเมล
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-[9px] border border-border bg-surface-2 px-2.5 py-2 text-[14px] text-text-1"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-[11.5px] text-label">
            รหัสผ่าน
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
            className="w-full rounded-[9px] border border-border bg-surface-2 px-2.5 py-2 text-[14px] text-text-1"
          />
          {mode === "signup" && (
            <p className="mt-1 text-[11.5px] text-label">อย่างน้อย 8 ตัวอักษร</p>
          )}
        </div>

        {/* Errors render inline under the thing that failed, not as a toast (03-ui-spec.md §7) */}
        {state.error && (
          <p role="alert" className="rounded-[9px] bg-surface-2 px-3 py-2 text-[12.5px] text-text-1">
            {state.error}
          </p>
        )}

        <SubmitButton label={copy.submit} />
      </form>

      <div className="my-4 flex items-center gap-3 text-[11.5px] text-label">
        <span className="h-px flex-1 bg-border" />
        หรือ
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold transition hover:bg-surface-2"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84C6.71 7.29 9.14 5.38 12 5.38Z" />
          </svg>
          ดำเนินการต่อด้วย Google
        </button>
      </form>

      <p className="mt-6 text-center text-[12.5px] text-text-2">
        {copy.switchText}{" "}
        <Link href={copy.switchHref} className="font-semibold text-s1 underline underline-offset-[3px]">
          {copy.switchCta}
        </Link>
      </p>
    </div>
  );
}
