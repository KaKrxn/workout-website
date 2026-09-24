import { ScheduleCalendar } from "./calendar";
import { todayISO } from "@/lib/date";
import { getLocale } from "@/lib/i18n";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { focusLabel } from "@/lib/labels";
import {
  deleteVariant,
  duplicateVariant,
  renamePlanDayVariant,
  setDefaultVariant,
} from "./actions";

export const metadata = { title: "Schedule · FitTrack" };
export const dynamic = "force-dynamic";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: settings } = await supabase
    .from("user_settings")
    .select("active_plan_id, weekly_goal_days, weekly_cardio_goal")
    .eq("user_id", user.id)
    .single();

  const activePlanId = settings?.active_plan_id;
  const [{ data: plan }, { data: days }] = await Promise.all([
    activePlanId
      ? supabase.from("plans").select("id, name, use_when").eq("id", activePlanId).maybeSingle()
      : Promise.resolve({ data: null }),
    activePlanId
      ? supabase
          .from("plan_days")
          .select("id, day_of_week, label, focus, is_rest, is_cardio_day, variant_label, variant_order, is_default")
          .eq("plan_id", activePlanId)
          .order("day_of_week")
          .order("variant_order")
      : Promise.resolve({ data: [] }),
  ]);

  const planDayIds = (days ?? []).map((day) => day.id);
  const { data: allItems } = planDayIds.length
    ? await supabase.from("plan_items").select("id, plan_day_id, target_sets, exercises(name)").in("plan_day_id", planDayIds)
    : { data: [] };

  const counts = new Map<string, number>();
  for (const item of allItems ?? []) counts.set(item.plan_day_id, (counts.get(item.plan_day_id) ?? 0) + 1);

  const daysByDow = new Map<number, NonNullable<typeof days>[number][]>();
  for (const day of days ?? []) {
    if (day.day_of_week == null) continue;
    const list = daysByDow.get(day.day_of_week) ?? [];
    list.push(day);
    daysByDow.set(day.day_of_week, list);
  }

  return (
    <ScheduleCalendar days={days ?? []} items={allItems ?? []} today={todayISO()} locale={await getLocale()}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-black tracking-normal">Schedule</h1>
          <p className="mt-1 text-[13px] text-text-2">
            {plan?.name ?? "No active plan"} · strength {settings?.weekly_goal_days ?? 5}/week · cardio{" "}
            {settings?.weekly_cardio_goal ?? 3}/week
          </p>
        </div>
      </div>

      {!activePlanId ? (
        <EmptyCopy text="ยังไม่มี active plan สำหรับบัญชีนี้" />
      ) : (
        <div className="grid gap-3 min-[860px]:grid-cols-7">
          {DAY_NAMES.map((name, dow) => {
            const variants = daysByDow.get(dow) ?? [];
            return (
              <section key={name} className="rounded-[20px] border border-border bg-surface p-4">
                <h2 className="text-[15px] font-extrabold tracking-normal">{name}</h2>
                <div className="mt-3 grid gap-2">
                  {variants.length === 0 ? (
                    <p className="text-[12.5px] text-text-2">ยังไม่มี plan</p>
                  ) : (
                    variants.map((variant) => (
                      <article
                        key={variant.id}
                        className="rounded-[12px] border border-border bg-surface-2 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[13px] font-bold">{variant.variant_label}</p>
                            <p className="mt-0.5 text-[12px] text-text-2">{variant.label}</p>
                          </div>
                          {variant.is_default && (
                            <span className="rounded-full bg-s1/15 px-2 py-0.5 text-[11px] font-bold text-good-text">
                              default
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {variant.is_rest ? (
                            <span className="rounded-[7px] bg-[var(--ft-chip)] px-2 py-0.5 text-[11px] text-text-2">
                              Rest
                            </span>
                          ) : (
                            (variant.focus ?? []).map((focus) => (
                              <span key={focus} className="rounded-[7px] bg-[var(--ft-chip)] px-2 py-0.5 text-[11px]">
                                {focusLabel(focus)}
                              </span>
                            ))
                          )}
                        </div>
                        <p className="mt-3 text-[12px] tabular-nums text-text-2">
                          {counts.get(variant.id) ?? 0} exercises
                        </p>
                        <form action={renamePlanDayVariant} className="mt-3 flex gap-2">
                          <input type="hidden" name="id" value={variant.id} />
                          <input
                            name="variantLabel"
                            defaultValue={variant.variant_label}
                            aria-label={`Rename ${variant.variant_label}`}
                            className="min-w-0 flex-1 rounded-[9px] border border-border bg-surface-2 px-2.5 py-2 text-[12px] font-bold text-text-1"
                          />
                          <button
                            type="submit"
                            className="rounded-[9px] bg-[var(--ft-chip)] px-3 py-2 text-[12px] font-extrabold text-text-1"
                          >
                            Save
                          </button>
                        </form>
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          <form action={setDefaultVariant}>
                            <input type="hidden" name="id" value={variant.id} />
                            <button
                              type="submit"
                              disabled={variant.is_default}
                              className="h-9 w-full rounded-[9px] bg-s1/15 px-2 text-[11px] font-extrabold text-good-text disabled:opacity-40"
                            >
                              Default
                            </button>
                          </form>
                          <form action={duplicateVariant}>
                            <input type="hidden" name="id" value={variant.id} />
                            <button
                              type="submit"
                              className="h-9 w-full rounded-[9px] bg-[var(--ft-chip)] px-2 text-[11px] font-extrabold text-text-1"
                            >
                              Copy
                            </button>
                          </form>
                          <form action={deleteVariant}>
                            <input type="hidden" name="id" value={variant.id} />
                            <button
                              type="submit"
                              className="h-9 w-full rounded-[9px] bg-[#eb6834]/15 px-2 text-[11px] font-extrabold text-[#ff946f]"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                        <Link
                          href={`/schedule/${variant.id}`}
                          className="mt-2 block rounded-[9px] border border-[#5fd482]/35 px-3 py-2 text-center text-[11px] font-extrabold text-good-text"
                        >
                          Edit exercises
                        </Link>
                      </article>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </ScheduleCalendar>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return (
    <div className="rounded-[20px] border border-border bg-surface p-5 text-[13px] text-text-2">
      {text}
    </div>
  );
}
