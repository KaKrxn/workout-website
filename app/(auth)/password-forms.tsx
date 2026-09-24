"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  requestPasswordReset,
  updatePassword,
  type AuthState,
} from "@/app/(auth)/actions";
import { useMessage, useT } from "@/components/i18n-provider";

const initialState: AuthState = { errorKey: null, noticeKey: null };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-[10px] bg-s1 px-4 py-2.5 text-[13px] font-semibold text-on-accent transition hover:brightness-110 disabled:opacity-60"
    >
      {pending ? t.auth.submitPending : label}
    </button>
  );
}

function MessageBlock({ state }: { state: AuthState }) {
  const error = useMessage(state.errorKey ? `auth.${state.errorKey}` : null);
  const notice = useMessage(state.noticeKey ? `auth.${state.noticeKey}` : null);

  if (error) {
    return (
      <p role="alert" className="rounded-[9px] bg-surface-2 px-3 py-2 text-[12.5px] text-text-1">
        {error}
      </p>
    );
  }

  if (notice) {
    return (
      <p className="rounded-[9px] border border-s1/20 bg-s1/10 px-3 py-2 text-[12.5px] text-text-1">
        {notice}
      </p>
    );
  }

  return null;
}

export function ForgotPasswordForm() {
  const t = useT();
  const [state, formAction] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    initialState,
  );

  return (
    <div className="w-full max-w-[380px]">
      <h1 className="text-[22px] font-bold tracking-normal">{t.auth.forgotTitle}</h1>
      <p className="mt-1 text-[13px] text-text-2">{t.auth.forgotBody}</p>

      <form action={formAction} className="mt-6 space-y-3">
        <div>
          <label htmlFor="email" className="mb-1 block text-[11.5px] text-label">
            {t.auth.email}
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

        <MessageBlock state={state} />
        <SubmitButton label={t.auth.sendReset} />
      </form>

      <p className="mt-6 text-center text-[12.5px] text-text-2">
        <Link href="/login" className="font-semibold text-s1 underline underline-offset-[3px]">
          {t.auth.signInCta}
        </Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const t = useT();
  const [state, formAction] = useActionState<AuthState, FormData>(
    updatePassword,
    initialState,
  );

  return (
    <div className="w-full max-w-[380px]">
      <h1 className="text-[22px] font-bold tracking-normal">{t.auth.resetTitle}</h1>

      <form action={formAction} className="mt-6 space-y-3">
        <div>
          <label htmlFor="password" className="mb-1 block text-[11.5px] text-label">
            {t.auth.newPassword}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded-[9px] border border-border bg-surface-2 px-2.5 py-2 text-[14px] text-text-1"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1 block text-[11.5px] text-label">
            {t.auth.confirmPassword}
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="w-full rounded-[9px] border border-border bg-surface-2 px-2.5 py-2 text-[14px] text-text-1"
          />
        </div>

        <MessageBlock state={state} />
        <SubmitButton label={t.auth.resetSubmit} />
      </form>
    </div>
  );
}
