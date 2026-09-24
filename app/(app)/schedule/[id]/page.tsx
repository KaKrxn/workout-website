import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { focusLabel } from "@/lib/labels";
import {
  addPlanItem,
  movePlanItem,
  removePlanItem,
  updatePlanItem,
} from "../actions";

export const metadata = { title: "Edit Schedule · FitTrack" };
export const dynamic = "force-dynamic";

export default async function ScheduleVariantPage({ params }: PageProps<"/schedule/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: variant }, { data: items }, { data: exercises }] = await Promise.all([
    supabase
      .from("plan_days")
      .select("id, label, focus, is_rest, variant_label, is_default, plans ( name )")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("plan_items")
      .select(
        `id, exercise_id, order_index, target_sets, target_rep_min, target_rep_max,
         target_duration_min_s, target_duration_max_s, per_side, is_key, note,
         exercises ( name, kind, muscle )`,
      )
      .eq("plan_day_id", id)
      .order("order_index"),
    supabase
      .from("exercises")
      .select("id, name, kind, muscle")
      .order("name")
      .limit(150),
  ]);

  if (!variant) notFound();

  return (
    <div className="py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/schedule" className="text-[12px] font-bold text-good-text">
            Back to Schedule
          </Link>
          <h1 className="mt-2 text-[30px] font-black tracking-normal">{variant.variant_label}</h1>
          <p className="mt-1 text-[13px] text-text-2">
            {variant.plans?.name ?? "Plan"} · {variant.label}
            {variant.is_default ? " · default" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {variant.is_rest ? (
            <span className="rounded-[7px] bg-[var(--ft-chip)] px-2 py-1 text-[11px] text-text-2">
              Rest
            </span>
          ) : (
            (variant.focus ?? []).map((focus) => (
              <span key={focus} className="rounded-[7px] bg-[var(--ft-chip)] px-2 py-1 text-[11px]">
                {focusLabel(focus)}
              </span>
            ))
          )}
        </div>
      </div>

      <form action={addPlanItem} className="mb-4 grid gap-2 rounded-[20px] border border-border bg-surface p-4 min-[720px]:grid-cols-[minmax(0,1fr)_auto]">
        <input type="hidden" name="planDayId" value={variant.id} />
        <label className="grid gap-1">
          <span className="text-[12px] font-bold text-text-2">Add Exercise</span>
          <select
            name="exerciseId"
            className="rounded-[10px] border border-border bg-surface-2 px-3 py-3 text-[13px] font-bold text-text-1"
            defaultValue=""
          >
            <option value="" disabled>
              Select an exercise
            </option>
            {(exercises ?? []).map((exercise) => (
              <option key={exercise.id} value={exercise.id}>
                {exercise.name} · {exercise.kind} · {focusLabel(exercise.muscle)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded-[10px] bg-s1 px-5 py-3 text-[13px] font-black text-on-accent"
        >
          Add
        </button>
      </form>

      <div className="grid gap-3">
        {(items ?? []).map((item, index) => (
          <article key={item.id} className="rounded-[20px] border border-border bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-extrabold tracking-normal">
                  {index + 1}. {item.exercises?.name ?? item.exercise_id}
                </h2>
                <p className="mt-1 text-[12px] text-text-2">
                  {item.exercises?.kind ?? "strength"} · {focusLabel(item.exercises?.muscle ?? "")}
                </p>
              </div>
              <div className="flex gap-1.5">
                <MoveButton id={item.id} direction={-1} label="Up" disabled={index === 0} />
                <MoveButton
                  id={item.id}
                  direction={1}
                  label="Down"
                  disabled={index === (items?.length ?? 0) - 1}
                />
                <form action={removePlanItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="h-9 rounded-[9px] bg-[#eb6834]/15 px-3 text-[11px] font-extrabold text-[#ff946f]"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </div>

            <form action={updatePlanItem} className="grid gap-3 min-[780px]:grid-cols-6">
              <input type="hidden" name="id" value={item.id} />
              <NumberInput name="targetSets" label="Sets" defaultValue={item.target_sets} />
              <NumberInput name="targetRepMin" label="Rep min" defaultValue={item.target_rep_min} />
              <NumberInput name="targetRepMax" label="Rep max" defaultValue={item.target_rep_max} />
              <NumberInput
                name="targetDurationMinS"
                label="Min sec"
                defaultValue={item.target_duration_min_s}
              />
              <NumberInput
                name="targetDurationMaxS"
                label="Max sec"
                defaultValue={item.target_duration_max_s}
              />
              <label className="grid gap-1">
                <span className="text-[12px] font-bold text-text-2">Flags</span>
                <span className="flex h-[42px] items-center gap-3 rounded-[10px] border border-border bg-surface-2 px-3 text-[12px] font-bold">
                  <input name="perSide" type="checkbox" defaultChecked={item.per_side} />
                  Side
                  <input name="isKey" type="checkbox" defaultChecked={item.is_key} />
                  Key
                </span>
              </label>
              <label className="grid gap-1 min-[780px]:col-span-5">
                <span className="text-[12px] font-bold text-text-2">Note</span>
                <input
                  name="note"
                  defaultValue={item.note ?? ""}
                  className="rounded-[10px] border border-border bg-surface-2 px-3 py-3 text-[13px] text-text-1"
                />
              </label>
              <button
                type="submit"
                className="self-end rounded-[10px] bg-[var(--ft-chip)] px-4 py-3 text-[12px] font-extrabold text-text-1"
              >
                Save
              </button>
            </form>
          </article>
        ))}
      </div>

      {(items ?? []).length === 0 && (
        <div className="rounded-[20px] border border-border bg-surface p-5 text-[13px] text-text-2">
          ยังไม่มี exercise ใน variant นี้
        </div>
      )}
    </div>
  );
}

function NumberInput({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: number | null;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-[12px] font-bold text-text-2">{label}</span>
      <input
        name={name}
        type="number"
        min={0}
        defaultValue={defaultValue ?? ""}
        className="rounded-[10px] border border-border bg-surface-2 px-3 py-3 text-[13px] font-bold tabular-nums text-text-1"
      />
    </label>
  );
}

function MoveButton({
  id,
  direction,
  label,
  disabled,
}: {
  id: string;
  direction: -1 | 1;
  label: string;
  disabled: boolean;
}) {
  return (
    <form action={movePlanItem}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        className="h-9 rounded-[9px] bg-[var(--ft-chip)] px-3 text-[11px] font-extrabold text-text-1 disabled:opacity-40"
      >
        {label}
      </button>
    </form>
  );
}
