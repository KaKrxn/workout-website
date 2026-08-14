"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { provisionUser } from "@/lib/provision";

export type AuthState = { error: string | null };

const credentials = z.object({
  email: z.string().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"),
});

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
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${await siteURL()}/auth/callback` },
  });

  if (error) {
    return {
      error: error.message.includes("already registered")
        ? "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน"
        : "สมัครไม่สำเร็จ ลองใหม่อีกครั้ง",
    };
  }

  // With email confirmation switched on, there is no session yet — the callback
  // route provisions instead, once the link is opened.
  if (!data.session) {
    return { error: "ส่งลิงก์ยืนยันไปที่อีเมลแล้ว เปิดลิงก์เพื่อเข้าใช้งาน" };
  }

  // Provision before redirecting, not from the app layout: a layout and the page
  // beneath it render concurrently, so provisioning there would race the page's
  // own query and the first paint would show an empty day.
  if (data.user) await provisionUser(data.user.id);

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteURL()}/auth/callback?next=${encodeURIComponent(next)}` },
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

/**
 * Resolves the base URL for auth redirects across every environment.
 * See Report/06-deploy-vercel.md §5.
 */
async function siteURL(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL;
  if (configured) {
    return configured.startsWith("http") ? configured : `https://${configured}`;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
