-- FitTrack initial schema
-- Source of truth: Report/02-data-model.md §2, §4, §6
-- Requires PostgreSQL 15+ (UNIQUE NULLS NOT DISTINCT).

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
  weekly_goal_days   int  not null default 5,
  weekly_cardio_goal int  not null default 3,
  active_plan_id     uuid,                        -- FK added below, once `plans` exists
  rir_target_min     int  not null default 1,
  rir_target_max     int  not null default 3,
  theme              text not null default 'system'
                     check (theme in ('light','dark','system')),
  timezone           text not null default 'Asia/Bangkok',
  reminder_time      time,
  vtaper_target      numeric(4,3) not null default 1.618
);

create table user_equipment (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  equipment_id  text not null,
  label         text not null,
  max_weight_kg numeric(5,2),
  attributes    jsonb not null default '{}',
  unique (user_id, equipment_id)
);

-- ─────────────── Exercise library ───────────────
-- owner_id null = stock exercise seeded by the system (41 rows from program-seed.json)

create table exercises (
  id              text primary key,
  owner_id        uuid references users(id) on delete cascade,
  name            text not null,
  kind            text not null check (kind in ('strength','bodyweight','cardio','duration')),
  muscle          text not null
                  check (muscle in ('back_lat','shoulders','chest','legs','arms',
                                    'core','glutes','cardio','neck')),
  secondary       text[] not null default '{}',
  equipment       text[] not null default '{}',
  rep_min         int,
  rep_max         int,
  duration_min_s  int,
  duration_max_s  int,
  per_side        boolean not null default false,
  is_key_lift     boolean not null default false,
  note            text,
  is_public       boolean not null default true
);

-- ─────────────── Plans ───────────────

create table plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  seed_id     text,
  name        text not null,
  split_type  text,
  is_active   boolean not null default false,
  use_when    text,
  created_at  timestamptz not null default now()
);

-- Deferred: user_settings is created first, and plans references users, so this closes the cycle
alter table user_settings
  add constraint user_settings_active_plan_fk
  foreign key (active_plan_id) references plans(id) on delete set null;

create table plan_days (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references plans(id) on delete cascade,
  day_of_week     int check (day_of_week between 0 and 6),  -- 0=Sunday, null=add-on
  label           text not null,
  focus           text[] not null default '{}',
  is_rest         boolean not null default false,
  is_cardio_day   boolean not null default false,
  is_priority_day boolean not null default false,
  rest_note       text,
  note            text,
  -- NULLS NOT DISTINCT so an add-on day (day_of_week null) can't be inserted twice
  constraint plan_days_unique_day unique nulls not distinct (plan_id, day_of_week)
);

create table plan_items (
  id                    uuid primary key default gen_random_uuid(),
  plan_day_id           uuid not null references plan_days(id) on delete cascade,
  exercise_id           text not null references exercises(id),
  order_index           int  not null,
  target_sets           int  not null,
  target_rep_min        int,
  target_rep_max        int,
  target_duration_min_s int,
  target_duration_max_s int,
  per_side              boolean not null default false,
  is_key                boolean not null default false,
  note                  text,
  unique (plan_day_id, order_index)
);

-- ─────────────── What actually happened ───────────────

create table sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  plan_day_id uuid references plan_days(id) on delete set null,
  plan_id     uuid references plans(id) on delete set null,
  date        date not null,
  started_at  timestamptz,
  ended_at    timestamptz,
  status      text not null default 'planned'
              check (status in ('planned','completed','skipped','partial')),
  focus       text[] not null default '{}',
  note        text,
  session_rpe int check (session_rpe between 1 and 10),
  -- Without NULLS NOT DISTINCT an unplanned session could be inserted unlimited times per day
  constraint sessions_unique_day unique nulls not distinct (user_id, date, plan_day_id)
);

create table session_sets (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  exercise_id  text not null references exercises(id),
  client_id    uuid not null unique,     -- client-generated; makes offline sync idempotent
  set_index    int  not null,
  side         text check (side in ('left','right')),
  reps         int,
  weight_kg    numeric(6,2),
  duration_s   int,
  distance_m   numeric(8,1),
  incline_pct  numeric(4,1),
  rir          int check (rir between 0 and 5),
  is_warmup    boolean not null default false,
  completed_at timestamptz not null default now()
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

-- ─────────────── Rollup table ───────────────

create table daily_stats (
  user_id          uuid not null references users(id) on delete cascade,
  date             date not null,
  session_count    int not null default 0,
  total_volume_kg  numeric(12,2) not null default 0,
  total_duration_s int not null default 0,
  cardio_minutes   int not null default 0,
  sets_by_muscle   jsonb not null default '{}',
  was_planned      boolean not null default false,
  updated_at       timestamptz not null default now(),
  primary key (user_id, date)
);

-- ─────────────── Indexes (02-data-model.md §4) ───────────────

create index sessions_user_date_idx      on sessions     (user_id, date desc);
create index session_sets_session_idx    on session_sets (session_id);
create index session_sets_lookup_idx     on session_sets (exercise_id, completed_at desc);
create index body_metrics_series_idx     on body_metrics (user_id, metric_id, date desc);
create index daily_stats_user_date_idx   on daily_stats  (user_id, date desc);
create index plan_items_order_idx        on plan_items   (plan_day_id, order_index);
create index plans_user_active_idx       on plans        (user_id, is_active);
create index exercises_muscle_idx        on exercises    (muscle);

-- ─────────────── daily_stats refresh (02-data-model.md §6) ───────────────
-- Separate subqueries rather than one grouped join: a single join fans out and produces
-- wrong counts once a day has both multiple sessions and multiple sets per exercise.

create or replace function refresh_daily_stats(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Deleting a user cascades users → sessions → session_sets, and each cascade step
  -- fires these triggers. Without this guard the function re-inserts a daily_stats
  -- row for a user that is being removed, which fails the foreign key and aborts the
  -- whole delete with "Database error deleting user".
  if not exists (select 1 from users u where u.id = p_user) then
    return;
  end if;

  -- Nothing left for that day: drop the rollup row rather than leaving a row of zeroes,
  -- which the heatmap would otherwise render as a logged-but-empty day.
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

-- ─────────────── Signup hook ───────────────
-- Creates the public.users row and its settings. The rest of provisioning
-- (equipment, plans, plan_days, plan_items, planned sessions) happens in the
-- application's provisionUser(), which reads Report/data/program-seed.json.

create or replace function tg_handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into users (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''),
             nullif(new.raw_user_meta_data->>'name', ''),
             split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  insert into user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end $$;

create trigger trg_on_auth_user_created
after insert on auth.users
for each row execute function tg_handle_new_auth_user();
