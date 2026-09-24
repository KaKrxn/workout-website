import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getWorkoutForDate } from "@/lib/queries/today";
import { ExerciseRow } from "@/components/workout/exercise-row";
import { StartButton, FinishButton, SessionTimer } from "./finish-button";
import { VariantPicker } from "./variant-picker";
import { focusLabel } from "@/lib/labels";
import { isoWeekNumber, parseISODate, todayISO } from "@/lib/date";
import styles from "./today.module.css";

export const metadata = { title: "วันนี้ · FitTrack" };
export const dynamic = "force-dynamic";

export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const { start } = await searchParams;
  const shouldAutoStart = start === "1";
  const supabase = await createClient();
  const date = todayISO();
  const workout = await getWorkoutForDate(supabase, date);

  const { data: recent } = await supabase.from("sessions").select("id,date,plan_days(label)").lt("date",date).in("status",["completed","partial"]).order("date",{ascending:false}).limit(3);
  const d = parseISODate(date);
  const dateLine = `${EN_DAY_NAMES[d.getDay()]} ${ordinal(d.getDate())} Week ${isoWeekNumber(d)}`;

  if (!workout.session || workout.planDay?.isRest) {
    return (
      <div className="grid min-[860px]:h-[calc(87dvh-clamp(18px,1.85vw,32px))] min-[860px]:place-items-center">
        <div className="w-full max-w-[760px] rounded-[20px] border border-border bg-surface p-[clamp(22px,3vw,46px)] shadow-card">
          <p className="text-[clamp(14px,1.3vw,20px)] text-text-2">{dateLine}</p>
          <h1 className="mt-2 text-[clamp(42px,5vw,76px)] font-black leading-none tracking-normal">
            Rest Day
          </h1>
          <p className="mt-5 text-[clamp(15px,1.35vw,21px)] leading-relaxed text-text-2">
            {workout.planDay?.restNote ?? "วันนี้ไม่มีเวิร์คเอาท์ตามแผน พักเต็มวันหรือเดินเบา ๆ ได้"}
          </p>
        </div>
      </div>
    );
  }

  const { session, planDay, exercises, offPlanExercises } = workout;
  const expectedSlots = exercises.reduce(
    (n, e) => n + e.targetSets * (e.perSide ? 2 : 1),
    0,
  );
  const loggedSlots = exercises.reduce((n, e) => n + e.sets.length, 0);
  const offPlanLoggedSlots = offPlanExercises.reduce((n, e) => n + e.sets.length, 0);
  const pct = expectedSlots === 0 ? 0 : Math.round((loggedSlots / expectedSlots) * 100);
  const totalSets = exercises.reduce((n, e) => n + e.targetSets, 0);
  const started = session.status === "partial" || session.status === "completed";
  const currentExercise =
    exercises.find((exercise) => {
      const expected = exercise.targetSets * (exercise.perSide ? 2 : 1);
      return exercise.sets.length < expected;
    }) ?? exercises[0];

  return (
    <div className={styles.stage}>
      <div className={styles.shell}>
        <section className={styles.leftColumn}>
          <div className={styles.todayHeader}>
            <div className="min-w-0">
              <p className="text-[clamp(16px,1.5vw,25px)] font-medium text-text-1">{dateLine}</p>
              <h1 className="mt-2 max-w-[980px] text-[clamp(40px,3.4vw,64px)] font-black leading-none tracking-normal">
                {planDay?.label ?? workout.planName ?? "Workout"}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {planDay?.variantLabel && (
                  <span className="rounded-[8px] bg-s1/15 px-2.5 py-1 text-[clamp(14px,1.35vw,22px)] font-bold text-good-text">
                    {planDay.variantLabel}
                  </span>
                )}
                {(planDay?.focus ?? []).map((f) => (
                  <span
                    key={f}
                    className="rounded-[8px] bg-[var(--ft-chip)] px-2.5 py-1 text-[clamp(14px,1.35vw,22px)] font-medium text-text-1"
                  >
                    {englishFocusLabel(f)}
                  </span>
                ))}
              </div>
            </div>

            <section className={styles.sessionRail} aria-label="สถานะเซสชันวันนี้">
              {!started && session.status !== "completed" ? (
                <StartButton sessionId={session.id} autoStart={shouldAutoStart} />
              ) : (
                <span className="grid min-h-[70px] w-full place-items-center rounded-[20px] bg-s1 px-5 py-3 text-center text-[clamp(24px,2.3vw,44px)] font-black leading-none text-on-accent">
                  {session.status === "completed" ? "Done" : "Started"}
                </span>
              )}
              <span className="grid min-h-[54px] w-full place-items-center rounded-[15px] bg-white/30 px-4 py-2 text-center text-[clamp(24px,2.5vw,48px)] font-black leading-none tabular-nums text-text-1">
                <SessionTimer startedAt={session.startedAt} endedAt={session.endedAt} />
              </span>
            </section>

            {planDay && (
              <div className={styles.variantRow}>
                <VariantPicker
                  sessionId={session.id}
                  activePlanDayId={planDay.id}
                  variants={workout.variants}
                  loggedSets={loggedSlots + offPlanLoggedSlots}
                  disabled={session.status === "completed"}
                />
              </div>
            )}
          </div>

          <section className="rounded-[20px] border border-border bg-surface p-[clamp(18px,2.1vw,34px)]">
            <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-5">
              <b className="text-[clamp(44px,5.6vw,82px)] font-black leading-none tabular-nums">
                {loggedSlots}
              </b>
              <span className="text-[clamp(16px,1.55vw,25px)] font-bold leading-tight text-text-1">
                of {expectedSlots} sets
                <br />
                Logged
              </span>
              <div
                className="h-2 overflow-hidden rounded-full bg-[var(--ft-chip)]"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="ความคืบหน้าวันนี้"
              >
                <div
                  className="h-full rounded-full bg-s1 transition-[width] duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto pr-1 [scrollbar-color:rgba(95,212,130,.35)_transparent] [scrollbar-width:thin]">
            <div className="grid gap-[clamp(10px,1vw,16px)]">
              {exercises.map((exercise) => (
                <ExerciseRow
                  key={exercise.planItemId}
                  exercise={exercise}
                  sessionId={session.id}
                  defaultOpen={exercise.planItemId === currentExercise?.planItemId}
                />
              ))}
              {offPlanExercises.length > 0 && (
                <section className="mt-1 grid gap-2 rounded-[20px] border border-[#eb6834]/45 bg-[#eb6834]/[0.08] p-3">
                  <div>
                    <h2 className="text-[18px] font-extrabold tracking-normal">Off-plan Sets</h2>
                    <p className="mt-1 text-[12.5px] text-text-2">
                      เซ็ตเหล่านี้ยังอยู่กับ session วันนี้ แต่ไม่ได้อยู่ใน Plan variant ที่เลือกอยู่
                    </p>
                  </div>
                  {offPlanExercises.map((exercise) => (
                    <ExerciseRow
                      key={exercise.planItemId}
                      exercise={exercise}
                      sessionId={session.id}
                    />
                  ))}
                </section>
              )}
            </div>
          </section>
        </section>

        <aside className={styles.aside}>
          <section className="grid content-start gap-[clamp(14px,1.4vw,24px)] rounded-[20px] border border-border bg-surface p-[clamp(18px,2vw,32px)]">
            <h2 className="text-[clamp(22px,2vw,34px)] font-extrabold tracking-normal">Today</h2>
            <dl className="grid grid-cols-3 gap-3">
              <Meta label="Workouts" value={String(exercises.length)} />
              <Meta label="Sets" value={String(totalSets)} />
              <Meta label="Progress" value={`${pct}%`} />
            </dl>
            <p className="text-[clamp(15px,1.3vw,22px)] text-text-1">
              Workout data from today and earlier
            </p>
            <div className="grid gap-3">{(recent ?? []).map(row => <Link key={row.id} href={`/history/${row.id}`} className="flex justify-between gap-3 rounded-[15px] bg-surface-2 px-4 py-3"><strong>{row.plan_days?.label ?? "Workout"}</strong><span className="text-text-2">{row.date}</span></Link>)}</div>
          </section>

          <section className={styles.finishPanel} aria-label="Finish workout">
            {started && session.status !== "completed" ? (
              <FinishButton sessionId={session.id} />
            ) : (
              <button
                type="button"
                disabled
                className="ft-finish-button"
              >
                {session.status === "completed" ? "Workout finished" : "Finish Workout"}
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[11px] bg-surface-2 p-[clamp(12px,1.2vw,20px)]">
      <dd className="text-[clamp(21px,2.15vw,36px)] font-black leading-none tabular-nums">
        {value}
      </dd>
      <dt className="mt-2 text-[clamp(12px,1.15vw,20px)] text-text-2">{label}</dt>
    </div>
  );
}

const EN_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ordinal(day: number) {
  const mod10 = day % 10;
  const mod100 = day % 100;
  const suffix =
    mod10 === 1 && mod100 !== 11
      ? "st"
      : mod10 === 2 && mod100 !== 12
        ? "nd"
        : mod10 === 3 && mod100 !== 13
          ? "rd"
          : "th";
  return `${day}${suffix}`;
}

function englishFocusLabel(value: string) {
  const labels: Record<string, string> = {
    chest: "Chest",
    back_lat: "Back",
    shoulders: "Shoulders",
    legs: "Legs",
    arms: "Arms",
    core: "Core",
    glutes: "Glutes",
    cardio: "Cardio",
    neck: "Neck",
  };
  return labels[value] ?? focusLabel(value);
}
