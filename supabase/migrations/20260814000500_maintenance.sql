-- Maintenance routine for the nightly cron.
--
-- The triggers in 20260814000100 keep daily_stats correct in normal operation.
-- This is the safety net behind them: a bulk offline sync that ran with triggers
-- disabled, or a trigger that errored, would otherwise leave the analytics page
-- quietly wrong (Report/06-deploy-vercel.md §7, Report/02-data-model.md §6).
--
-- One round trip instead of one per user per day.

create or replace function refresh_recent_daily_stats(p_days int default 7)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count int := 0;
begin
  if p_days < 1 or p_days > 400 then
    raise exception 'p_days out of range: %', p_days;
  end if;

  for v_row in
    select distinct s.user_id, s.date
    from sessions s
    where s.date >= current_date - p_days
      and s.date <= current_date
  loop
    perform refresh_daily_stats(v_row.user_id, v_row.date);
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- This crosses every user's data, so it must never be reachable from a user
-- session. The blanket grant in 20260814000300 would otherwise hand it to
-- `authenticated` along with everything else.
revoke all on function refresh_recent_daily_stats(int) from public, anon, authenticated;
grant execute on function refresh_recent_daily_stats(int) to service_role;

comment on function refresh_recent_daily_stats(int) is
  'Nightly safety net behind the daily_stats triggers. service_role only.';
