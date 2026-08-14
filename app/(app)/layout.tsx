import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { provisionUser } from "@/lib/provision";
import { TopTabs, BottomNav } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/(auth)/actions";

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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-page/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1120px] items-center gap-3.5 px-5 py-3">
          <Link href="/today" className="flex flex-none items-center gap-2.5">
            <span className="grid size-[26px] place-items-center rounded-[8px] bg-s1">
              <svg viewBox="0 0 24 24" className="size-[15px]" aria-hidden="true">
                <path
                  d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="whitespace-nowrap text-base font-bold tracking-[-0.02em]">
              FitTrack
            </span>
          </Link>

          <TopTabs />

          <div className="flex-1" />

          <ThemeToggle />

          <form action={signOut}>
            <button
              type="submit"
              title="ออกจากระบบ"
              aria-label="ออกจากระบบ"
              className="grid size-[30px] flex-none place-items-center rounded-full bg-s3 text-[12px] font-bold text-white"
            >
              {initial}
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] flex-1 px-5 pb-28 min-[860px]:pb-24">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
