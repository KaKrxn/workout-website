"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { signIn, signUp, signInWithGoogle, type AuthState } from "./actions";
import { useMessage, useT } from "@/components/i18n-provider";

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

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  rightSlot,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  rightSlot?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <label htmlFor={id} className="block text-[11.5px] text-label">
          {label}
        </label>
        {rightSlot}
      </div>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={8}
          className="w-full rounded-[9px] border border-border bg-surface-2 px-2.5 py-2 pr-10 text-[14px] text-text-1"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-[8px] text-label transition hover:bg-surface hover:text-text-1"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

export function AuthForm({
  mode,
  next,
  googleError = false,
}: {
  mode: "login" | "signup";
  next: string;
  googleError?: boolean;
}) {
  const t = useT();
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction] = useActionState<AuthState, FormData>(action, {
    errorKey: googleError ? "googleError" : null,
    noticeKey: null,
  });
  const error = useMessage(state.errorKey ? `auth.${state.errorKey}` : null);
  const notice = useMessage(state.noticeKey ? `auth.${state.noticeKey}` : null);

  const title = mode === "signup" ? t.auth.signUpTitle : t.auth.loginTitle;
  const body = mode === "signup" ? t.auth.signUpBody : t.auth.loginBody;
  const submit = mode === "signup" ? t.auth.signUpSubmit : t.auth.loginSubmit;
  const switchText = mode === "signup" ? t.auth.hasAccount : t.auth.noAccount;
  const switchCta = mode === "signup" ? t.auth.signInCta : t.auth.signUpCta;
  const switchHref = mode === "signup" ? "/login" : "/signup";

  return (
    <div className="ft-auth-panel">
      <div className="ft-kicker">{mode === "login" ? "CHECK IN" : "GET STARTED"}</div>
      <h1>{mode === "login" ? "Welcome Back" : title}</h1>
      <p className="mt-1 text-[13px] text-text-2">
        {body}
      </p>

      <form action={formAction} className="mt-6 space-y-3">
        <input type="hidden" name="next" value={next} />

        {mode === "signup" && (
          <div>
            <label htmlFor="displayName" className="mb-1 block text-[11.5px] text-label">
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              className="w-full rounded-[9px] border border-border bg-surface-2 px-2.5 py-2 text-[14px] text-text-1"
            />
          </div>
        )}

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

        <PasswordField
          id="password"
          name="password"
          label={t.auth.password}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          rightSlot={
            mode === "login" ? (
              <Link href="/forgot-password" className="text-[11.5px] font-semibold text-s1">
                {t.auth.forgotLink}
              </Link>
            ) : null
          }
        />
        {mode === "signup" && (
          <p className="mt-1 text-[11.5px] text-label">{t.auth.passwordTooShort}</p>
        )}

        {mode === "signup" && (
          <PasswordField
            id="confirm"
            name="confirm"
            label={t.auth.confirmPassword}
            autoComplete="new-password"
          />
        )}

        {/* Errors render inline under the thing that failed, not as a toast (03-ui-spec.md §7) */}
        {error && (
          <p role="alert" className="rounded-[9px] bg-surface-2 px-3 py-2 text-[12.5px] text-text-1">
            {error}
          </p>
        )}

        {notice && (
          <p className="rounded-[9px] border border-s1/20 bg-s1/10 px-3 py-2 text-[12.5px] text-text-1">
            {notice}
          </p>
        )}

        <SubmitButton label={submit} />
      </form>

      <div className="my-4 flex items-center gap-3 text-[11.5px] text-label">
        <span className="h-px flex-1 bg-border" />
        {t.auth.or}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="ft-google-button"
          aria-label={t.auth.continueWithGoogle}
        >
          <Image src="/fittrack/google-icon.png" alt="" width={47} height={47} className="ft-google-icon" />
          <span>Google</span>
        </button>
      </form>

      <p className="mt-6 text-center text-[12.5px] text-text-2">
        {switchText}{" "}
        <Link href={switchHref} className="font-semibold text-s1 underline underline-offset-[3px]">
          {switchCta}
        </Link>
      </p>
    </div>
  );
}
