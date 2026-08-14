# 01 — Product Spec

## 1. User and context

**The user:** someone training alone at home with limited equipment, who wants to change their
physique — not merely lose weight.

| Fact | Design consequence |
|---|---|
| Trains at home, no coach | The app has to do the coach's job — say what today's session is, how heavy, and whether it's time to progress |
| Dumbbell tops out at 25 kg | Once the weight ceiling is reached, the app must offer other ways to add difficulty (single-leg variants, slower tempo, extra sets) |
| Bench does not incline | The exercise library has to know equipment limits and offer substitutes (decline push-up instead of incline press) |
| Two programs (A/B) exist | Programs must be swappable per day, not chosen once and locked in |
| The goal is shape, not the number on the scale | The headline metric has to be a body proportion, not bodyweight |

## 2. User goals → tracked metrics

| Goal | Metric the app tracks | Where it shows |
|---|---|---|
| Overall fat loss (sharper chin/jawline) | `body_fat_pct`, `measure_waist`, `measure_neck` | Stat tile + line chart |
| Wider back / V-taper | **`v_taper_ratio` = shoulder circumference ÷ waist circumference** | ★ The headline chart of the analytics page |
| Wider shoulders | `measure_shoulder` + shoulder-group volume | Measurement chart + body page |
| Bigger chest | `measure_chest` + DB bench press PR | PR chart |
| Train the whole body | Set balance per muscle group, against the priority order | Bar chart vs target |
| Stay consistent | Streak, adherence %, heatmap | Stat tile + heatmap |

**The principle behind this:** the app does not ask for bodyweight first.
Building muscle while losing fat tends to leave bodyweight flat while the physique changes —
if the app led with the scale, the user would conclude the program isn't working.
**`v_taper_ratio` is therefore the hero number.**

## 3. Design principles

1. **Logging has to be faster than thinking about logging** — nobody wants to fill in a six-field
   form between sets. Use `+`/`−` buttons pre-filled from last time; one tap completes a set.
2. **The app should decide, not just store** — show "Today's target: 11 reps" (computed from double
   progression) instead of making the user go dig through history for what they did last time.
3. **The plan is the intent, the session is what happened** — keep them separate in the database,
   then compare them as an adherence percentage, which measures consistency better than a raw count.
4. **Never punish a miss** — no red for a missed day; use a faint empty cell instead. Planned rest
   days render as a dashed outline and do not count as misses.
5. **Mobile first** — used at home, one-handed. Primary actions must sit within thumb reach.
6. **Works offline** — write to IndexedDB first, sync later.

## 4. Site structure

```
/                     Landing page
/login  /signup       Auth (email + Google)
/app
 ├── /today           ★ Today's workout + active-session mode
 ├── /schedule        ★ Week view · per-day A/B program swap
 ├── /analytics       ★ V-taper · body fat · consistency · progressive overload
 ├── /body            Log weight / body fat % / measurements + progress photos
 ├── /history         Per-session history
 ├── /library         Exercise library, 41 exercises (filtered by owned equipment)
 └── /settings        Equipment · weekly goals · units · theme · reminders
```

★ = present in the mobile bottom nav (with a round "start workout" button in the centre)

## 5. The three defining features

### 5.1 Per-day A / B program swap

Every day in the schedule has an `A ⇄ B` toggle. The system already pairs days across the two
programs by muscle focus:

| Focus | Program B (primary) | Program A (fallback) |
|---|---|---|
| Chest + shoulders + triceps | Mon | Mon |
| Back | Tue | Wed |
| Legs | Wed / Sat | Tue / Sat |
| Upper body | Fri | Fri |

Tapping the toggle swaps the exercise list immediately, and **the streak does not break**, because
the system counts "this muscle group was trained" rather than "this exercise was performed".

### 5.2 Progressive overload as a decision aid

Every exercise on the Today page shows three things:

```
Dumbbell Bench Press          4 × 6–12
Last time   12.5 kg → 11 / 10 / 9 / 8
Today       12.5 kg → 12 / 11 / 10 / 9        ← computed by the app
```

Once every set hits 12 reps, a banner appears:

> **Ready to add weight** — try 15 kg next week and restart at 6–8 reps.  `[Got it]`

If the weight hasn't moved for 3 weeks, the app suggests a deload or a harder variation
(e.g. Bulgarian split squat instead of goblet squat once 25 kg starts to feel light).

### 5.3 The V-taper ratio chart

`shoulder ÷ waist`, measured every 2 weeks, plotted as a line against a 1.618 target.
Two supporting rows under the chart (shoulder circumference / waist circumference) tell the user
whether the ratio improved because **the shoulders got wider** or because **the waist got smaller** —
which lead to different program adjustments.

## 6. Deliberately out of scope

| Not doing | Why |
|---|---|
| Social feed / likes / comments | Adds maintenance burden, splits focus, and doesn't serve the goal |
| Calorie counting / food logging | That's an entire second product — phase one logs daily protein as a single number and stops there |
| AI-generated programs | Programs A/B are good enough; AI would add confusion rather than help |
| Pushy notifications | At most one reminder per day, at a time the user chooses |
| Jaw exercisers / spot-reduction exercises | Not supported by evidence — the app should point at total body fat instead |

## 7. What the app must say out loud

The `/body` page and the analytics page must both carry this message:

> You cannot direct the body to burn fat from one specific area. Jawline definition comes from
> **lower total body fat percentage**, together with bone structure, muscle mass, and head/neck posture.

This exists so the user doesn't form the wrong expectation and quit halfway.
It is part of the product, not a disclaimer.
