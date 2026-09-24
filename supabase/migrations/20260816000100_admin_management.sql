-- Managing users and admins from the console.
--
-- Report/08-admin-spec.md §2.2 originally ruled out granting admin through the
-- UI. That was too strict: the real hazard is not the existence of a button, it
-- is locking every administrator out of the system. So the button exists and the
-- lockout is prevented in the database, where it cannot be bypassed by a client
-- that skips the UI.

-- ─────────────── admin_users becomes readable and writable by admins ───────────────
-- It previously had RLS on and no policies at all, so nothing reached it through
-- PostgREST. is_admin() is security definer and runs as the owner, so it still
-- bypasses these policies — no recursion, which is why the roster lives in its
-- own table rather than as a column on `users`.

create policy admin_read   on admin_users for select using ((select is_admin()));
create policy admin_grant  on admin_users for insert with check ((select is_admin()));
create policy admin_revoke on admin_users for delete using ((select is_admin()));

grant select, insert, delete on admin_users to authenticated;

-- ─────────────── Lockout guard ───────────────
--
-- Deleting the final row of admin_users would leave nobody able to grant it
-- back, and the only recovery would be direct database access.
--
-- The guard has to allow one case: deleting a user account cascades into this
-- table, and that must keep working. A cascade is distinguishable because the
-- parent row is already gone by the time the trigger runs — the same test the
-- refresh_daily_stats guard uses (Report/02-data-model.md §6).

create or replace function tg_admin_users_guard() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Parent already deleted: this is a cascade, not a revoke. Let it through.
  if not exists (select 1 from users u where u.id = old.user_id) then
    return old;
  end if;

  if (select count(*) from admin_users) <= 1 then
    raise exception 'cannot remove the last administrator'
      using errcode = '23514',
            hint = 'Grant admin to another account first.';
  end if;

  return old;
end $$;

create trigger trg_admin_users_last_guard
before delete on admin_users
for each row execute function tg_admin_users_guard();

-- ─────────────── The user list ───────────────
--
-- Email lives in auth.users, which is not reachable through PostgREST. Rather
-- than copy it into public.users — where it would need a sync trigger and could
-- go stale — one security definer function assembles the list.
--
-- security definer is what makes the grant to `authenticated` dangerous, so the
-- function checks is_admin() itself before returning anything.

create or replace function admin_list_users()
returns table (
  id                uuid,
  email             text,
  display_name      text,
  created_at        timestamptz,
  last_sign_in_at   timestamptz,
  is_admin          boolean,
  active_plan_name  text,
  last_session      date,
  sessions_90d      bigint,
  upcoming_sessions bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (select is_admin()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    au.email::text,
    u.display_name,
    u.created_at,
    au.last_sign_in_at,
    exists (select 1 from admin_users a where a.user_id = u.id),
    p.name,
    (select max(s.date) from sessions s
      where s.user_id = u.id and s.status in ('completed','partial')),
    (select count(*) from sessions s
      where s.user_id = u.id and s.status in ('completed','partial')
        and s.date >= current_date - 90),
    (select count(*) from sessions s
      where s.user_id = u.id and s.status = 'planned' and s.date > current_date)
  from users u
  left join auth.users     au on au.id = u.id
  left join user_settings us on us.user_id = u.id
  left join plans          p  on p.id = us.active_plan_id
  order by u.created_at;
end $$;

revoke all on function admin_list_users() from public, anon;
grant execute on function admin_list_users() to authenticated;

comment on function admin_list_users() is
  'Account list for the admin console. Joins auth.users for email; admin-only.';
