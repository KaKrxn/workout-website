import { DataChart } from "@/components/data-chart";
import Link from "next/link";
import { redirect } from "next/navigation";
import { addDays, formatISODate, parseISODate, todayISO } from "@/lib/date";
import { focusLabel } from "@/lib/labels";
import { MUSCLE_PRIORITY } from "@/lib/program-seed";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Stats · FitTrack" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const { range } = await searchParams;
  const rangeDays = range === "30" ? 30 : range === "365" ? 365 : 90;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = parseISODate(todayISO());
  const from = formatISODate(addDays(today, 1-rangeDays));

  const [{ data: settings }, { data: stats }, { data: sessions }, { data: metrics }] =
    await Promise.all([
      supabase
        .from("user_settings")
        .select("weekly_goal_days, weekly_cardio_goal, vtaper_target")
        .eq("user_id", user.id)
        .single(),
      supabase
        .from("daily_stats")
        .select("date, session_count, total_volume_kg, cardio_minutes, sets_by_muscle, was_planned")
        .eq("user_id", user.id)
        .gte("date", from)
        .order("date"),
      supabase
        .from("sessions")
        .select("id, date, status, plan_day_id")
        .eq("user_id", user.id)
        .gte("date", from)
        .lte("date", todayISO()),
      supabase
        .from("body_metrics")
        .select("date, metric_id, value")
        .eq("user_id", user.id)
        .in("metric_id", ["body_fat_pct", "measure_shoulder", "measure_waist"])
        .order("date", { ascending: false }),
    ]);

  const statsByDate = new Map((stats ?? []).map((row) => [row.date, row]));
  const sessionsByDate = new Map<string, NonNullable<typeof sessions>>();
  for (const session of sessions ?? []) {
    const list = sessionsByDate.get(session.date) ?? [];
    list.push(session);
    sessionsByDate.set(session.date, list);
  }

  const days = Array.from({ length: rangeDays }, (_, i) => {
    const date = formatISODate(addDays(parseISODate(from), i));
    const stat = statsByDate.get(date);
    const daySessions = sessionsByDate.get(date) ?? [];
    const completed = daySessions.some((session) => session.status === "completed" || session.status === "partial");
    const planned = daySessions.some((session) => session.plan_day_id != null);
    return {
      date,
      completed,
      planned,
      volume: Number(stat?.total_volume_kg ?? 0),
      cardio: Number(stat?.cardio_minutes ?? 0),
    };
  });

  const completedDays = days.filter((day) => day.completed).length;
  const plannedDays = days.filter((day) => day.planned).length;
  const adherence = plannedDays === 0 ? 0 : Math.round((completedDays / plannedDays) * 100);
  const streak = weeklyStreak(days, settings?.weekly_goal_days ?? 5);
  const weeklyRows = buildWeeklyRows(days);
  const muscleRows = buildMuscleRows(stats ?? []);

  const latestBodyFat = latestMetric(metrics ?? [], "body_fat_pct");
  const shoulder = latestMetric(metrics ?? [], "measure_shoulder");
  const waist = latestMetric(metrics ?? [], "measure_waist");
  const vtaper = shoulder && waist ? shoulder.value / waist.value : null;

  const maxVolume = Math.max(1, ...days.map((day) => day.volume));

  return (
    <div className="ft-page">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-black tracking-normal">Analytics</h1>
          <p className="mt-1 text-[13px] text-text-2">
            Last {rangeDays} days · Your training progress
          </p>
        </div>
      </div>

      <nav className="ft-segments mb-6 w-fit" aria-label="Date range">{[30,90,365].map(n=><Link key={n} href={`/analytics?range=${n}`} aria-current={n===rangeDays?"page":undefined}>{n===365?"1 year":n+" days"}</Link>)}</nav>
      <section className="ft-tiles">
        <Tile label="V-Taper Ratio" value={vtaper ? vtaper.toFixed(3) : "--"} sub={`target ${settings?.vtaper_target ?? 1.618}`} />
        <Tile label="Body fat %" value={latestBodyFat ? `${latestBodyFat.value}%` : "--"} sub={latestBodyFat?.date ?? "log in Body"} />
        <Tile label="Streak" value={`${streak}`} sub="weeks at goal" />
        <Tile label="Adherence" value={`${adherence}%`} sub={`${completedDays}/${plannedDays} planned days`} />
      </section>

      <section className="mt-4 rounded-[20px] border border-border bg-surface p-4">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-extrabold tracking-normal">Consistency Heatmap</h2>
            <p className="mt-1 text-[12.5px] text-text-2">
              สีเข้มคือ volume มากขึ้น ส่วนช่องขอบประคือวันที่มีแผนแต่ยังไม่ได้ทำ
            </p>
          </div>
          <Link href="/history" className="text-[12px] font-bold text-good-text">
            View history
          </Link>
        </div>
        <div className="grid grid-flow-col grid-rows-7 auto-cols-[14px] gap-1 overflow-x-auto pb-2">
          {days.map((day) => {
            const intensity = Math.ceil((day.volume / maxVolume) * 4);
            const fill = day.completed ? ["bg-hm1", "bg-hm1", "bg-hm2", "bg-hm3", "bg-hm4"][intensity] : "bg-surface-2";
            return (
              <div
                key={day.date}
                title={`${day.date} · ${day.volume.toLocaleString("en-US")} kg`}
                className={`aspect-square min-w-3 rounded-[3px] ${fill} ${
                  day.planned && !day.completed ? "border border-dashed border-[#b4c0b4]" : ""
                }`}
              />
            );
          })}
        </div>
      </section>

      <section className="ft-two-col mt-6">
        <DataChart title="Weekly total volume" kicker="STRENGTH" unit="kg" rows={weeklyRows.map(r=>({label:r.week,value:r.volume})).reverse()}/>
        <DataChart title="Weekly cardio" kicker="CARDIO" unit="min" rows={weeklyRows.map(r=>({label:r.week,value:r.cardio})).reverse()}/>
      </section>
      <section className="mt-4 grid gap-3 min-[920px]:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[20px] border border-border bg-surface p-4">
          <h2 className="text-[18px] font-extrabold tracking-normal">Muscle Balance</h2>
          <div className="mt-4 grid gap-3">
            {muscleRows.length === 0 ? (
              <p className="text-[12.5px] text-text-2">ยังไม่มี set data สำหรับช่วงนี้</p>
            ) : (
              muscleRows.map((row) => (
                <div key={row.muscle} className="grid gap-1">
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="font-bold">{focusLabel(row.muscle)}</span>
                    <span className="tabular-nums text-text-2">{row.sets} sets</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--ft-chip)]">
                    <div
                      className="h-full rounded-full bg-s1"
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[20px] border border-border bg-surface p-4">
          <h2 className="text-[18px] font-extrabold tracking-normal">Weekly Table</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-y-1 text-left text-[12px]">
              <thead className="text-text-2">
                <tr>
                  <th className="px-3 py-2">Week</th>
                  <th className="px-3 py-2 text-right">Sessions</th>
                  <th className="px-3 py-2 text-right">Volume</th>
                  <th className="px-3 py-2 text-right">Cardio</th>
                  <th className="px-3 py-2 text-right">Adherence</th>
                </tr>
              </thead>
              <tbody>
                {weeklyRows.map((row) => (
                  <tr key={row.week} className="bg-surface-2">
                    <td className="rounded-l-[9px] px-3 py-2 font-bold">{row.week}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.sessions}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Math.round(row.volume).toLocaleString("en-US")} kg
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.cardio} min</td>
                    <td className="rounded-r-[9px] px-3 py-2 text-right tabular-nums">
                      {row.planned === 0 ? "--" : `${Math.round((row.completed / row.planned) * 100)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[20px] border border-border bg-surface p-4">
      <p className="text-[12px] font-bold text-text-2">{label}</p>
      <p className="mt-2 text-[34px] font-black leading-none tabular-nums">{value}</p>
      <p className="mt-2 text-[12px] text-text-2">{sub}</p>
    </div>
  );
}

function latestMetric<T extends { metric_id: string; date: string; value: number }>(
  rows: T[],
  metricId: string,
): T | null {
  return rows.find((row) => row.metric_id === metricId) ?? null;
}

function weeklyStreak(days: { completed: boolean; date: string }[], goal: number) {
  const weeks = new Map<string, number>();
  for (const day of days) {
    if (!day.completed) continue;
    const d = parseISODate(day.date);
    const monday = addDays(d, d.getDay() === 0 ? -6 : 1 - d.getDay());
    const key = formatISODate(monday);
    weeks.set(key, (weeks.get(key) ?? 0) + 1);
  }

  let streak = 0;
  for (let cursor = addDays(parseISODate(todayISO()), -6); ; cursor = addDays(cursor, -7)) {
    const monday = addDays(cursor, cursor.getDay() === 0 ? -6 : 1 - cursor.getDay());
    if ((weeks.get(formatISODate(monday)) ?? 0) < goal) break;
    streak += 1;
    if (streak > 52) break;
  }
  return streak;
}

function buildWeeklyRows(days: { completed: boolean; planned: boolean; date: string; volume: number; cardio: number }[]) {
  const weeks = new Map<string, {
    week: string;
    sessions: number;
    completed: number;
    planned: number;
    volume: number;
    cardio: number;
  }>();

  for (const day of days) {
    const d = parseISODate(day.date);
    const monday = addDays(d, d.getDay() === 0 ? -6 : 1 - d.getDay());
    const key = formatISODate(monday);
    const row = weeks.get(key) ?? {
      week: key,
      sessions: 0,
      completed: 0,
      planned: 0,
      volume: 0,
      cardio: 0,
    };
    row.sessions += day.completed ? 1 : 0;
    row.completed += day.completed ? 1 : 0;
    row.planned += day.planned ? 1 : 0;
    row.volume += day.volume;
    row.cardio += day.cardio;
    weeks.set(key, row);
  }

  return Array.from(weeks.values()).reverse();
}

function buildMuscleRows(rows: { sets_by_muscle: unknown }[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const values = toNumberRecord(row.sets_by_muscle);
    for (const [muscle, count] of Object.entries(values)) {
      totals.set(muscle, (totals.get(muscle) ?? 0) + count);
    }
  }

  const max = Math.max(1, ...totals.values());
  return Array.from(totals.entries())
    .map(([muscle, sets]) => ({
      muscle,
      sets,
      percent: Math.max(3, Math.round((sets / max) * 100)),
    }))
    .sort((a, b) => muscleOrder(a.muscle) - muscleOrder(b.muscle));
}

function toNumberRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
  );
}

function muscleOrder(muscle: string) {
  const index = (MUSCLE_PRIORITY as readonly string[]).indexOf(muscle);
  return index === -1 ? 999 : index;
}
