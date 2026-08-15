# Report — Design Documentation

This folder holds the **complete design documentation** for the FitTrack web app.
It was written from `source/reportwebsite.md` (the user's actual training program) so that
implementation can start without any further design decisions.

## Files

| File | Read it when |
|---|---|
| `01-product-spec.md` | You want to know what this app does, who it's for, and what has already been decided |
| `02-data-model.md` | You're creating the database, writing migrations, or writing queries — **PostgreSQL / Supabase** |
| `03-ui-spec.md` | You're building components — per-page specs plus design tokens |
| `04-analytics-spec.md` | You're building the analytics page — formulas and specs for every chart |
| `05-implementation-plan.md` | You're starting work — phases, tasks, and definitions of done |
| `06-deploy-vercel.md` | You're going live — env vars, cron, redirect URLs, pre-launch checklist |
| `07-data-model-tidb.md` | **Alternative to 02** if you want TiDB instead of Postgres — pick one, not both |
| `08-admin-spec.md` | You're building the admin console — added after the original design; **not implemented yet** |
| `data/program-seed.json` | You're seeding the database — programs A/B as ready-to-use JSON |
| `mockup/fittrack-mockup.html` | You want to see the real thing — open it in a browser, it's interactive |
| `source/reportwebsite.md` | You want the original source document this design was derived from |

## Suggested reading order

```
mockup/fittrack-mockup.html   ← open this first, 2 minutes, to see the shape of it
        ↓
01-product-spec.md            ← understand why it's designed this way
        ↓
02-data-model.md  +  data/program-seed.json
   (or 07-data-model-tidb.md if you choose TiDB)
        ↓
03-ui-spec.md  +  04-analytics-spec.md
        ↓
05-implementation-plan.md     ← start writing code
        ↓
06-deploy-vercel.md           ← ship it
```

## The shortest possible summary

A home-workout tracker for a user with **a 25 kg adjustable dumbbell, a flat bench, and a treadmill**.
The goal is **fat loss + a V-taper physique**, which is why it has three things ordinary fitness apps don't:

1. **Swap between program A (no equipment) and B (dumbbell) on a per-day basis** — a day where the
   equipment isn't available no longer means a missed day
2. **Progressive overload as a decision aid, not just a logging field** — the app tells you how many
   reps to target today and whether you're ready to add weight
3. **A V-taper ratio chart (shoulder ÷ waist)** — the single number that best summarises the physique
   goal, and a better signal than bodyweight

## Language note

The documentation in this folder is written in **English**.
The product's UI copy is **Thai** — `mockup/fittrack-mockup.html` and the labels inside
`data/program-seed.json` are therefore in Thai and are intentionally left that way.
Where these specs quote UI copy, the English text is a gloss of the intended Thai string,
not the string to ship.

`source/reportwebsite.md` is the original input document and is kept in its original Thai.

---

*This is design documentation only — no application code exists yet.
See `05-implementation-plan.md` for the next steps.*
