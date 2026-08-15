import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "./admin-nav";

/** Per-user data across every account — never cacheable. */
export const dynamic = "force-dynamic";

export const metadata = { title: "ผู้ดูแลระบบ · FitTrack" };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Renders 404 for everyone else. Not the security boundary — RLS is — but it
  // keeps the route from confirming its own existence.
  await requireAdmin();

  return (
    <div className="pt-6">
      <div className="mb-[18px]">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">ผู้ดูแลระบบ</h1>
        <p className="mt-0.5 text-[13px] text-text-2">
          สถานะระบบและเครื่องมือดูแลข้อมูล · สำหรับแก้ข้อมูลดิบใช้ Supabase Studio
        </p>
      </div>
      <AdminNav />
      {children}
    </div>
  );
}
