"use server";

import { redirect } from "next/navigation";
import { getSiteURL } from "@/lib/site-url";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { provisionUser } from "@/lib/provision";
import type { AuthMessageKey } from "@/lib/i18n/th";

export type AuthState = {
  errorKey: AuthMessageKey | null;
  noticeKey: AuthMessageKey | null;
};

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().trim().max(120).optional(),
});

const signUpCredentials = credentials
  .extend({
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"] });

const emailOnly = z.object({ email: z.string().email() });

const newPassword = z
  .object({
    password: z.string().min(8),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"] });

const authError = (errorKey: AuthMessageKey): AuthState => ({ errorKey, noticeKey: null });
const authNotice = (noticeKey: AuthMessageKey): AuthState => ({ errorKey: null, noticeKey });

function keyForCredentialsError(error: z.ZodError): AuthMessageKey {
  const issue = error.issues[0];
  return issue?.path[0] === "email" ? "badEmail" : "passwordTooShort";
}

/** Only ever redirect to a path on this site — never to a URL supplied in the query string. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/today";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return authError(keyForCredentialsError(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return authError("badCredentials");

  if (data.user) {
    try {
      await provisionUser(data.user.id);
    } catch (err) {
      console.error("signIn/provisionUser", err);
      return authError("signupFailed");
    }
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpCredentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    displayName: formData.get("displayName") || undefined,
  });
  if (!parsed.success) {
    return authError(
      parsed.error.issues[0]?.path[0] === "confirm"
        ? "passwordMismatch"
        : keyForCredentialsError(parsed.error),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: parsed.data.displayName ? { full_name: parsed.data.displayName } : undefined,
      emailRedirectTo: `${await getSiteURL()}/auth/callback`,
    },
  });

  if (error) {
    return authError(error.message.includes("already registered") ? "emailAlreadyRegistered" : "signupFailed");
  }

  // With email confirmation switched on, there is no session yet — the callback
  // route provisions instead, once the link is opened.
  if (!data.session) {
    return authNotice("confirmSent");
  }

  // Provision before redirecting, not from the app layout: a layout and the page
  // beneath it render concurrently, so provisioning there would race the page's
  // own query and the first paint would show an empty day.
  if (data.user) {
    try {
      await provisionUser(data.user.id);
    } catch (err) {
      console.error("signUp/provisionUser", err);
      return authError("signupFailed");
    }
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = emailOnly.safeParse({ email: formData.get("email") });
  if (!parsed.success) return authError("badEmail");

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await getSiteURL()}/auth/callback?next=/reset-password`,
  });

  // Deliberately identical whether the address exists or not.
  return authNotice("resetSent");
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = newPassword.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return authError(parsed.error.issues[0]?.path[0] === "confirm" ? "passwordMismatch" : "passwordTooShort");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return authError("resetExpired");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return authError("resetFailed");

  revalidatePath("/", "layout");
  redirect("/today");
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await getSiteURL()}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

