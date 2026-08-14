# 03 — UI Spec

The visual reference is `mockup/fittrack-mockup.html`. This document explains what the mockup shows,
plus the things a static mockup can't show: states, responses, and edge cases.

> UI copy in this document is written in English as a gloss of the intended string.
> The shipped product's UI language is Thai — see the mockup for the actual copy.

## 1. Design tokens

Declared as CSS custom properties on `:root`, overridden on `html[data-theme="dark"]`.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--page` | `#f9f9f7` | `#0d0d0d` | Page background |
| `--surface` | `#fcfcfb` | `#1a1a19` | Card background |
| `--surface-2` | `#f2f1ed` | `#232322` | Secondary surface (tracks, chips) |
| `--text-1` | `#0b0b0b` | `#ffffff` | Primary text |
| `--text-2` | `#52514e` | `#c3c2b7` | Secondary text |
| `--muted` | `#898781` | `#898781` | Axis and chart labels |
| `--grid` | `#e1e0d9` | `#2c2c2a` | Grid lines |
| `--axis` | `#c3c2b7` | `#383835` | Axis lines, dashed outlines |
| `--border` | `rgba(11,11,11,.10)` | `rgba(255,255,255,.10)` | Card borders |
| `--s1` (series 1) | `#2a78d6` | `#3987e5` | The tracked metric — volume, V-taper, body fat, weight, days trained |
| `--s2` (series 2) | `#eb6834` | `#d95926` | Cardio, and load progression on the overload chart |
| `--s3` (series 3) | `#1baf7a` | `#199e70` | Reserved third series; currently only the avatar and the "back" focus tag |
| `--good` | `#0ca30c` | `#0ca30c` | Success, streak, completed sets |
| `--good-text` | `#006300` | `#0ca30c` | Delta text in the favourable direction |
| heatmap ramp | `#eceae4 → #b7d3f6 → #6da7ec → #2a78d6 → #184f95` | `#232322 → #184f95 → #256abf → #3987e5 → #86b6ef` | Heatmap |

**Series colour assignment**

Colour follows *identity*, not rank. The rule is:

| Meaning | Token |
|---|---|
| Strength / the primary tracked metric | `--s1` |
| Cardio, and the load on the progressive-overload chart | `--s2` |
| A third simultaneous series, if one ever becomes necessary | `--s3` |

Because cardio and weight training are different activities, they never share a colour.
`--s3` is deliberately unused in charts today — see the constraints below before reaching for it.

**Colour constraints**

- The three-series set has been validated: CVD ΔE ≥ 9.2, normal-vision ΔE ≥ 27.6, in both themes
- **Never add a fourth series.** If more than three groups need distinguishing, split into
  small multiples instead
- Heatmaps and any graded scale use **a single blue hue** ramped light→dark. No rainbow scales
- `--s3` (aqua) falls below 3:1 contrast on the light surface → **it always needs a label or a
  table view alongside it**
- Status colours (good/warning/critical) are reserved. They are never used as series colours

**Everything else**

- Font: `system-ui, -apple-system, "Segoe UI", "Noto Sans Thai", sans-serif` — no display face
- Numbers in tables and axes: `font-variant-numeric: tabular-nums`
- Radii: cards 14px, buttons 10px, chips 999px, bar caps 4px, heatmap cells 3px
- Chart lines 2px, marker dots ≥ 8px, 2px gap between adjacent bars

## 2. `/today`

### 2.1 Layout (desktop)

```
┌─────────────────────────────────┬──────────────────┐
│  Today's workout card            │  Streak          │
│   · program tag + A/B swap       │  Last 7 days     │
│   · day name + "Start" button    │  Latest PRs      │
│   · 4 meta figures               │  Reminder        │
│   · progress bar                 │                  │
│   · exercise list (tap to check) │                  │
└─────────────────────────────────┴──────────────────┘
```

Mobile: a single column, workout card first.

### 2.2 The exercise row — the most important component in the app

```
┌─┐  Dumbbell Bench Press                    Last time
│✓│  4 sets × 6–12 reps · 12.5 kg            11/10/9/8
└─┘  ▸ Today  12 / 11 / 10 / 9
```

| Part | Detail |
|---|---|
| Checkbox | 22×22px, 7px radius — tap toggles the whole exercise, long-press expands per-set |
| Exercise name | 14px, weight 600 — prefixed with a `--s1` dot when `is_key_lift` |
| Second line | `sets × rep range · suggested weight` |
| Last time | Right-aligned, secondary colour — actual values from the most recent session of this exercise |
| Today's target | Computed by double progression (§2.4); shown when expanded |
| Completed state | Name struck through, dimmed, checkbox filled `--good` |

**Exercises with `per_side: true`** expand into two sub-rows (left/right) and collapse back into one.

**`duration` exercises** (plank) replace the input with a countdown timer and start/stop buttons.

**`cardio` exercises** (treadmill) replace the form with time / distance / incline.

### 2.3 The A ⇄ B program toggle

A small segmented control in the top-right of the card.

- Tapping swaps the exercise list immediately (optimistic), with a toast: `Switched to program A`
- If logging has already started, confirm first: `2 sets are already logged. Keep them and switch, or cancel?`
- `sessions.plan_id` records which program was actually used that day

### 2.4 Computing "today's target" (double progression)

```
given prev = [11, 10, 9, 8]  (most recent session), repMax = 12, repMin = 6

if every set in prev >= repMax:
    → ready to add weight
      show the banner; new target = roundToIncrement(weight + 2.5), reps = repMin .. repMin+2
else:
    → target = prev.map(r => min(r + 1, repMax))
```

`roundToIncrement` snaps to the nearest 2.5 kg, because that is the dumbbell's adjustment step
(`progressiveOverload.weightIncrementKg` in the seed). Never suggest a weight the equipment
cannot actually be set to.

**Edge cases**

| Case | Behaviour |
|---|---|
| Exercise never performed before | No "last time" row — show `Start with a weight you can do ~10 reps with, leaving 2–3 in reserve` |
| Weight has reached the equipment ceiling (25 kg) | Replace the add-weight banner with `You've hit the dumbbell ceiling — try a single-limb variation or slow the tempo`, plus a button to view substitutes |
| Stalled at the same weight for ≥ 3 weeks | Deload banner: `Drop the weight by 10% and build back up` (matches `deloadTrigger` in the seed) |
| Performance well below last time (> 20%) | Say nothing, just log it — it may simply have been a bad day |

### 2.5 Active-session mode

Once "Start" is tapped:

- The progress bar moves to the top and sticks there
- After each set is checked, **a rest timer appears automatically** (default 90s for key lifts,
  60s for accessories)
- A "Finish workout" button stays pinned to the bottom
- The screen stays awake (Wake Lock API)

### 2.6 Rest days and cardio days

| Day | What it looks like |
|---|---|
| Rest day (Sunday) | No empty card — show the weekly summary plus a `Log light activity` button (walk / stretch) |
| Cardio day (Thursday) | The card becomes a treadmill form: time / distance / incline, with a 25–40 minute target band |

## 3. `/schedule`

- **Week view**, 7 columns. Each cell shows the focus tag, day name, exercise count / duration,
  and an A/B toggle
- Today is outlined in `--s1` with a 2px ring
- **Days can be dragged to reorder** (HTML5 drag & drop on desktop, long-press + drag on mobile)
- **Template bar** across the top: `Program B (dumbbell)` · `Program A (no equipment)` · `＋ Build your own`
- **Goal ring** showing `3/5 this week` plus `cardio 2/3`
- **Month view**, toggled from the top right — a compact calendar for moving days in bulk

Two summary cards below:

1. **Last 6 weeks vs goal** — horizontal bars `4/5`, `5/5`, …, darker when the goal was met
2. **This week's plan** — broken down by focus (chest / back / shoulders / legs / cardio / rest)

## 4. `/body`

Not fully rendered in the mockup; specified here.

- **Quick-log form** at the top: weight (daily) · body fat % (weekly) · measurements (biweekly)
- Five measurement fields: shoulder · chest · waist · arm · neck — each with a diagram of where to measure
- **V-taper card**, the largest element on the page: current value + 1.618 target + progress bar
- **Photo comparison**, a left/right slider over two chosen dates — private by default
- The spot-reduction message (see `01-product-spec.md` §7)

## 5. `/analytics`

See `04-analytics-spec.md` — separate document, because there's a lot of it.

## 6. Navigation

| Breakpoint | Pattern |
|---|---|
| ≥ 860px | Top bar: logo + 3 tabs + theme button + avatar |
| < 860px | Bottom nav, 5 slots: Today · Schedule · **[＋]** · Analytics · Body |

The centre `＋` is a raised `--s1` circle that opens a bottom sheet:
start workout / log weight / log cardio.

## 7. States that must be designed (don't skip these)

| State | Treatment |
|---|---|
| Loading | Grey skeletons shaped like the real content — never a centred spinner |
| Empty (new user) | `/today` shows a 3-step onboarding: choose equipment → choose program → take first measurements |
| Empty (not enough data) | Charts needing ≥ 2 points show `Log once more to see a trend` instead of an empty plot |
| Offline | A thin amber strip below the header: `Saving offline · 3 sets waiting to sync` |
| Error | Inline, under the part that failed — not a toast — with a `Retry` button |

## 8. Accessibility

- Every chart has a **"View as table"** button. Mandatory, not optional
- Colour is never the only carrier of meaning — always paired with a label or icon
- Hit targets ≥ 44×44px on mobile (the 22px checkbox needs padding out to 44px)
- Honour `prefers-reduced-motion` — disable progress-bar and toast transitions
- Honour `forced-colors` — the heatmap switches to 45°/135° hatching instead of colour
- Focus is clearly visible: 2px `--s1` ring, 2px offset
