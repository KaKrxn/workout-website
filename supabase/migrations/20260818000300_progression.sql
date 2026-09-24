-- Progression engine support.
--
-- Spec: Report/13-progression-spec.md
--
-- Performance decides whether today gets harder; time only advises, except for
-- the stall rule. Nothing changes without the user accepting it — which is why
-- every step is recorded rather than inferred.

begin;

-- ─────────────── Per-exercise increment ───────────────

-- A flat 2.5 kg is wrong at low loads: on a 7.5 kg lateral raise it is +33%,
-- which fails on the first set and reads to the user as going backwards.
alter table exercises
  add column weight_step_kg numeric(4,2) not null default 2.5
  check (weight_step_kg > 0);

comment on column exercises.weight_step_kg is
  'Smallest useful load increase for this exercise. The engine also refuses any single jump over 10% of the current weight.';

-- What to move to when the equipment ceiling is reached and reps are exhausted.
alter table exercises
  add column harder_variant_of text references exercises(id);

comment on column exercises.harder_variant_of is
  'This exercise is a harder version of the referenced one. Drives the equipment-ceiling suggestion.';

-- The three library exercises that exist only as progressions and are referenced
-- by no plan. Guarded so a partially-seeded database does not fail the migration.
update exercises set harder_variant_of = 'pushup'       where id = 'decline_pushup'   and exists (select 1 from exercises where id = 'pushup');
update exercises set harder_variant_of = 'db_rdl'       where id = 'sl_rdl'           and exists (select 1 from exercises where id = 'db_rdl');
update exercises set harder_variant_of = 'goblet_squat' where id = 'bulgarian_split'  and exists (select 1 from exercises where id = 'goblet_squat');

-- ─────────────── Progression history ───────────────

-- Makes "days since the last increase" one indexed lookup instead of a window
-- function over every set ever logged, and gives the overload chart an exact
-- source rather than an inferred one.
--
-- `dismissed` is recorded too: a suggestion the user turned down is information,
-- and it is what suppresses the banner for the next 7 days.
create table progression_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  exercise_id text not null references exercises(id),
  kind        text not null check (kind in
                ('weight_up', 'weight_down', 'range_up', 'variation', 'dismissed')),
  from_value  numeric(6,2),
  to_value    numeric(6,2),
  session_id  uuid references sessions(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index progression_events_lookup
  on progression_events (user_id, exercise_id, created_at desc);

alter table progression_events enable row level security;

create policy progression_events_own_rows on progression_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
