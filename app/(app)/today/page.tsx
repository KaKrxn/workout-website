import { createClient } from "@/lib/supabase/server";
import { getWorkoutForDate } from "@/lib/queries/today";
import { ExerciseRow } from "@/components/workout/exercise-row";
import { StartButton, FinishButton } from "./finish-button";
import { focusLabel, focusTagClass } from "@/lib/labels";
import {
  formatThaiLong,
  isoWeekNumber,
  parseISODate,
  todayISO,
  THAI_DAY_NAMES,
} from "@/lib/date";

export const metadata = { title: "วันนี้ · FitTrack" };
export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const supabase = await createClient();
  const date = todayISO();
  const workout = await getWorkoutForDate(supabase, date);

  const d = parseISODate(date);
  const dateLine = `วัน${THAI_DAY_NAMES[d.getDay()]}ที่ ${formatThaiLong(d)} · สัปดาห์ที่ ${isoWeekNumber(d)}`;

  // No session row at all — either a planned rest day or nothing scheduled.
  if (!workout.session || workout.planDay?.isRest) {
    return (
      <div className="pt-6">
        <PageHead title="วันนี้ — วันพัก" sub={dateLine} />
        <div className="rounded-card border border-border bg-surface p-[18px] shadow-card">
          <p className="text-[13px] leading-relaxed text-text-2">
            {workout.planDay?.restNote ?? "วันนี้ไม่มีเวิร์คเอาท์ตามแผน พักเต็มวันหรือเดินเบา ๆ ได้"}
          </p>
          <p className="mt-3 text-[12.5px] text-label">
            วันพักตามแผนไม่นับว่าพลาด และไม่ทำให้ streak ขาด
          </p>
        </div>
      </div>
    );
  }

  const { session, planDay, exercises } = workout;

  const expectedSlots = exercises.reduce(
    (n, e) => n + e.targetSets * (e.perSide ? 2 : 1),
    0,
  );
  const loggedSlots = exercises.reduce((n, e) => n + e.sets.length, 0);
  const pct = expectedSlots === 0 ? 0 : Math.round((loggedSlots / expectedSlots) * 100);

  const totalSets = exercises.reduce((n, e) => n + e.targetSets, 0);
  const started = session.status === "partial" || session.status === "completed";

  return (
    <div className="pt-6">
      <PageHead
        title={`วันนี้ — ${planDay?.label ?? "เวิร์คเอาท์"}`}
        sub={
          planDay?.isPriorityDay
            ? `${dateLine} · วันสำคัญที่สุดสำหรับเป้าหมาย V-Taper`
            : dateLine
        }
      />

      <div className="rounded-card border border-border bg-surface p-[18px] shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(planDay?.focus ?? []).map((f) => (
                <span
                  key={f}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${focusTagClass(f)}`}
                >
                  {focusLabel(f)}
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-[19px] font-bold tracking-[-0.02em]">
              {workout.planName ?? "เวิร์คเอาท์"}
            </p>
          </div>

          {!started && <StartButton sessionId={session.id} />}
          {session.status === "completed" && (
            <span className="rounded-full bg-good/12 px-3 py-1 text-[12px] font-semibold text-good-text">
              จบแล้ว
            </span>
          )}
        </div>

        <dl className="mt-3.5 mb-4 flex flex-wrap gap-[18px]">
          <Meta label="ท่าทั้งหมด" value={String(exercises.length)} />
          <Meta label="เซ็ตรวม" value={String(totalSets)} />
          <Meta label="บันทึกแล้ว" value={`${loggedSlots}/${expectedSlots}`} />
        </dl>

        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-label">
          ความคืบหน้าวันนี้ <span className="tabular-nums">{pct}%</span>
        </p>
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="ความคืบหน้าวันนี้"
        >
          <div
            className="h-full rounded-full bg-good transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-1.5 border-t border-border">
          {exercises.map((exercise, i) => (
            <ExerciseRow
              key={exercise.planItemId}
              exercise={exercise}
              sessionId={session.id}
              defaultOpen={i === 0 && loggedSlots === 0}
            />
          ))}
        </div>

        {exercises.length === 0 && (
          <p className="py-6 text-center text-[13px] text-text-2">
            แผนของวันนี้ยังไม่มีท่าออกกำลังกาย
          </p>
        )}

        <p className="mt-3 text-[12px] text-label">
          แตะแถวเพื่อกางช่องบันทึก ·{" "}
          <span className="text-s1">■</span> = ท่าหลักสำหรับเป้าหมาย อก/หลัง/ไหล่
        </p>

        {started && session.status !== "completed" && (
          <div className="mt-4">
            <FinishButton sessionId={session.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function PageHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-[18px]">
      <h1 className="text-[22px] font-bold tracking-[-0.02em]">{title}</h1>
      <p className="mt-0.5 text-[13px] text-text-2">{sub}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] text-text-2">{label}</dt>
      <dd className="text-[17px] font-bold tabular-nums">{value}</dd>
    </div>
  );
}
