# 09 — Admin Console Implementation Plan

The build plan for `08-admin-spec.md`. That document decided *what* and *why*;
this one is the step-by-step *how*, detailed enough to work from directly.

**Status: plan only. Nothing here is built yet.**

---

## 1. Assumptions

One question from `08-admin-spec.md` §6 is still open — whether this stays a
single-user app. Rather than block, the plan is ordered so it does not need
answering until stage 5:

| Assumption | If wrong |
|---|---|
| A handful of accounts at most, not thousands | No pagination is planned. Add it if the user list ever passes ~200 rows |
| Admin is read-only over other users' data | Stated as a hard rule below; anything that needs to change user data goes through Studio |
| The admin is the developer | The console can assume technical literacy — it does not need to explain what `daily_stats` is |

**Stages 1–4 are worth building either way. Stage 5 only pays off with more than
one account.**

---

## 2. Current state

What already exists and will be reused:

| Existing | Reused for |
|---|---|
| 12 tables, RLS on all (`20260814000200_rls.sql`) | Extended, not replaced |
| `refresh_daily_stats(uuid, date)` | Per-user stats rebuild |
| `refresh_recent_daily_stats(int)` — service_role only | Health check drift detection |
| `provisionUser()` in `lib/provision.ts` | "Re-run provisioning" action |
| `generatePlannedSessions()` | "Generate sessions" action |
| `search_exercises(text)` — Thai-capable | Library search |
| `createAdminClient()` in `lib/supabase/admin.ts` | Auth user deletion only |
| Both cron handlers | Extended to record runs |

Policy names as they stand, since the migration has to reference them:

```
users            own_row
user_settings    own_rows        user_equipment   own_rows
plans            own_rows        sessions         own_rows
body_metrics     own_rows        progress_photos  own_rows
daily_stats      own_rows
session_sets     own_via_session
plan_days        own_via_plan    plan_items       own_via_plan_day
exercises        read_exercises / insert_own_exercises
                 / update_own_exercises / delete_own_exercises
```

Nothing exists for roles, job history, or auditing.

---

## 3. Two corrections to the spec

Working through the detail surfaced two things `08-admin-spec.md` got wrong.

### 3.1 Add separate policies — do not widen the existing ones

The spec said to change `using (auth.uid() = user_id)` into
`using (auth.uid() = user_id or is_admin())`. That is wrong: those are `FOR ALL`
policies, so `USING` governs `DELETE` and `UPDATE` row matching too. Widening it
would silently grant admins the ability to delete any user's rows — the opposite
of the read-only rule.

PostgreSQL ORs multiple permissive policies together, so the correct move is to
**leave the owner policies untouched and add a second, `FOR SELECT` policy**:

```sql
create policy admin_read on sessions
  for select using ((select is_admin()));
```

Read-only by construction. No existing policy is edited, so there is nothing to
get subtly wrong in a rewrite.

### 3.2 Admins must not get blanket read on the private tables

The spec said the health section detects `daily_stats` drift, which needs a
recount from `session_sets`. Granting admins `select` on `session_sets` to
achieve that would hand them every logged set of every user for a number on a
dashboard.

Instead the check lives in a `security definer` function that returns **only
aggregates**, and admins get no policy on `session_sets` at all.

Final read scope for admins:

| Table | Admin read | Why |
|---|---|---|
| `users`, `user_settings`, `plans`, `sessions`, `daily_stats` | ✅ | Needed for the list and health checks |
| `exercises` | ✅ already public | Library |
| `session_sets` | ❌ | Aggregate-only, via function |
| `body_metrics`, `progress_photos`, `user_equipment` | ❌ | Private, no admin use case |

---

## 4. Work breakdown

```
Stage 1  job_runs + cron records runs        ← no dependencies, ship alone
Stage 2  admin_users, is_admin(), /admin shell
Stage 3  System health                        ← depends on 1, 2
Stage 4  Exercise library editor              ← depends on 2
Stage 5  User list + audit log                ← depends on 2; only if multi-user
```

---

## 5. Stage 1 — Job history

**Problem it solves:** nothing records whether the cron ran. A failure is
invisible until a user's Today page is empty four weeks later.

### 5.1 Migration `20260815000100_job_runs.sql`

```sql
create table job_runs (
  id          uuid primary key default gen_random_uuid(),
  job         text not null check (job in ('generate-sessions','refresh-stats')),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  detail      jsonb not null default '{}',
  error       text
);

create index job_runs_recent_idx on job_runs (job, started_at desc);

alter table job_runs enable row level security;
-- No policy yet: only service_role writes, and service_role bypasses RLS.
-- Stage 2 adds the admin read policy.

grant select on job_runs to authenticated;
grant all    on job_runs to service_role;
```

### 5.2 `lib/job-run.ts`

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Wraps a cron job so its outcome is recorded whether it succeeds or throws.
 * Without this a failing cron leaves no trace anywhere.
 */
export async function recordJobRun<T>(
  job: "generate-sessions" | "refresh-stats",
  fn: () => Promise<T>,
): Promise<{ ok: true; detail: T } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("job_runs").insert({ job }).select("id").single();

  try {
    const detail = await fn();
    await admin.from("job_runs")
      .update({ finished_at: new Date().toISOString(), ok: true, detail })
      .eq("id", row!.id);
    return { ok: true, detail };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await admin.from("job_runs")
      .update({ finished_at: new Date().toISOString(), ok: false, error })
      .eq("id", row!.id);
    return { ok: false, error };
  }
}
```

### 5.3 Rewire both handlers

`app/api/cron/refresh-stats/route.ts` becomes:

```ts
const denied = authorizeCron(request);
if (denied) return denied;

const result = await recordJobRun("refresh-stats", async () => {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("refresh_recent_daily_stats", { p_days: 7 });
  if (error) throw new Error(error.message);
  return { refreshed: data };
});

return Response.json(result, { status: result.ok ? 200 : 500 });
```

`generate-sessions` follows the same shape, returning `{ users, created, failed }`
from the callback. Its existing per-user `try/catch` stays — one broken account
must not fail the run — but `failed` now lands in `detail` where it is visible.

### 5.4 Verification

- `npm run test:cron` (new): call each endpoint with the secret, assert a
  `job_runs` row appears with `ok = true` and a non-null `finished_at`
- Force a failure (bad RPC name) and assert `ok = false` with the message in `error`

---

## 6. Stage 2 — Admin role and route shell

### 6.1 Migration `20260815000200_admin_role.sql`

```sql
create table admin_users (
  user_id    uuid primary key references users(id) on delete cascade,
  granted_at timestamptz not null default now(),
  note       text
);

alter table admin_users enable row level security;
-- Deliberately no policy: nobody reads this through PostgREST. is_admin() is
-- security definer and reads it directly. Granting admin means inserting a row
-- in Studio, which is the intended friction.

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from admin_users a where a.user_id = auth.uid()) $$;

revoke all on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

-- Read-only admin policies. Separate from the owner policies, never merged into
-- them — see 09 §3.1. `(select is_admin())` rather than `is_admin()` so the
-- planner evaluates it once as an InitPlan instead of once per row.
create policy admin_read on users          for select using ((select is_admin()));
create policy admin_read on user_settings  for select using ((select is_admin()));
create policy admin_read on plans          for select using ((select is_admin()));
create policy admin_read on sessions       for select using ((select is_admin()));
create policy admin_read on daily_stats    for select using ((select is_admin()));
create policy admin_read on job_runs       for select using ((select is_admin()));

-- Stock exercises (owner_id is null) are editable by admins only.
create policy admin_write_stock on exercises for insert
  with check ((select is_admin()) and owner_id is null);
create policy admin_update_stock on exercises for update
  using ((select is_admin()) and owner_id is null)
  with check ((select is_admin()) and owner_id is null);

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
create policy admin_read   on admin_audit_log for select using ((select is_admin()));
create policy admin_append on admin_audit_log for insert
  with check ((select is_admin()) and actor_id = auth.uid());
-- No update or delete policy at all: the log cannot be rewritten from the app.

grant select, insert on admin_audit_log to authenticated;
```

### 6.2 `lib/admin.ts`

```ts
import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the admin's user id, or renders 404.
 *
 * 404 and not 403: a 403 confirms the route exists, which tells an attacker
 * where to keep pushing.
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) notFound();

  return user.id;
}

export async function auditLog(
  actorId: string, action: string, target?: string, detail: object = {},
) {
  const supabase = await createClient();
  await supabase.from("admin_audit_log")
    .insert({ actor_id: actorId, action, target, detail });
}
```

### 6.3 Route shell

```
app/(app)/admin/layout.tsx    calls requireAdmin(), renders section tabs
app/(app)/admin/page.tsx      System health (stage 3)
app/(app)/admin/library/      Exercise library (stage 4)
app/(app)/admin/users/        User list (stage 5)
app/(app)/admin/actions.ts    Server actions, each re-calling requireAdmin()
```

**Every server action re-checks `requireAdmin()`.** A layout guard protects
rendering, not POSTs — a server action is a public endpoint that anyone can call
directly with the right id.

The admin link appears in the header only when `is_admin()` is true.

### 6.4 Verification — `npm run test:admin`

The security test matters more than the feature. With three accounts (plain user,
admin, anonymous):

- [ ] plain user: `/admin` returns 404
- [ ] plain user: calling an admin server action directly fails
- [ ] plain user still cannot read another plain user's sessions (no regression)
- [ ] admin: can read all users, user_settings, plans, sessions, daily_stats
- [ ] admin: **cannot** read anyone else's `session_sets`, `body_metrics`, `progress_photos`
- [ ] admin: **cannot** update or delete another user's session (read-only holds)
- [ ] admin: can update a stock exercise; **cannot** update a user-owned one
- [ ] `admin_audit_log` rejects an insert whose `actor_id` is someone else
- [ ] `admin_audit_log` rejects update and delete from everyone

Extend `scripts/test-rls.mjs` or add `scripts/test-admin.mjs` in the same style —
negative reads must return empty **without** an error, so a missing GRANT cannot
masquerade as a passing policy.

---

## 7. Stage 3 — System health

`app/(app)/admin/page.tsx`, server component, `dynamic = "force-dynamic"`.

### 7.1 The drift check (aggregate-only)

Per §3.2 this cannot read `session_sets` from the client:

```sql
create or replace function admin_stats_drift(p_days int default 7)
returns table (user_id uuid, date date, stored numeric, actual numeric)
language sql
stable
security definer
set search_path = public
as $$
  select d.user_id, d.date, d.total_volume_kg,
         coalesce((select sum(ss.weight_kg * ss.reps)
                     from session_sets ss
                     join sessions s on s.id = ss.session_id
                    where s.user_id = d.user_id and s.date = d.date
                      and not ss.is_warmup), 0)
  from daily_stats d
  where d.date >= current_date - p_days
    and d.total_volume_kg is distinct from coalesce((select sum(ss.weight_kg * ss.reps)
        from session_sets ss join sessions s on s.id = ss.session_id
       where s.user_id = d.user_id and s.date = d.date and not ss.is_warmup), 0)
$$;

revoke all on function admin_stats_drift(int) from public, anon, authenticated;
grant execute on function admin_stats_drift(int) to authenticated;
```

> The function is `security definer`, so it **must** re-check `is_admin()` itself
> — the grant to `authenticated` alone would expose it to every logged-in user.
> Add `if not (select is_admin()) then raise exception 'forbidden'; end if;` by
> writing it in plpgsql rather than sql.

### 7.2 Cards

| Card | Query | Alert |
|---|---|---|
| generate-sessions | latest `job_runs` where job matches | none in 8 days, or `ok = false` |
| refresh-stats | same | none in 36 hours, or `ok = false` |
| No upcoming sessions | users with no `sessions` where `date > current_date and status = 'planned'` | count > 0 |
| Never provisioned | `user_settings.active_plan_id is null` | count > 0 |
| Stats drift | `admin_stats_drift(7)` | any row |

Each alerting card carries the fixing action: *Run now*, *Generate sessions*,
*Rebuild stats*. Every one is idempotent, so a double click is harmless.

Follow `03-ui-spec.md`: skeletons rather than spinners, inline errors rather than
toasts, single-hue status treatment, `tabular-nums` on every figure.

---

## 8. Stage 4 — Exercise library editor

- Table of all 41 stock exercises, filter box wired to `search_exercises()`
- Inline edit: name, muscle, kind, rep range, duration range, equipment,
  `per_side`, `is_key_lift`, note
- Add new stock exercise
- Retire via `is_public = false` — **never** delete: `plan_items` and
  `session_sets` both have foreign keys into `exercises`, so deleting a row
  someone has logged against either fails or destroys their history

Validation with Zod, mirroring the database constraints exactly (`kind` and
`muscle` enumerations, `rep_min <= rep_max`). Every write calls `auditLog()`.

A standing banner: edits diverge from `Report/data/program-seed.json`, so a fresh
environment will come up different. Optional follow-up — an *Export to JSON*
button producing a file to commit.

---

## 9. Stage 5 — User list and audit log

Only worth building with more than one account.

Columns: email · display name · signed up · last session · sessions (90d) ·
active plan · provisioned.

Assembled from `users` + `user_settings` + `plans` + an aggregate over
`sessions` — all already readable under the stage 2 policies.

| Action | Implementation | Guard |
|---|---|---|
| Re-run provisioning | `provisionUser(id)` | idempotent |
| Generate sessions | `generatePlannedSessions(id, planId, 4)` | idempotent |
| Rebuild stats | `refresh_daily_stats` per date | idempotent |
| Delete account | `createAdminClient().auth.admin.deleteUser(id)` | type the email to confirm |

Deletion is the only place the service-role client appears, because `auth.users`
is outside RLS. It cascades through `users` and every child table — a path the
`refresh_daily_stats` guard added in `02-data-model.md` §6 already had to be
fixed to survive.

Audit log view: read-only, newest first, filterable by actor and action.

---

## 10. Verification and rollout

Per stage: `npx tsc --noEmit`, `npx eslint .`, `npx next build`, plus the stage's
own test script. `npm run test:rls` must keep passing throughout — the admin
policies must not weaken user isolation.

Rollout:

1. Merge stage 1 on its own and confirm `job_runs` fills up on the real cron
   schedule before building anything on top of it
2. Apply stage 2's migration to production, then insert your own `admin_users`
   row by hand in Studio
3. Confirm `/admin` returns 404 for a normal account **on production** before
   putting anything sensitive on the page

Rollback: every stage is additive — new tables, new policies, new routes. Backing
out is `drop policy` / `drop table` with no change to existing data. Stage 1's
handler rewrite is the only edit to shipped code, and it is behaviour-preserving.

---

## 11. Sequencing summary

| Stage | Depends on | Delivers | Worth shipping alone |
|---|---|---|---|
| 1 Job history | — | Cron failures become visible | Yes — biggest win per unit of work |
| 2 Admin role | — | Enforced role, `/admin` shell, audit table | Only as a foundation |
| 3 System health | 1, 2 | The reason to open the page | Yes |
| 4 Library editor | 2 | Library edits without a deploy | Yes |
| 5 Users + audit | 2 | Per-account operations | Only if multi-user |

Stopping after stage 3 leaves a console that already earns its place.
