import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatThaiLong, parseISODate, THAI_DAY_NAMES } from "@/lib/date";
import { focusLabel, focusTagClass, formatDuration, formatKg } from "@/lib/labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "รายละเอียดเซสชัน · FitTrack" };

export default async function SessionDetailPage({ params }: PageProps<"/history/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS scopes this: another user's id simply returns nothing.
  const { data: session } = await supabase
    .from("sessions")
    .select("id, date, status, focus, note, started_at, ended_at, plan_days ( label ), plans ( name )")
    .eq("id", id)
    .maybeSingle();

  if (!session) notFound();

  const { data: sets } = await supabase
    .from("session_sets")
    .select("id, exercise_id, set_index, side, reps, weight_kg, duration_s, distance_m, incline_pct, is_warmup, exercises ( name, kind )")
    .eq("session_id", id)
    .order("set_index");

  // Group by exercise, preserving the order the sets were recorded in.
  const groups = new Map<string, { name: string; kind: string; sets: typeof sets }>();
  for (const s of sets ?? []) {
    const key = s.exercise_id;
    if (!groups.has(key)) {
      groups.set(key, { name: s.exercises?.name ?? key, kind: s.exercises?.kind ?? "strength", sets: [] });
    }
    groups.get(key)!.sets!.push(s);
  }

  const volume = (sets ?? []).reduce(
    (n, s) => n + (s.is_warmup ? 0 : Number(s.weight_kg ?? 0) * (s.reps ?? 0)),
    0,
  );
  const elapsed =
    session.started_at && session.ended_at
      ? (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000
      : null;

  const d = parseISODate(session.date);

  return (
    <div className="pt-6">
      <Link
        href="/history"
        className="text-[12.5px] font-semibold text-s1 underline underline-offset-[3px]"
      >
        ← ประวัติ
      </Link>

      <div className="mb-[18px] mt-3">
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">
          {session.plan_days?.label ?? "เซสชันนอกแผน"}
        </h1>
        <p className="mt-0.5 text-[13px] text-text-2">
          วัน{THAI_DAY_NAMES[d.getDay()]}ที่ {formatThaiLong(d)}
          {session.plans?.name ? ` · ${session.plans.name}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(session.focus ?? []).map((f) => (
            <span
              key={f}
              className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${focusTagClass(f)}`}
            >
              {focusLabel(f)}
            </span>
          ))}
        </div>
      </div>

      <dl className="mb-4 flex flex-wrap gap-[22px] rounded-card border border-border bg-surface p-[18px] shadow-card">
        <div>
          <dt className="text-[12px] text-text-2">ปริมาตรรวม</dt>
          <dd className="text-[17px] font-bold tabular-nums">{formatKg(volume)}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-text-2">เซ็ตทั้งหมด</dt>
          <dd className="text-[17px] font-bold tabular-nums">{sets?.length ?? 0}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-text-2">ใช้เวลา</dt>
          <dd className="text-[17px] font-bold tabular-nums">
            {elapsed ? formatDuration(elapsed) : "—"}
          </dd>
        </div>
      </dl>

      {groups.size === 0 ? (
        <p className="rounded-card border border-border bg-surface p-[18px] text-[13px] text-text-2 shadow-card">
          เซสชันนี้ยังไม่มีเซ็ตที่บันทึกไว้
        </p>
      ) : (
        <div className="space-y-2.5">
          {[...groups.entries()].map(([exerciseId, g]) => (
            <section
              key={exerciseId}
              className="rounded-card border border-border bg-surface p-[18px] shadow-card"
            >
              <h2 className="text-[15px] font-bold tracking-[-0.01em]">{g.name}</h2>
              <table className="mt-2.5 w-full border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <th className="border-b border-border px-2 py-1.5 text-left text-[11.5px] font-semibold text-label">
                      เซ็ต
                    </th>
                    {g.kind === "strength" && (
                      <th className="border-b border-border px-2 py-1.5 text-left text-[11.5px] font-semibold text-label">
                        น้ำหนัก
                      </th>
                    )}
                    {(g.kind === "strength" || g.kind === "bodyweight") && (
                      <th className="border-b border-border px-2 py-1.5 text-left text-[11.5px] font-semibold text-label">
                        ครั้ง
                      </th>
                    )}
                    {(g.kind === "duration" || g.kind === "cardio") && (
                      <th className="border-b border-border px-2 py-1.5 text-left text-[11.5px] font-semibold text-label">
                        เวลา
                      </th>
                    )}
                    {g.kind === "cardio" && (
                      <>
                        <th className="border-b border-border px-2 py-1.5 text-left text-[11.5px] font-semibold text-label">
                          ระยะทาง
                        </th>
                        <th className="border-b border-border px-2 py-1.5 text-left text-[11.5px] font-semibold text-label">
                          ความชัน
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {g.sets!.map((s) => (
                    <tr key={s.id}>
                      <td className="border-b border-border px-2 py-1.5 tabular-nums">
                        {s.set_index}
                        {s.side ? (s.side === "left" ? " ซ้าย" : " ขวา") : ""}
                      </td>
                      {g.kind === "strength" && (
                        <td className="border-b border-border px-2 py-1.5 tabular-nums">
                          {s.weight_kg != null ? `${s.weight_kg} kg` : "—"}
                        </td>
                      )}
                      {(g.kind === "strength" || g.kind === "bodyweight") && (
                        <td className="border-b border-border px-2 py-1.5 tabular-nums">
                          {s.reps ?? "—"}
                        </td>
                      )}
                      {(g.kind === "duration" || g.kind === "cardio") && (
                        <td className="border-b border-border px-2 py-1.5 tabular-nums">
                          {s.duration_s != null ? `${s.duration_s} วิ` : "—"}
                        </td>
                      )}
                      {g.kind === "cardio" && (
                        <>
                          <td className="border-b border-border px-2 py-1.5 tabular-nums">
                            {s.distance_m != null ? `${s.distance_m} ม.` : "—"}
                          </td>
                          <td className="border-b border-border px-2 py-1.5 tabular-nums">
                            {s.incline_pct != null ? `${s.incline_pct}%` : "—"}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
