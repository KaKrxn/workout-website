-- Cron job history.
--
-- Report/09-admin-implementation-plan.md §5.
--
-- Nothing recorded whether the scheduled jobs ran. A failure was therefore
-- invisible: generate-sessions could stop working and the first symptom would be
-- a user's Today page coming up empty four weeks later, with no trace of why.

create table job_runs (
  id          uuid primary key default gen_random_uuid(),
  job         text not null check (job in ('generate-sessions','refresh-stats')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,            -- null while still running
  detail      jsonb not null default '{}',
  error       text
);

create index job_runs_recent_idx on job_runs (job, started_at desc);

alter table job_runs enable row level security;
-- No policy yet. Only the cron handlers write here and they use service_role,
-- which bypasses RLS. The admin read policy arrives with the role in
-- 20260815000200 — until then this table is invisible to every user session,
-- which is the correct default.

grant select on job_runs to authenticated;
grant all    on job_runs to service_role;

comment on table job_runs is
  'One row per cron invocation. ok is null while running, then true or false.';
