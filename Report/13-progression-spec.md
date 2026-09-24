# 13 — Progression Engine

How the app decides that training should get harder, and tells the user before they start the set.

Expands `01-product-spec.md` §5.2 into something implementable, and adds the day-counting the
original design did not have. Referenced from `11-end-to-end-plan.md` §4.2.

---

## 1. The model: performance leads, time advises

Two questions get answered separately, and only one of them can change the plan.

| Question | Answered by | Can it change the target? |
|---|---|---|
| *Should today be harder?* | **Performance** — what was logged last time | **Yes** |
| *How long until it gets harder?* | **Time / session count** — a projection | No, it only informs |
| *Has this stalled?* | **Time** — no progress for N weeks | Yes, it triggers a suggestion |

Performance leads because a calendar cannot know whether the last set was easy. Time advises
because "keep going, you'll be adding weight in about two sessions" is the sentence that keeps
someone training on a day they'd otherwise skip.

**Nothing changes silently.** Every step up is a suggestion the user accepts or dismisses, recorded
in `progression_events`. The app proposes; the person decides.

---

## 2. Per-set targets

### 2.1 Strength — the reference case

State for one exercise: working weight `W`, the previous session's reps per set `prev[]`, and the
plan's `rep_min`…`rep_max`.

```
target[i] = min(prev[i] + 1, rep_max)
```

That is the whole rep rule. Add one rep per set per session until every set sits at the top of the
range.

**Adding weight** happens only when the previous session had `prev[i] >= rep_max` for **every**
set. Then:

```
W' = W + step(exercise, W)
target = [rep_min, rep_min, …]      // restart at the bottom of the range
```

### 2.2 The increment, and the guard that matters

`step()` is `exercises.weight_step_kg`, default 2.5 kg. But a fixed step is wrong at low loads: a
2.5 kg jump on a 7.5 kg lateral raise is **+33%**, which will fail immediately and read to the user
as going backwards.

```
proposed = W + step
if (proposed - W) / W > 0.10:
    → do not offer the weight increase yet
    → offer to raise the rep ceiling instead (§2.3)
```

A 10% ceiling on a single jump. Below that, add weight; above it, the exercise is too light for the
available increment and reps are the only honest lever.

### 2.3 Raising the rep range

Used when weight cannot move — bodyweight exercises at their ceiling, or light isolation work
caught by the 10% guard.

```
rep_min' = rep_min + 2
rep_max' = rep_max + 3
```

This edits `plan_items` for that exercise, so it is a change to the user's plan and **requires
explicit acceptance**:

> **Push-up — 15 reps on every set**
> Raise the range to 10–18 reps?   `[Raise it]` `[Not yet]`

### 2.4 Duration exercises

Plank and anything else stored in seconds. Same shape, different units:

```
target[i] = min(prev[i] + 5, duration_max_s)
```

At the ceiling on every set, offer `duration_min_s + 10` / `duration_max_s + 15`.

### 2.5 Per-side exercises

Left and right are two rows per set and **progress independently** — a weaker side is normal and
forcing them to move together holds the strong side back.

- `target` is computed per side from that side's history.
- The weight increase requires **both** sides at `rep_max` on every set.
- If one side has been behind by ≥ 2 reps for 3 sessions, note it once:
  *"ข้างซ้ายตามหลังอยู่ 2 ครั้ง — ลองเริ่มเซ็ตด้วยข้างซ้ายก่อน"*

### 2.6 Cardio — deliberately excluded

Treadmill work has no progression rule. It is logged and counted toward the weekly cardio target,
and that is all. Adding auto-progression to cardio would push duration up on the same weeks
strength volume is rising, which is how people get injured.

---

## 3. The day counter

This is the part the original design was missing.

### 3.1 What is shown

On each exercise row, below the target:

```
▸ Today   12.5 kg → 12 / 11 / 10 / 9
   ทำท่านี้มา 5 ครั้ง · 18 วันตั้งแต่เพิ่มน้ำหนักล่าสุด
   อีกประมาณ 2 ครั้งน่าจะเพิ่มเป็น 15 kg ได้
```

Three facts, all computed, none of them changing the target:

| Line | Source |
|---|---|
| Sessions with this exercise since the last weight increase | `progression_events` + `session_sets` |
| Days since the last weight increase | `progression_events.created_at` |
| Projected sessions until the next increase | §3.2 |

### 3.2 The projection

```
repsRemaining   = Σ over sets of (rep_max - prev[i])
avgGainPerSess  = observed rep gain over the last 3 sessions, floored at 1
sessionsLeft    = ceil(repsRemaining / avgGainPerSess)
daysLeft        = sessionsLeft × (days between this exercise's slots in the plan)
```

Show it only when `sessionsLeft <= 6`. Beyond that the estimate is noise, and a number that keeps
moving is worse than no number.

Phrase it as an estimate — *"อีกประมาณ 2 ครั้ง"* — never as a promise.

### 3.3 Stall detection

```
if daysSinceWeightIncrease >= 21
   and no rep improvement across the last 3 sessions:
       → suggest a deload or a harder variation
```

Deload = drop to 90% of `W`, rounded to the equipment's step, and rebuild. This is the rule already
recorded in `program-seed.json` → `progressiveOverload.deloadTrigger`, made concrete.

### 3.4 The too-fast guard

```
if two accepted weight increases for this exercise within 7 days:
       → show the increase, but add:
         "เพิ่มน้ำหนักสองครั้งในสัปดาห์เดียว — ถ้ารู้สึกฝืน ให้อยู่ที่น้ำหนักนี้อีกสักครั้ง"
```

Advisory only. It does not block.

### 3.5 Equipment ceiling

`user_equipment.max_weight_kg` is 25 kg for the adjustable dumbbells. When `W + step > 25`:

> **Goblet Squat ถึงเพดานดัมเบลแล้ว (25 kg)**
> เพิ่มความยากด้วยท่าขาเดียวแทน — Bulgarian Split Squat หรือ Single-leg RDL

The suggested substitutes come from `exercises.harder_variant_of` (§5). Until that column is
populated the banner still fires; it just has nothing to link to.

---

## 4. Where it runs

`lib/progression.ts` — **a pure function, no I/O**. It receives everything it needs and returns a
plan for the row.

```ts
export interface ProgressionInput {
  kind: "strength" | "bodyweight" | "duration" | "cardio";
  repMin: number | null;
  repMax: number | null;
  durationMinS: number | null;
  durationMaxS: number | null;
  targetSets: number;
  perSide: boolean;
  weightStepKg: number;
  equipmentMaxKg: number | null;
  /** Previous completed session for this exercise, per side. */
  previous: { weightKg: number | null; reps: (number | null)[]; durationS: (number | null)[] } | null;
  history: { sessionDate: string; topWeightKg: number | null; totalReps: number }[]; // last 3–5
  lastIncrease: { at: string; toWeightKg: number } | null;
  planIntervalDays: number;
}

export type ProgressionResult =
  | { type: "first-time"; hint: string }
  | { type: "reps";        targets: number[]; projection?: Projection }
  | { type: "duration";    targets: number[]; projection?: Projection }
  | { type: "add-weight";  fromKg: number; toKg: number; targets: number[]; tooFast: boolean }
  | { type: "raise-range"; fromRange: [number, number]; toRange: [number, number] }
  | { type: "ceiling";     maxKg: number; suggestions: string[] }
  | { type: "deload";      fromKg: number; toKg: number }
  | { type: "none" };      // cardio
```

Pure means it is fully unit-testable without a database, which is the point — this is the one piece
of logic where being wrong sends someone into a set with a load they cannot handle.

**Write the tests before the UI.** Minimum table:

| Case | Expect |
|---|---|
| No history | `first-time` with a starting-weight hint |
| `prev = [11,10,9,8]`, max 12 | `reps` → `[12,11,10,9]` |
| `prev = [12,12,12,12]`, max 12, W 12.5, step 2.5 | `add-weight` 12.5 → 15 |
| Same but W 7.5 (step is 33%) | `raise-range`, not `add-weight` |
| Bodyweight at ceiling | `raise-range` |
| Plank `prev=[45,40,40]`, max 60 | `duration` → `[50,45,45]` |
| Per-side, left at ceiling, right not | `reps` — no weight increase |
| W 22.5, step 2.5, equipment max 25 | `add-weight` to 25 |
| W 25, equipment max 25 | `ceiling` |
| 21 days, no rep gain in 3 sessions | `deload` 25 → 22.5 |
| Two increases inside 7 days | `add-weight` with `tooFast: true` |
| Cardio | `none` |

---

## 5. Schema

Migration `20260818000300_progression.sql`.

```sql
-- Per-exercise increment. Fixed 2.5 kg is wrong for light isolation work.
alter table exercises
  add column weight_step_kg numeric(4,2) not null default 2.5
  check (weight_step_kg > 0);

-- Suggested substitute when the equipment ceiling is reached.
alter table exercises
  add column harder_variant_of text references exercises(id);

-- Every accepted or dismissed step, so "days since the last increase" is one
-- indexed lookup rather than a scan, and so the overload chart has a clean source.
create table progression_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  exercise_id text not null references exercises(id),
  kind        text not null check (kind in
                ('weight_up','weight_down','range_up','variation','dismissed')),
  from_value  numeric(6,2),
  to_value    numeric(6,2),
  session_id  uuid references sessions(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index on progression_events (user_id, exercise_id, created_at desc);

alter table progression_events enable row level security;

create policy own_rows on progression_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Seed follow-up: set `harder_variant_of` for the three exercises that exist in the library purely as
progressions and are referenced by no plan — `decline_pushup` (harder than `pushup`), `sl_rdl`
(harder than `db_rdl`), and `bulgarian_split` (harder than `goblet_squat`).

Everything else the engine needs already exists in `session_sets` and `plan_items`.

---

## 6. UI

### 6.1 Exercise row — replaces the hardcoded `+rep ready` badge

```
● Dumbbell Bench Press                              Last time
  4 sets × 8–12 reps · 12.5 kg                      12 / 12 / 12 / 12
  ▸ Today  15 kg → 8 / 8 / 8 / 8
     ทำท่านี้มา 6 ครั้ง · 21 วันตั้งแต่เพิ่มน้ำหนักล่าสุด
```

`Last time` and `Today` are headings — English in both locales (`12-i18n-spec.md` §1). The
sentences under them are translated.

### 6.2 Banners

One per session at most, at the top of the exercise list, ordered `ceiling` → `deload` →
`add-weight` → `raise-range`. Never stack them: a screen of four suggestions gets none of them read.

Each carries two buttons — accept, or *"ยังไม่เอา"* — and both write a `progression_events` row.
Dismissing suppresses that suggestion for **7 days** for that exercise.

### 6.3 Stats

The step chart in `04-analytics-spec.md` G7 reads `progression_events` directly instead of deriving
weight changes from `session_sets`, which makes it exact rather than inferred.

---

## 7. Settings

Under a **Progression** group:

| Control | Default | Effect |
|---|---|---|
| Rep increment per session | 1 | The `+1` in §2.1 |
| Weight increment | per-exercise, 2.5 kg | Overrides `weight_step_kg` globally |
| Stall window | 3 weeks | The 21 days in §3.3 |
| Show projections | on | Hides §3.1's third line for anyone who finds it distracting |
| Auto-suggest harder variations | on | Turns off the `ceiling` banner |

Defaults come from `program-seed.json` → `progressiveOverload`, which currently no code reads.
This is where those values finally get consumed.

---

## 8. Acceptance

- [ ] `lib/progression.ts` is pure — no imports from `@/lib/supabase`
- [ ] Every row of the §4 test table passes before any UI is written
- [ ] The hardcoded `+rep ready` badge is gone
- [ ] `Last time` and `Today` both render on every strength and bodyweight row
- [ ] A 2.5 kg step on a 7.5 kg lift offers a rep-range raise, not a weight increase
- [ ] Per-side exercises progress each side independently
- [ ] Accepting a suggestion writes `progression_events`; dismissing suppresses it for 7 days
- [ ] The day counter and projection appear only when the projection is ≤ 6 sessions out
- [ ] At 25 kg the ceiling banner fires and links to a harder variation
- [ ] Cardio rows show no progression UI at all
- [ ] All strings resolve through the dictionary; headings stay English
