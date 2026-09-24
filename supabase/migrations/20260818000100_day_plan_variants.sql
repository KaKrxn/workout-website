-- Day plan variants
--
-- A weekday can now hold more than one plan, and the user picks which one on the
-- day itself. "Plan A" and "Plan B" are two plans a Monday offers — they are not
-- two programs the app has to reconcile.
--
-- This replaces the earlier per-day A/B swap design (01-product-spec.md §5.1),
-- which paired days *across two separate plans* by muscle focus. That mechanism
-- is deleted: no pairing table, no focus matching, no cross-weekday mapping.
--
-- See Report/10-day-plan-variants.md for the full spec.

begin;

-- ─────────────── plan_days becomes "one variant of one weekday" ───────────────

alter table plan_days
  add column variant_label text    not null default 'Plan A',
  add column variant_order int     not null default 1,
  add column is_default    boolean not null default true;

comment on column plan_days.variant_label is
  'User-facing name of this variant, unique within (plan_id, day_of_week). e.g. "ดัมเบล", "ไม่ใช้อุปกรณ์"';
comment on column plan_days.is_default is
  'The variant the scheduler uses when generating planned sessions. Exactly one per weekday.';

alter table plan_days
  add constraint plan_days_variant_label_not_blank
  check (length(btrim(variant_label)) > 0);

-- Give the rows that already exist a label taken from the plan they belong to,
-- so the first render of the schedule page is readable rather than "Plan A" everywhere.
update plan_days d
set variant_label = case p.seed_id
                      when 'plan_a_bodyweight' then 'ไม่ใช้อุปกรณ์'
                      when 'plan_b_dumbbell'   then 'ดัมเบล'
                      else coalesce(nullif(btrim(p.name), ''), 'Plan A')
                    end
from plans p
where p.id = d.plan_id;

-- A weekday now holds many rows — one per variant — so the old constraint goes.
alter table plan_days drop constraint plan_days_unique_day;

-- NULLS NOT DISTINCT keeps add-on days (day_of_week is null) from being
-- inserted twice under the same label.
alter table plan_days
  add constraint plan_days_unique_variant
  unique nulls not distinct (plan_id, day_of_week, variant_label);

-- Exactly one variant per weekday is the one the scheduler picks. Add-on days are
-- excluded: they are not scheduled by weekday, so "default" means nothing for them.
create unique index plan_days_one_default_per_day
  on plan_days (plan_id, day_of_week)
  where is_default and day_of_week is not null;

-- ─────────────── One plan-linked session per day ───────────────

-- Switching variants must be an UPDATE of the existing session, never a second
-- row: the day's logged sets hang off session_id, and two sessions on one date
-- would split them.
--
-- This index fails loudly if a user somehow already has two plan-linked sessions
-- on the same date. That is the correct outcome — find and merge them first
-- rather than letting the ambiguity through.
create unique index sessions_one_plan_linked_per_day
  on sessions (user_id, date)
  where plan_day_id is not null;

-- ─────────────── Switching ───────────────

-- security invoker, so the caller's RLS policies decide what they can see and
-- write. This function only checks the *shape* of the move: the target has to be
-- a sibling variant of the same plan and weekday.
create or replace function public.switch_session_plan(
  p_session_id  uuid,
  p_plan_day_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ok boolean;
begin
  select exists (
    select 1
    from sessions  s
    join plan_days cur on cur.id = s.plan_day_id
    join plan_days tgt on tgt.plan_id     = cur.plan_id
                      and tgt.day_of_week is not distinct from cur.day_of_week
    where s.id  = p_session_id
      and tgt.id = p_plan_day_id
  ) into v_ok;

  if not v_ok then
    raise exception
      'plan_day % is not a variant of the same weekday as session %', p_plan_day_id, p_session_id
      using errcode = 'check_violation';
  end if;

  update sessions s
     set plan_day_id = p_plan_day_id,
         focus       = coalesce((select d.focus from plan_days d where d.id = p_plan_day_id), '{}')
   where s.id = p_session_id;
end;
$$;

comment on function public.switch_session_plan(uuid, uuid) is
  'Repoints a session at another variant of the same weekday. Logged sets are kept — they belong to the session, not the plan.';

grant execute on function public.switch_session_plan(uuid, uuid) to authenticated;

commit;
