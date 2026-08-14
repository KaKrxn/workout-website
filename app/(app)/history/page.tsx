import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatThaiShort, parseISODate, todayISO, THAI_DAY_SHORT } from "@/lib/date";
import { focusLabel, focusTagClass, formatKg } from "@/lib/labels";

export const metadata = { title: "ประวัติ · FitTrack" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  completed: "ทำครบ",
  partial: "ทำบางส่วน",
  skipped: "ข้าม",
  planned: "ตามแผน",
};

export default async function HistoryPage() {
  const supabase = await createClient();
  const today = todayISO();

  // Only days that actually happened — future planned rows are the schedule, not history.
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, date, status, focus, started_at, ended_at, plan_days ( label ), plans ( name )")
    .lte("date", today)
    .neq("status", "planned")
    .order("date", { ascending: false })
    .limit(60);

  const dates = (sessions ?? []).map((s) => s.date);
  const { data: stats } = dates.length
    ? await supabase
        .from("daily_stats")
        .select("date, total_volume_kg, total_duration_s, session_count")
        .in("date", dates)
    : { data: [] };

  const statsByDate = new Map((stats ?? []).map((s) => [s.date, s]));

  return (
    <div className="pt-6">
      <div className="mb-[18px]">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">ประวัติ</h1>
        <p className="mt-0.5 text-[13px] text-text-2">
          เซสชันที่บันทึกไว้ เรียงจากล่าสุด · แสดง 60 รายการล่าสุด
        </p>
      </div>

      {(sessions?.length ?? 0) === 0 ? (
        <div className="rounded-card border border-border bg-surface p-[18px] shadow-card">
          <p className="text-[13px] text-text-2">
            ยังไม่มีเซสชันที่บันทึก — เริ่มจากหน้า{" "}
            <Link href="/today" className="font-semibold text-s1 underline underline-offset-[3px]">
              วันนี้
            </Link>
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {sessions!.map((s) => {
            const d = parseISODate(s.date);
            const stat = statsByDate.get(s.date);

            return (
              <li key={s.id}>
                <Link
                  href={`/history/${s.id}`}
                  className="flex items-center gap-3.5 rounded-card border border-border bg-surface p-3.5 shadow-card transition hover:bg-surface-2"
                >
                  <span className="grid size-11 flex-none place-items-center rounded-[10px] bg-surface-2 text-center">
                    <span className="block text-[10px] leading-none text-label">
                      {THAI_DAY_SHORT[d.getDay()]}
                    </span>
                    <span className="block text-[15px] font-bold leading-tight tabular-nums">
                      {d.getDate()}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">
                      {s.plan_days?.label ?? "เซสชันนอกแผน"}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11.5px] text-label">{formatThaiShort(d)}</span>
                      {(s.focus ?? []).slice(0, 3).map((f) => (
                        <span
                          key={f}
                          className={`rounded px-1.5 py-px text-[10.5px] font-bold ${focusTagClass(f)}`}
                        >
                          {focusLabel(f)}
                        </span>
                      ))}
                    </span>
                  </span>

                  <span className="flex-none text-right">
                    <span className="block text-[13px] font-bold tabular-nums">
                      {stat ? formatKg(Number(stat.total_volume_kg)) : "—"}
                    </span>
                    <span className="block text-[11.5px] text-label">
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
