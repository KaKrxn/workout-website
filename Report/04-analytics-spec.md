# 04 — Analytics Spec

The analytics page is the reason this app exists. This document specifies **every chart** —
its formula, its form, and why that form was chosen.

## Principles for choosing a chart form

1. Pick the **task the data has to do** first (magnitude / identity / polarity / headline /
   change over time); the form follows from that
2. **One y-axis per chart, always.** No dual axes. Different units mean different charts
3. Colour encodes identity, not rank — filter the data and the remaining series must keep their colours
4. Every chart has a hover tooltip and a "View as table" button

---

## Layer 1 — Stat tiles (the four across the top)

| Tile | Value | Formula | Notes |
|---|---|---|---|
| **V-Taper Ratio** ★ | `1.52` | `measure_shoulder / measure_waist`, latest values | Delta vs 8 weeks ago + the 1.618 target |
| **Body fat %** | `18.4%` | `body_fat_pct`, latest value | Delta vs 8 weeks ago (down = good, shown green) |
| **Streak** | `12 weeks` | Consecutive weeks where `session_count >= weekly_goal_days` | Compared against the personal best |
| **Adherence** | `82%` | `completed / (planned where date <= today)` | Over a fixed 90-day window, independent of the page's range filter |

**Why V-taper is first:** it's the single number that most directly answers the user's goal.
Bodyweight is deliberately absent from these four tiles, because during a simultaneous
build-and-cut it tends not to move and reads as failure.

**Delta direction:** metrics with `direction: down` (body fat, waist) show a green ▼.
Metrics with `direction: up` (shoulder, chest, V-taper) show a green ▲.
**Colour follows whether the change is favourable, never the direction of the arrow alone** —
and the arrow is always paired with a label so colour isn't doing the work by itself.

---

## Layer 2 — The charts

### G1. V-Taper Ratio ★

| | |
|---|---|
| **Form** | One line (`--s1`) + a dashed 1.618 target line (`--text-2`) |
| **x-axis** | Weeks. Measured biweekly, so it cannot be interpolated — plot only the points that have real data |
| **y-axis** | Ratio, starting at `min(data) - 0.05`, not 0 (starting at 0 makes the change invisible) |
| **Tooltip** | `Week X · 1.52 (shoulder 118 cm ÷ waist 78 cm)` |
| **Below the chart** | Two small rows: `Shoulder 118 cm ▲2` and `Waist 78 cm ▼3` |

**Why:** the user needs to know whether the ratio improved because *the shoulders got wider* or
because *the waist got smaller* — the two lead to different program adjustments. If only the waist
shrank, shoulder and back volume needs to go up.

**Do not:** put "shoulder (cm)" and "ratio" on one chart with two y-axes.

### G2. Consistency heatmap ★

| | |
|---|---|
| **Form** | 53-week × 7-day grid, 12px cells, 3px gap, 3px radius |
| **Colour** | Single-hue blue scale, 5 steps, by that day's volume |
| **Empty** | A day that was planned but not done = base fill `--hm0` |
| **Dashed outline** | A planned rest day — **does not count as a miss** |
| **Tooltip** | `13 Aug · chest + back + shoulders · 8,400 kg · 52 min` |
| **Click** | Jumps to that day's history entry |
| **Below the chart** | `Trained 146 of 365 days · longest gap 15 days` |

**Why:** it answers "am I consistent?" at a glance. A long gap is far more visible than any average.

**Separating planned rest from missed days matters a lot here.** Program B has one rest day and one
cardio day per week. Without the distinction, the heatmap looks patchy even during a perfect week.

### G3. Body fat % and bodyweight

**Two separate charts, stacked as small multiples — not one chart with two axes.**

| Chart | Form | Notes |
|---|---|---|
| Body fat % | Line `--s1` + faint area | Weekly data points |
| Bodyweight | Faint dots + a thick 7-day moving average in `--s1` | Daily weight swings ±1 kg — the average is the thing to read |

Caption under the weight chart: `Daily weight fluctuates normally — read the 7-day average.`

### G4. Weekly total volume

| | |
|---|---|
| **Form** | Line `--s1` + faint area + a dashed 4-week moving average (`--axis`) |
| **y-axis** | Starts at 0 (volume is a cumulative quantity, so 0 is the correct baseline) |
| **Units** | kg, abbreviated on the axis as `12k`, `24k` |
| **Range** | Last 26 weeks |

**How to read it:** the raw line bouncing around is normal. The average should trend gently
upward — that's progressive overload working.

### G5. Days trained vs goal

| | |
|---|---|
| **Form** | Vertical bars + a dashed 5-day goal line |
| **Colour** | Goal met = solid `--s1`; short of goal = light blue (`--hm1`) — same hue, not red |
| **Tooltip** | `Week of 12 Aug · trained 4 of 5 planned · cardio 2/3` |

**Why not red:** the "never punish a miss" principle. Depth of a single hue carries the level instead.

### G6. Muscle-group balance vs priority ★

| | |
|---|---|
| **Form** | Horizontal bars, single colour `--s1`, ordered by **the user's priority ranking**, not by value |
| **Data** | Set count per group over the last 90 days, from `daily_stats.sets_by_muscle` |
| **Target marker** | A thin vertical tick on each bar = the share that group should be getting |

The fixed order: `Back/lat → Shoulders → Chest → Legs → Arms → Core`

**Which of the nine muscle values appear here:**

| Value | Treatment in this chart |
|---|---|
| `back_lat`, `shoulders`, `chest`, `legs`, `arms`, `core` | One bar each, in the order above |
| `glutes` | Folded into the `legs` bar — it isn't ranked separately and always trains alongside legs |
| `cardio` | Excluded. This chart is about strength-training balance; cardio has its own chart (G8) |
| `neck` | Excluded. The neck add-on is optional and would distort the comparison |

**Why priority order and not value order:** the user needs to see immediately whether the group
that *should* get the most work (back) actually does. Sorting by value hides exactly that.

An automatic warning fires when a priority 1–2 group has fewer sets than a priority 5–6 group:

> `Back has 62 sets, fewer than arms (78). A V-taper goal wants more rows and pullovers than that.`

### G7. Per-exercise progressive overload

| | |
|---|---|
| **Form** | Step line in `--s2` — weight increases in discrete jumps, so a step line, not a linear one |
| **Exercise picker** | Dropdown; defaults to the five `is_key_lift` exercises |
| **y-axis** | Weight (kg), starting at `min - 5` |
| **Highlights** | Points where the weight increased get a larger marker and a numeric label |
| **Ceiling line** | Dashed line at 25 kg = the dumbbell ceiling, labelled `Equipment ceiling` |

The default exercises (from `is_key_lift` in the seed):
`Dumbbell Bench Press` · `Dumbbell Lateral Raise` · `One-arm Dumbbell Row` ·
`Bent-over Dumbbell Row` · `Dumbbell Pullover`

**Why these five:** they map to the stated goals of a bigger chest, a wider back, and wider shoulders.

### G8. Weekly cardio

| | |
|---|---|
| **Form** | Vertical bars in `--s2` + a target band of 75–120 min/week (2–3 sessions × 25–40 min) |
| **y-axis** | Minutes |

`--s2` keeps it visually separate from the `--s1` strength charts — different activity, different identity.

---

## Page layout

```
[ V-Taper ][ Body fat ][ Streak ][ Adherence ]   ← stat tiles
[ ═════════ G2 Heatmap, full width ═════════════ ]
[ G1 V-Taper Ratio      ][ G3 Body fat + weight ]
[ G4 Weekly volume      ][ G5 Days vs goal      ]
[ G6 Muscle balance     ][ G7 Progressive overload ]
[ ═════════════ G8 Cardio ═══════════════════════ ]
```

**The range filter** sits in one row at the top right and applies to every chart at once:
`30 days` · `90 days` · `1 year` · `All`

The adherence tile is the one exception — it stays on a fixed 90-day window so the headline
number doesn't change meaning when the filter moves.

---

## Non-negotiables (check before merging)

- [ ] No chart has two y-axes
- [ ] No chart uses more than 3 series colours
- [ ] Heatmaps and graded scales use a single hue — no rainbow
- [ ] Every chart has a "View as table" button that actually works
- [ ] Every chart with ≥ 2 series has a legend
- [ ] x-axis labels don't collide (≥ 64px apart) on both desktop and mobile
- [ ] Dark mode is checked separately — not just inverted
- [ ] Every number uses `tabular-nums`
- [ ] Text and labels use text colours, never series colours
- [ ] Charts without enough data show a message instead of an empty plot
