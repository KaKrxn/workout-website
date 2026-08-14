# 02 — Data Model

Database: **PostgreSQL** (via Supabase), with Row Level Security enabled on every table.

> **Requires PostgreSQL 15 or newer.** The unique constraints below use `NULLS NOT DISTINCT`,
> which was introduced in PG 15. Supabase provisions PG 15+ for new projects.

## 1. Relationships

```
users ──┬── user_settings
        ├── user_equipment          (25 kg dumbbell / flat bench / treadmill)
        ├── plans ── plan_days ── plan_items ──┐
        │                                       ├── exercises
        ├── sessions ── session_sets ──────────┘
        ├── body_metrics             (weight / body fat % / measurements)
        ├── progress_photos
        └── daily_stats              (rollup table — precomputed)
```

## 2. Schema

Statement order matters: `plans` is created before the foreign key on
`user_settings.active_plan_id` is added, because the two tables reference each other.

```sql
-- ─────────────── Users ───────────────
create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

create table user_settings (
  user_id            uuid primary key references users(id) on delete cascade,
  unit               text not null default 'kg'  check (unit in ('kg','lb')),
  length_unit        text not null default 'cm'  check (length_unit in ('cm','in')),
  week_start         text not null default 'mon' check (week_start in ('mon','sun')),
  weekly_goal_days   int  not null default 5,     -- 5 strength days per week
  weekly_cardio_goal int  not null default 3,     -- 3 cardio sessions per week
  active_plan_id     uuid,                        -- FK added after `plans` exists
  rir_target_min     int  not null default 1,
  rir_target_max     int  not null default 3,
  theme              text not null default 'system'
                     check (theme in ('light','dark','system')),
  timezone           text not null default 'Asia/Bangkok',
  reminder_time      time,                        -- null = no reminder
  vtaper_target      numeric(4,3) not null default 1.618
);

-- Equipment the user owns — drives library filtering and the weight-ceiling warning
create table user_equipment (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  equipment_id  text not null,          -- 'dumbbell_adj_25' | 'bench_flat' | 'treadmill'
  label         text not null,
  max_weight_kg numeric(5,2),           -- 25.00 for the dumbbell
  attributes    jsonb not null default '{}',   -- {"incline": false}
  unique (user_id, equipment_id)
);

-- ─────────────── Exercise library ───────────────
-- owner_id null = a stock exercise seeded by the system (41 rows from program-seed.json)
create table exercises (
  id              text primary key,      -- 'db_bench_press'
  owner_id        uuid references users(id) on delete cascade,
  name            text not null,
  kind            text not null check (kind in ('strength','bodyweight','cardio','duration')),
  muscle          text not null
                  check (muscle in ('back_lat','shoulders','chest','legs','arms',
                                    'core','glutes','cardio','neck')),
  secondary       text[] not null default '{}',
  equipment       text[] not null default '{}',   -- equipment_id values required
  rep_min         int,
  rep_max         int,
  duration_min_s  int,
  duration_max_s  int,
  per_side        boolean not null default false,
  is_key_lift     boolean not null default false,
  note            text,
  is_public       boolean not null default true
);

-- ─────────────── Plans (repeating templates) ───────────────
create table plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  seed_id     text,                       -- 'plan_a_bodyweight' | 'plan_b_dumbbell'
  name        text not null,
  split_type  text,
  is_active   boolean not null default false,
  use_when    text,
  created_at  timestamptz not null default now()
);

-- Deferred FK: user_settings is created first, plans references users, so this closes the cycle
alter table user_settings
  add constraint user_settings_active_plan_fk
  foreign key (active_plan_id) references plans(id) on delete set null;

create table plan_days (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references plans(id) on delete cascade,
  day_of_week    int check (day_of_week between 0 and 6),  -- 0=Sunday, null=add-on (unscheduled)
  label          text not null,
  focus          text[] not null default '{}',
  is_rest        boolean not null default false,
  is_cardio_day  boolean not null default false,
  is_priority_day boolean not null default false,
  rest_note      text,
  note           text,
  -- NULLS NOT DISTINCT so an add-on day (day_of_week is null) can't be inserted twice
  constraint plan_days_unique_day unique nulls not distinct (plan_id, day_of_week)
);

create table plan_items (
  id           uuid primary key default gen_random_uuid(),
  plan_day_id  uuid not null references plan_days(id) on delete cascade,
  exercise_id  text not null references exercises(id),
  order_index  int  not null,
  target_sets  int  not null,
  target_rep_min int,
  target_rep_max int,
  target_duration_min_s int,
  target_duration_max_s int,
  per_side     boolean not null default false,
  is_key       boolean not null default false,
  note         text,
  unique (plan_day_id, order_index)
);

-- ─────────────── What actually happened ───────────────
create table sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  plan_day_id  uuid references plan_days(id) on delete set null,
  plan_id      uuid references plans(id) on delete set null,  -- which program was actually used (A or B)
  date         date not null,
  started_at   timestamptz,
  ended_at     timestamptz,
  status       text not null default 'planned'
               check (status in ('planned','completed','skipped','partial')),
  focus        text[] not null default '{}',   -- copied from plan_day so streak queries stay fast
  note         text,
  session_rpe  int check (session_rpe between 1 and 10),
  -- NULLS NOT DISTINCT: without it, an unplanned session (plan_day_id is null) could be
  -- inserted an unlimited number of times for the same day, because NULL <> NULL in an index
  constraint sessions_unique_day unique nulls not distinct (user_id, date, plan_day_id)
);

create table session_sets (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  exercise_id   text not null references exercises(id),
  client_id     uuid not null unique,     -- generated on the client; makes offline sync idempotent
  set_index     int  not null,
  side          text check (side in ('left','right')),   -- null = both sides at once
  reps          int,
  weight_kg     numeric(6,2),
  duration_s    int,
  distance_m    numeric(8,1),
  incline_pct   numeric(4,1),             -- treadmill incline walking
  rir           int  check (rir between 0 and 5),
  is_warmup     boolean not null default false,
  completed_at  timestamptz not null default now()
);

-- ─────────────── Body composition ───────────────
create table body_metrics (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references users(id) on delete cascade,
  date      date not null,
  metric_id text not null
            check (metric_id in ('weight','body_fat_pct','measure_shoulder','measure_chest',
                                 'measure_waist','measure_arm','measure_neck')),
  value     numeric(7,2) not null,
  note      text,
  unique (user_id, date, metric_id)
);

create table progress_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  date         date not null,
  pose         text check (pose in ('front','side','back')),
  storage_path text not null,
  is_private   boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ─────────────── Rollup table (precomputed) ───────────────
create table daily_stats (
  user_id         uuid not null references users(id) on delete cascade,
  date            date not null,
  session_count   int  not null default 0,
  total_volume_kg numeric(12,2) not null default 0,
  total_duration_s int not null default 0,
  cardio_minutes  int  not null default 0,
  sets_by_muscle  jsonb not null default '{}',   -- {"chest": 7, "back_lat": 8, ...}
  was_planned     boolean not null default false,
  updated_at      timestamptz not null default now(),
  primary key (user_id, date)
);
```

## 3. Muscle group values

These **nine** constants are the only permitted values. The first six are listed in the user's
priority order; `glutes`, `cardio`, and `neck` sit outside that ranking
(see `04-analytics-spec.md` G6 for how each is treated in the balance chart):

```
'back_lat'  →  Back / lats      (priority 1 — V-taper)
'shoulders' →  Shoulders        (priority 2)
'chest'     →  Chest            (priority 3)
'legs'      →  Legs             (priority 4)
'arms'      →  Arms             (priority 5)
'core'      →  Core / abs       (priority 6)
'glutes'    →  Glutes           (rolled into legs when charting)
'cardio'    →  Cardio           (excluded from the strength balance chart)
'neck'      →  Neck             (optional add-on program; excluded from the balance chart)
```

## 4. Required indexes

```sql
create index on sessions          (user_id, date desc);
create index on session_sets      (session_id);
create index on session_sets      (exercise_id, completed_at desc);   -- fast "last time" lookup
create index on body_metrics      (user_id, metric_id, date desc);
create index on daily_stats       (user_id, date desc);
create index on plan_items        (plan_day_id, order_index);
```

> **Note on the "last time" lookup.** `session_sets` has no `user_id` column, so that query has to
> join through `sessions`. With a single-user-per-row dataset this is cheap, and RLS is simpler
> because ownership lives in exactly one place. The TiDB variant denormalises `user_id` into
> `session_sets` instead — see `07-data-model-tidb.md` §5.2 for the reasoning. If the join ever
> shows up in a slow-query log, copying `user_id` down and indexing
> `(user_id, exercise_id, completed_at desc)` is the fix.

## 5. Shared formulas

Every one of these has exactly one definition, used everywhere.

```sql
-- Volume of one set.
-- Bodyweight exercises have weight_kg = null and therefore contribute 0 to volume.
-- This is deliberate for v1: bodyweight load is not tracked, so counting it would produce
-- a number that moves with bodyweight rather than with training. Count sets for those instead.
volume_kg = coalesce(weight_kg, 0) * coalesce(reps, 0)

-- Daily volume
select coalesce(sum(coalesce(ss.weight_kg,0) * coalesce(ss.reps,0)), 0)
from session_sets ss
join sessions se on se.id = ss.session_id
where se.user_id = $1 and se.date = $2 and not ss.is_warmup;

-- V-taper ratio (from the most recent value of each measurement as of that date)
v_taper_ratio = measure_shoulder / measure_waist

-- Adherence % (future-dated planned sessions are excluded)
adherence = count(*) filter (where status = 'completed')::numeric
          / nullif(count(*) filter (where date <= current_date), 0)

-- Weekly streak — consecutive weeks where session_count reached the goal.
--   Weekly rather than daily, because the program has rest days built into it.
```

## 6. Keeping `daily_stats` fresh

`daily_stats` is rebuilt for a single `(user_id, date)` at a time by one function, which both
triggers call. Writing it as separate subqueries rather than one grouped join avoids the
fan-out that makes a single join produce wrong counts once a day has both multiple sessions
and multiple sets per exercise.

```sql
create or replace function refresh_daily_stats(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Deleting a user cascades users → sessions → session_sets, and every cascade step
  -- fires these triggers. Without this guard the function re-inserts a daily_stats row
  -- for the user being removed, the foreign key rejects it, and the whole delete aborts
  -- with "Database error deleting user".
  if not exists (select 1 from users u where u.id = p_user) then
    return;
  end if;

  -- Nothing left on that date: drop the rollup row rather than leave a row of zeroes,
  -- which the heatmap would otherwise draw as a logged-but-empty day.
  if not exists (select 1 from sessions s where s.user_id = p_user and s.date = p_date) then
    delete from daily_stats where user_id = p_user and date = p_date;
    return;
  end if;

  insert into daily_stats (user_id, date, session_count, total_volume_kg,
                           total_duration_s, cardio_minutes, sets_by_muscle,
                           was_planned, updated_at)
  values (
    p_user,
    p_date,
    -- sessions that actually happened, not ones merely scheduled
    (select count(*) from sessions s
      where s.user_id = p_user and s.date = p_date
        and s.status in ('completed','partial')),
    (select coalesce(sum(ss.weight_kg * ss.reps), 0)
       from session_sets ss join sessions s on s.id = ss.session_id
      where s.user_id = p_user and s.date = p_date and not ss.is_warmup),
    (select coalesce(sum(ss.duration_s), 0)
       from session_sets ss join sessions s on s.id = ss.session_id
      where s.user_id = p_user and s.date = p_date),
    (select coalesce(sum(ss.duration_s), 0) / 60
       from session_sets ss
       join sessions  s on s.id = ss.session_id
       join exercises e on e.id = ss.exercise_id
      where s.user_id = p_user and s.date = p_date and e.kind = 'cardio'),
    (select coalesce(jsonb_object_agg(m.muscle, m.cnt), '{}'::jsonb)
       from (select e.muscle, count(*) as cnt
               from session_sets ss
               join sessions  s on s.id = ss.session_id
               join exercises e on e.id = ss.exercise_id
              where s.user_id = p_user and s.date = p_date and not ss.is_warmup
              group by e.muscle) m),
    (select coalesce(bool_or(s.plan_day_id is not null), false)
       from sessions s where s.user_id = p_user and s.date = p_date),
    now()
  )
  on conflict (user_id, date) do update set
    session_count    = excluded.session_count,
    total_volume_kg  = excluded.total_volume_kg,
    total_duration_s = excluded.total_duration_s,
    cardio_minutes   = excluded.cardio_minutes,
    sets_by_muscle   = excluded.sets_by_muscle,
    was_planned      = excluded.was_planned,
    updated_at       = excluded.updated_at;
end $$;
```

Two triggers call it — one for sets, one for the session row itself, because `status` and
`plan_day_id` both feed the rollup:

```sql
create or replace function tg_session_sets_refresh() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_date date;
begin
  select s.user_id, s.date into v_user, v_date
  from sessions s where s.id = coalesce(new.session_id, old.session_id);
  if v_user is not null then
    perform refresh_daily_stats(v_user, v_date);
  end if;
  return coalesce(new, old);
end $$;

create trigger trg_sets_refresh_daily_stats
after insert or update or delete on session_sets
for each row execute function tg_session_sets_refresh();

create or replace function tg_sessions_refresh() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform refresh_daily_stats(coalesce(new.user_id, old.user_id),
                              coalesce(new.date,    old.date));
  -- a session that moved date leaves a stale row behind on the old date
  if tg_op = 'UPDATE' and old.date is distinct from new.date then
    perform refresh_daily_stats(old.user_id, old.date);
  end if;
  return coalesce(new, old);
end $$;

create trigger trg_sessions_refresh_daily_stats
after insert or update or delete on sessions
for each row execute function tg_sessions_refresh();
```

> **Bulk offline sync.** These are row-level triggers, so syncing 60 queued sets fires the
> recompute 60 times. Insert the queue inside one transaction and the cost is bounded but still
> wasteful. If it shows up as slow, insert with the trigger disabled for that transaction
> (`alter table session_sets disable trigger trg_sets_refresh_daily_stats`) and call
> `refresh_daily_stats()` once per affected date at the end.

**Why `daily_stats` exists at all:** a one-year heatmap is a 365-row read. Joining out to
`session_sets` on every page load makes the analytics page get slower for as long as the user
keeps using the app — precisely the wrong direction.

## 7. Row Level Security

`alter table … enable row level security` accepts **one table per statement** in PostgreSQL.

```sql
alter table users            enable row level security;
alter table user_settings    enable row level security;
alter table user_equipment   enable row level security;
alter table plans            enable row level security;
alter table plan_days        enable row level security;
alter table plan_items       enable row level security;
alter table sessions         enable row level security;
alter table session_sets     enable row level security;
alter table body_metrics     enable row level security;
alter table progress_photos  enable row level security;
alter table daily_stats      enable row level security;
alter table exercises        enable row level security;

-- The user's own row
create policy own_row on users
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Tables with a direct user_id
create policy own_rows on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- (repeat verbatim for user_settings, user_equipment, plans, body_metrics,
--  progress_photos, daily_stats — user_settings keys on user_id, which is its PK)

-- Child tables, reached through their parent
create policy own_via_session on session_sets
  for all using (exists (
    select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()
  )) with check (exists (
    select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()
  ));

create policy own_via_plan on plan_days
  for all using (exists (
    select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()
  )) with check (exists (
    select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()
  ));

create policy own_via_plan_day on plan_items
  for all using (exists (
    select 1 from plan_days d join plans p on p.id = d.plan_id
    where d.id = plan_day_id and p.user_id = auth.uid()
  )) with check (exists (
    select 1 from plan_days d join plans p on p.id = d.plan_id
    where d.id = plan_day_id and p.user_id = auth.uid()
  ));

-- Exercise library: everyone reads stock exercises, but only owners write their own
create policy read_exercises on exercises for select
  using (is_public or owner_id = auth.uid());
create policy insert_own_exercises on exercises for insert
  with check (owner_id = auth.uid());
create policy update_own_exercises on exercises for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy delete_own_exercises on exercises for delete
  using (owner_id = auth.uid());
```

> Every policy that permits writes needs **both** `using` and `with check`. A `using`-only policy
> on a `for all` rule lets a row be updated into another user's ownership.

## 8. Seeding

`data/program-seed.json` maps directly to SQL:

1. `exercises[]` → `insert into exercises` (owner_id = null, is_public = true) — 41 rows
2. `plans[]` → `insert into plans`, with `seed_id` = `plans[].id`; set `plan_b_dumbbell` to `is_active = true`
3. `plans[].days[]` → `plan_days`
4. `plans[].days[].items[]` → `plan_items`, with `order_index` = position in the array
5. `profile.equipment[]` → `user_equipment`
6. `profile.weeklyTarget` → `user_settings`

Steps 2–6 depend on a real `user_id`, so they belong in a `provisionUser(userId)` routine that runs
once after signup — not in the database bootstrap. Only step 1 is global.

After provisioning, generate four weeks of `sessions` with `status = 'planned'` from `plan_days`,
so adherence can be computed from week one.

## 9. Offline behaviour

- Always write to **IndexedDB** first (`session_sets` acts as a queue), then sync to Supabase when
  the connection returns
- Every set carries a `client_id` (a UUID generated client-side) so replays are harmless —
  sync with `on conflict (client_id) do nothing`
- A home gym can have poor signal. This is not a nice-to-have.
