-- Admin role, enforced by the database.
--
-- Report/08-admin-spec.md §2, Report/09-admin-implementation-plan.md §6.
--
-- The admin console exists to cross the boundary every other part of the app
-- respects, so the boundary stays in the database rather than moving into
-- application code. An admin is not a user with a bypass; an admin is a user
-- whose policies match more rows.

create table admin_users (
  user_id    uuid primary key references users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  note       text
);

alter table admin_users enable row level security;
-- Deliberately no policy and no grant: nothing reads this through PostgREST.
-- is_admin() is security definer and reads it directly. Granting admin is one
-- INSERT run by hand in Studio — an escalation path that can be clicked is one
-- that can be clicked by accident.

comment on table admin_users is
  'Admin roster. Grant by inserting a row manually; there is no UI for this on purpose.';

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from admin_users a where a.user_id = auth.uid()) $$;

revoke all on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

-- ─────────────── Admin read access ───────────────
--
-- Separate FOR SELECT policies, never merged into the owner policies.
--
-- The owner policies are FOR ALL, so their USING clause also governs which rows
-- DELETE and UPDATE can match. Widening those to `... or is_admin()` would have
-- silently granted admins the right to delete any user's rows. PostgreSQL ORs
-- permissive policies together, so adding a SELECT-only policy gives read access
-- and nothing else — read-only by construction rather than by intention.
--
-- `(select is_admin())` rather than `is_admin()`: the subquery form is evaluated
-- once per query as an InitPlan instead of once per row.

create policy admin_read on users         for select using ((select is_admin()));
create policy admin_read on user_settings for select using ((select is_admin()));
create policy admin_read on plans         for select using ((select is_admin()));
create policy admin_read on sessions      for select using ((select is_admin()));
create policy admin_read on daily_stats   for select using ((select is_admin()));
create policy admin_read on job_runs      for select using ((select is_admin()));

-- No admin policy on session_sets, body_metrics, progress_photos or
-- user_equipment. Those are the most private rows in the database and the
-- console has no use for them; the one aggregate it does need comes from
-- admin_stats_drift() below.

-- ─────────────── Exercise library ───────────────
-- Stock exercises (owner_id is null) are the shared library, editable by admins
-- so a typo does not require a redeploy. User-owned rows stay untouchable.

create policy admin_insert_stock on exercises for insert
  with check ((select is_admin()) and owner_id is null);

create policy admin_update_stock on exercises for update
  using ((select is_admin()) and owner_id is null)
  with check ((select is_admin()) and owner_id is null);

-- No admin delete policy: plan_items and session_sets both have foreign keys
-- into exercises, so removing a row someone has logged against would either
-- fail or destroy their history. Retire with is_public = false instead.

-- ─────────────── Audit log ───────────────

create table admin_audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid not null references users(id),
  action     text not null,
  target     text,
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index admin_audit_recent_idx on admin_audit_log (created_at desc);

alter table admin_audit_log enable row level security;

create policy admin_read on admin_audit_log for select
  using ((select is_admin()));

create policy admin_append on admin_audit_log for insert
  with check ((select is_admin()) and actor_id = auth.uid());

-- No update or delete policy exists, for anyone. The log cannot be rewritten
-- from inside the application, only from Studio with service_role.

grant select, insert on admin_audit_log to authenticated;

-- ─────────────── Health check: daily_stats drift ───────────────
--
-- Recomputing volume requires reading session_sets, which admins deliberately
-- cannot do. This returns aggregates only.
--
-- security definer means the grant to `authenticated` is what makes it callable,
-- so it has to check is_admin() itself — otherwise every logged-in user could
-- call it and learn about other people's data.

create or replace function admin_stats_drift(p_days int default 7)
returns table (user_id uuid, date date, stored numeric, actual numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (select is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_days < 1 or p_days > 400 then
    raise exception 'p_days out of range: %', p_days;
  end if;

  return query
  with recount as (
    select se.user_id, se.date,
           coalesce(sum(ss.weight_kg * ss.reps) filter (where not ss.is_warmup), 0) as actual
    from sessions se
    left join session_sets ss on ss.session_id = se.id
    where se.date >= current_date - p_days and se.date <= current_date
    group by se.user_id, se.date
  )
  select d.user_id, d.date, d.total_volume_kg, r.actual
  from daily_stats d
  join recount r on r.user_id = d.user_id and r.date = d.date
  where d.total_volume_kg is distinct from r.actual;
end $$;

revoke all on function admin_stats_drift(int) from public, anon;
grant execute on function admin_stats_drift(int) to authenticated;

comment on function admin_stats_drift(int) is
  'Rollup rows disagreeing with a live recount. Aggregates only — admins cannot read session_sets.';
