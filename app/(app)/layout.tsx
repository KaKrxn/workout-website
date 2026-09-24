import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { provisionUser } from "@/lib/provision";
import { AppHeader } from "@/components/app-header";
import { isAdmin } from "@/lib/admin";
import { I18nProvider } from "@/components/i18n-provider";
import { getLocale, getDictionary } from "@/lib/i18n";

/** Per-user data — must never be cached at the edge (Report/06-deploy-vercel.md §8.2). */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already redirects, so this only guards against a direct render.
  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("active_plan_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Safety net only. Signup and the OAuth callback provision before they redirect,
  // which is what makes the first paint correct — a layout renders *concurrently*
  // with the page beneath it, so provisioning here cannot be awaited by the page's
  // own query. It takes effect from the next render, which is enough for an account
  // that somehow arrived without going through either path.
  if (!settings?.active_plan_id) {
    await provisionUser(user.id);
  }

  const initial = (user.user_metadata?.full_name ?? user.email ?? "?").trim().charAt(0).toUpperCase();
  const dict = await getDictionary();

  const locale = await getLocale();
  return <I18nProvider dict={dict}>
    <AppHeader locale={locale} admin={await isAdmin()} initial={initial}/>
    <main className="ft-main">{children}</main>
  </I18nProvider>;
}
