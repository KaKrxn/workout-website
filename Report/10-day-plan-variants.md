# 10 — Day Plan Variants

**Supersedes `01-product-spec.md` §5.1.** The per-day A/B *program* swap described there is
withdrawn. This document replaces it with what the user actually asked for, which is smaller.

---

## 1. What changed

The old design treated **Program A** and **Program B** as two separate programs the app had to
reconcile, and paired their days by muscle focus:

| Focus | Program B | Program A |
|---|---|---|
| Back | Tue | Wed |
| Legs | Wed / Sat | Tue / Sat |

That pairing was invented by the design, not requested. It cost a focus-matching table, a
cross-weekday mapping that conflicted with how sessions are generated (by weekday), an undefined
case for Thursday (B = cardio, A = rest), and a `focus` array on every Program A day that the seed
never had. All of it is deleted.

**The actual requirement:** a weekday holds more than one plan, and the user picks which one on the
day. Monday can offer *"ดัมเบล"* and *"ไม่ใช้อุปกรณ์"*. Nothing pairs across weekdays, nothing
matches on muscle focus, and Thursday needs no special case — if a day has one variant, there is
nothing to pick.

---

## 2. The model

```
plan  ("ตารางของฉัน")
 └── plan_day  (weekday × variant)          ← a row per variant, not per weekday
      ├── Mon · "ดัมเบล"        is_default ✓ ── plan_items…
      ├── Mon · "ไม่ใช้อุปกรณ์"              ── plan_items…
      ├── Tue · "ดัมเบล"        is_default ✓ ── plan_items…
      └── …
```

- A **variant** is one `plan_days` row: a label, a focus list, and its own list of exercises.
- Exactly one variant per weekday is `is_default` — the scheduler uses it when generating sessions.
- A weekday with a single variant is the normal case. The picker simply doesn't render.
- `sessions.plan_day_id` records **which variant was actually done**, so history and analytics get
  this for free with no extra column.

`plans` keeps its existing meaning (a whole template the user can switch wholesale). Variants live
*inside* a plan. The two are different levers and both are useful:

| Lever | Scope | When |
|---|---|---|
| Switch active `plan` | Everything from now on | "I'm starting a new 12-week block" |
| Switch a day's variant | That one date | "No dumbbells today" |

---

## 3. Schema delta

Migration: `supabase/migrations/20260818000100_day_plan_variants.sql`

```sql
alter table plan_days
  add column variant_label text    not null default 'Plan A',
  add column variant_order int     not null default 1,
  add column is_default    boolean not null default true;

-- a weekday now holds many rows
alter table plan_days drop constraint plan_days_unique_day;
alter table plan_days add constraint plan_days_unique_variant
  unique nulls not distinct (plan_id, day_of_week, variant_label);

-- exactly one variant per weekday is the scheduled one
create unique index plan_days_one_default_per_day
  on plan_days (plan_id, day_of_week)
  where is_default and day_of_week is not null;

-- switching must UPDATE one session, never create a second
create unique index sessions_one_plan_linked_per_day
  on sessions (user_id, date)
  where plan_day_id is not null;
```

Plus `switch_session_plan(session_id, plan_day_id)` — `security invoker`, so RLS decides ownership
while the function checks only that the target is a sibling variant of the same plan and weekday.

**Nothing else changes.** `plan_items`, `sessions`, `session_sets`, `daily_stats` and every RLS
policy are untouched. `plan_items` already hangs off `plan_day_id`, which is exactly the grain a
variant needs.

**Migration is not reversible without data loss** — dropping the columns would collapse every
weekday's variants into a uniqueness violation. Take a dump first.

---

## 4. Scheduler behaviour

`/api/cron/generate-sessions` and the provisioning path change in one place: when generating a
`planned` session for a date, select the weekday's **default** variant.

```sql
select id, focus
from plan_days
where plan_id = $1
  and day_of_week = $2
  and is_default
```

A user who never touches the picker sees exactly the behaviour they see today.

---

## 5. Today page

### 5.1 The picker

Rendered **only when the weekday has ≥ 2 variants** — a segmented control in the card header,
labelled with `variant_label`, ordered by `variant_order`. Selected = the session's current
`plan_day_id`.

Tapping a variant calls `switch_session_plan`. The exercise list re-renders from the new variant's
`plan_items`.

### 5.2 Logged sets survive the switch

Sets belong to the **session**, not to the plan. Switching repoints `plan_day_id` and leaves
`session_sets` alone.

This means a set can be logged against an exercise that is not in the newly selected variant. Those
sets must still be visible — silently hiding logged work is worse than showing it out of place.

**Render them in a section below the plan's exercises:**

```
── นอกแผน ─────────────────────────
   Dumbbell Bench Press   12.5 kg → 12 / 12        [ลบ]
```

Rules:

- The section only appears when such sets exist.
- Each row is deletable, so a user who switched by mistake can clean up.
- These sets **count** toward `daily_stats` (volume, sets-by-muscle) — the work happened.
- They do **not** count toward the progress bar, which measures the current variant's plan.

### 5.3 Confirmation

Switching with sets already logged shows a confirm dialog:

> **เปลี่ยนเป็น "ไม่ใช้อุปกรณ์"?**
> มี 3 เซ็ตที่บันทึกไว้แล้ว — ระบบจะเก็บไว้ให้ และแสดงไว้ใต้หัวข้อ "นอกแผน"
> `[ยกเลิก]` `[เปลี่ยน]`

No confirm when nothing is logged yet.

---

## 6. Schedule page

Each day cell in the 7-column week view lists its variants:

```
┌─ จันทร์ 10 ────────────┐
│ ● ดัมเบล        ⋯      │   ● = default (the one the scheduler picks)
│ ○ ไม่ใช้อุปกรณ์  ⋯      │
│ ＋ เพิ่ม Plan          │
└────────────────────────┘
```

Actions per variant (`⋯` menu): **แก้ไขท่า** · **เปลี่ยนชื่อ** · **ตั้งเป็นค่าเริ่มต้น** · **ทำสำเนา** · **ลบ**

Rules:

- **＋ เพิ่ม Plan** creates an empty variant, or offers "ทำสำเนาจาก …" to start from an existing one.
- Deleting a variant is blocked while any session points at it — offer *"ลบและย้ายเซสชันไปที่ค่าเริ่มต้น"* instead.
- Deleting the default promotes the next variant by `variant_order`. The last variant of a weekday
  cannot be deleted; delete the whole day (mark it a rest day) instead.
- Renaming is free-text, unique within the weekday. Suggested defaults: `Plan A`, `Plan B`, …
- Changing a variant's exercises affects **future planned sessions only**. Sessions already
  `partial` or `completed` keep what was logged.

---

## 7. Edge cases

| Case | Behaviour |
|---|---|
| Weekday has one variant | No picker on Today, no radio dots on Schedule |
| Session is `completed` | Picker is disabled — switching after the fact would rewrite history |
| Session is ad-hoc (`plan_day_id is null`) | No picker; `switch_session_plan` raises |
| Target variant belongs to another weekday or plan | Raises `check_violation` |
| Two variants given the same label | Rejected by `plan_days_unique_variant` |
| Every variant of a weekday is a rest day | Fine — Today shows the rest card and the picker still lets the user choose which rest note applies |
| Cron runs while a user is mid-switch | Cron only touches future `planned` sessions; today's row is already generated |

---

## 8. What this removes

Delete from the design, and do not implement:

- The focus-based day pairing table (`01-product-spec.md` §5.1)
- The "streak does not break because we count muscle groups" rule — with variants inside one
  weekday, the day is the same day either way, so the streak was never at risk
- The requirement that Program A's days carry a `focus` array for pairing purposes
  *(`focus` is still worth filling for history tags and the muscle-balance chart — but it is no
  longer load-bearing)*
- The undefined Thursday case

---

## 9. Checklist

- [ ] Run the migration on staging, confirm `sessions_one_plan_linked_per_day` does not fail
- [ ] Scheduler selects `is_default` when generating sessions
- [ ] Provisioning sets `is_default = true` on every day it creates
- [ ] Today: picker renders only at ≥ 2 variants, and is disabled on `completed`
- [ ] Today: "นอกแผน" section appears after a switch that orphans logged sets
- [ ] Today: progress bar counts the current variant only; `daily_stats` counts everything
- [ ] Schedule: add / rename / duplicate / set-default / delete, with the delete guards in §6
- [ ] `switch_session_plan` rejects a cross-weekday and cross-plan target
- [ ] Another user cannot switch your session (covered by RLS — assert it in `test:rls`)
