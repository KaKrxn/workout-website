-- Row Level Security
-- Source of truth: Report/02-data-model.md §7
-- `alter table … enable row level security` takes one table per statement in PostgreSQL.

alter table users           enable row level security;
alter table user_settings   enable row level security;
alter table user_equipment  enable row level security;
alter table plans           enable row level security;
alter table plan_days       enable row level security;
alter table plan_items      enable row level security;
alter table sessions        enable row level security;
alter table session_sets    enable row level security;
alter table body_metrics    enable row level security;
alter table progress_photos enable row level security;
alter table daily_stats     enable row level security;
alter table exercises       enable row level security;

-- ─────────────── The user's own row ───────────────

create policy own_row on users
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ─────────────── Tables with a direct user_id ───────────────
-- Every write-capable policy needs both `using` and `with check`; a using-only
-- policy on `for all` would let a row be updated into another user's ownership.

create policy own_rows on user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_rows on user_equipment
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_rows on plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_rows on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_rows on body_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_rows on progress_photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_rows on daily_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────── Child tables, reached through their parent ───────────────

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

-- ─────────────── Exercise library ───────────────
-- Everyone reads stock exercises; only owners write their own.

create policy read_exercises on exercises for select
  using (is_public or owner_id = auth.uid());

create policy insert_own_exercises on exercises for insert
  with check (owner_id = auth.uid());

create policy update_own_exercises on exercises for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy delete_own_exercises on exercises for delete
  using (owner_id = auth.uid());
