import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Settings · FitTrack" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("locale, theme, weekly_goal_days, weekly_cardio_goal, vtaper_target")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="ft-settings">
      <div className="mb-6">
        <h1 className="text-[30px] font-black tracking-normal">Settings</h1>
        <p className="mt-1 text-[13px] text-text-2">
          เป้าหมาย ภาษา และธีมของบัญชีนี้
        </p>
      </div>

      <div className="ft-settings-profile"><span className="ft-settings-avatar">{(user.user_metadata?.full_name ?? user.email ?? "?").charAt(0).toUpperCase()}</span><div><strong className="text-lg">{user.user_metadata?.full_name ?? "FitTrack"}</strong><p className="ft-muted text-sm">{user.email}</p></div></div>
      {settings ? (
        <SettingsForm settings={settings} />
      ) : (
        <div className="rounded-[20px] border border-border bg-surface p-5 text-[13px] text-text-2">
          ยังไม่มี settings สำหรับบัญชีนี้
        </div>
      )}
    </div>
  );
}
