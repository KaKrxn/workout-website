# 08 — Admin Console Spec

An addition to the original design, which deliberately had no admin surface
(`01-product-spec.md` §6). This document says what an admin page is *for* before
any of it is built, because the wrong version of this feature is the single most
dangerous thing that could be added to this codebase: it exists specifically to
cross the boundary that every other part of the app is built to respect.

**Status: design only. Nothing here is implemented yet.**

---

## 1. What it is for

Supabase Studio already exists and is a perfectly good data browser. An admin page
that just re-renders tables would be worse than Studio at Studio's job.

So this earns its place only by doing the things Studio does badly:

| Need | Why Studio isn't enough |
|---|---|
| **Is the cron actually running?** | Nothing records job runs today. A silently failing cron means nobody gets planned sessions and the first symptom is an empty Today page four weeks later |
| **Editing the exercise library** | Right now a typo in an exercise name needs a `seed.sql` edit, a commit, and a deploy. It should be an edit box |
| **Data integrity at a glance** | "Which users have no upcoming sessions?" is a three-way join nobody wants to retype into SQL Editor |
| **One-click maintenance** | Re-running provisioning or a stats rebuild currently means finding the right RPC and calling it by hand |

**Explicit non-goal: this does not replace Supabase Studio.** Raw row editing,
schema changes, and ad-hoc SQL stay there.

---

## 2. Who counts as an admin

This is the decision that matters. Everything else is layout.

### 2.1 Rejected: gate it in application code

The obvious approach — check a flag in the route handler, then use the
service-role client — moves the security boundary out of the database and into
one `if` statement. Miss it on one route and every user's data is public.
`07-data-model-tidb.md` §5 spells out why that model is a liability; the Postgres
build should not adopt it voluntarily.

### 2.2 Chosen: a database-enforced admin role

A separate table, not a column on `users`:

```sql
create table admin_users (
  user_id    uuid primary key references users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  note       text
);
```

Kept separate from `users` on purpose. A policy on `users` that has to read
`users` to decide who may read `users` is a recursion trap; a distinct table
sidesteps it.

```sql
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from admin_users a where a.user_id = auth.uid()) $$;
```

Existing policies gain a second clause rather than being replaced:

```sql
-- before: using (auth.uid() = user_id)
-- after:  using (auth.uid() = user_id or is_admin())
```

The database stays the boundary. An admin page bug then leaks nothing, because
the page reads through the **user's own client** — an admin simply has policies
that match more rows.

> **Superseded.** This section first said granting admin must never be in the UI,
> on the grounds that a clickable escalation path can be clicked by accident.
> That was too strict — ordinary systems manage admins from an admin page, and
> the real hazard is not the button but **locking every administrator out**.
>
> Granting and revoking now live in the console (§3.2b), with the lockout
> prevented by a database trigger that refuses to delete the last remaining
> administrator. The trigger allows the delete when it arrives as a cascade from
> an account deletion, which it distinguishes by the parent row already being
> gone — the same test the `refresh_daily_stats` guard uses.
>
> The first administrator is still bootstrapped by hand in Studio, because there
> has to be one before anyone can grant another.

### 2.3 Where the service-role client is still needed

Exactly one case: deleting an auth user, which lives in `auth.users` and is not
reachable through RLS. It stays behind the same `is_admin()` check plus a
confirmation step.

---

## 3. Page structure

Route: `/admin`, hidden from navigation for everyone who is not an admin, and
returning 404 (not 403) otherwise — a 403 confirms the page exists.

### 3.1 System health — the landing section

The reason to open the page at all.

| Card | Shows | Alert condition |
|---|---|---|
| **Cron: generate-sessions** | Last run, duration, rows created, ok/failed | No successful run in 8 days |
| **Cron: refresh-stats** | Last run, duration, dates refreshed | No successful run in 36 hours |
| **Users without upcoming sessions** | Count + list | Any user with zero `status='planned'` sessions dated in the future |
| **Users never provisioned** | Count + list | `user_settings.active_plan_id is null` |
| **daily_stats drift** | Rows where the stored total disagrees with a live recount, last 7 days | Any mismatch |

Cron history needs a table that does not exist yet:

```sql
create table job_runs (
  id          uuid primary key default gen_random_uuid(),
  job         text not null,              -- 'generate-sessions' | 'refresh-stats'
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  detail      jsonb not null default '{}',  -- { users, created, failed: [...] }
  error       text
);
```

Both cron handlers write a row. This is worth doing **whether or not the admin
page is built** — right now a failing cron produces no trace anywhere.

### 3.2 Users

A table, one row per account:

`email` · `display name` · `signed up` · `last session` · `sessions (90d)` ·
`active plan` · `provisioned?`

Row actions:

| Action | Effect | Guard |
|---|---|---|
| View detail | Read-only: settings, equipment, plans, recent sessions, body metrics count | — |
| Re-run provisioning | Calls `provisionUser()`; idempotent, so safe on an already-set-up account | — |
| Generate sessions | Four more weeks from the active plan | — |
| Rebuild stats | `refresh_recent_daily_stats` scoped to that user | — |
| Delete account | Removes the auth user; everything else cascades | Type the email to confirm |

**Not offered: editing another user's workout data.** There is no support case for
it, and photos and body metrics are the most private rows in the database.
Progress photos are never rendered in the admin console at all.

### 3.2b Admins

A separate section from §3.2, because the two answer different questions —
"who signed up" and "who can see everything".

- Current administrators, with a revoke button on each
- The last remaining administrator shows why it cannot be revoked instead of a
  button that would fail
- Every other account listed with a grant button, behind a confirmation naming
  what the role can do
- No email invitations: an account has to exist before it can be promoted

Email addresses live in `auth.users`, which PostgREST does not expose. Rather
than copy them into `public.users` — where they would need a sync trigger and
could go stale — `admin_list_users()` assembles the list in one security definer
function that checks `is_admin()` itself.

### 3.3 Exercise library

The one genuine CRUD surface, and the one most likely to get daily use.

- Filter and search the 41 stock exercises (reuses `search_exercises()`, so Thai
  substring search already works — `04`/`20260814000400_thai_text.sql`)
- Edit: name, muscle, kind, rep range, duration range, equipment, `is_key_lift`, note
- Add a new stock exercise
- Soft-remove via `is_public = false`, never a hard delete — `plan_items` and
  `session_sets` both have foreign keys into this table, and deleting a row that
  someone has logged sets against would fail or orphan their history

> **Keep `program-seed.json` in step.** Edits made here diverge from the seed file,
> so a fresh environment would come up different. The page shows a persistent
> reminder, and a later change could export the current library back to JSON.

### 3.4 Audit log

Every state-changing admin action, appended:

```sql
create table admin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid not null references users(id),
  action       text not null,          -- 'user.delete', 'exercise.update', …
  target       text,                   -- user id or exercise id
  detail       jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
```

Insert-only for admins; no update or delete policy at all, so it cannot be
rewritten from inside the app.

---

## 4. What this adds to the database

| Object | Purpose |
|---|---|
| `admin_users` | Who is an admin |
| `is_admin()` | Used by every extended policy |
| `job_runs` | Cron history — useful on its own |
| `admin_audit_log` | Accountability for admin actions |
| Policy updates | `or is_admin()` on the user-scoped tables |

Roughly one migration. No changes to existing columns.

---

## 5. Out of scope

| Not doing | Why |
|---|---|
| Granting/revoking admin from the UI | Escalation should require deliberate database access |
| Impersonating a user | Large blast radius, no need here |
| Arbitrary SQL | Studio does this properly already |
| Viewing progress photos | Most private data in the system; no admin use case |
| Editing another user's logged sets | Same |
| Bulk email / notifications | Not a product this app is |

---

## 6. Decisions still open

1. **How many users will there actually be?** If this stays a single-user app,
   §3.2 shrinks to a single self-service panel and most of its value disappears —
   §3.1 and §3.3 carry the page on their own. Worth settling before building,
   because it halves the work.
2. **Should library edits write back to `program-seed.json`?** Sidesteps the drift
   in §3.3, but means the admin page produces a file that belongs in git.
3. **Should `job_runs` be built first, separately?** It fixes a real blind spot
   today and does not depend on any of the rest.

---

## 7. Suggested order

1. `job_runs` + cron handlers writing to it — standalone value, no auth work
2. `admin_users`, `is_admin()`, policy updates, `/admin` returning 404 for non-admins
3. §3.1 system health
4. §3.3 exercise library
5. §3.2 users + §3.4 audit log

Stopping after step 3 still leaves something worth having.
