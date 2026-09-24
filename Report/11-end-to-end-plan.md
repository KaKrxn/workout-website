# 11 — End-to-End Implementation Plan

Everything needed to take the app from where it is now to a working system a real user can sign up
for and use daily: **sign up · log in · forgot password · Google login · Today · Schedule · Stats ·
Settings · Admin**.

Written against the code as it stands, not against the earlier design docs. Where a design doc and
the code disagree, this file says which one wins.

**Status legend** — ✅ built and working · 🟡 built but wrong or incomplete · ⬜ not built

---

## 1. Where the project actually is

| Surface | Route | Status | One-line summary |
|---|---|---|---|
| Landing | `/` | ✅ | Explains the app, links to signup |
| Sign up | `/signup` | ✅ | Email + password, Zod-validated, provisions on success |
| Log in | `/login` | ✅ | Email + password, safe `next` redirect |
| **Forgot password** | — | ⬜ | **Does not exist anywhere** — no page, no action, no link |
| Google login | `/login`, `/signup` | ✅ | `signInWithOAuth` → `/auth/callback` |
| Auth callback | `/auth/callback` | ✅ | Exchanges code, provisions, honours `next` |
| Today | `/today` | 🟡 | Logging works; timer and overload badge are hardcoded |
| **Schedule** | `/schedule` | ⬜ | **Linked in the nav — currently 404** |
| **Stats** | `/analytics` | ⬜ | **Linked in the nav — currently 404** |
| Body | `/body` | ⬜ | **Linked in the nav — currently 404** |
| History | `/history`, `/history/[id]` | ✅ | Works, but **not reachable from any nav** |
| **Settings** | `/settings` | ⬜ | Not built, not linked |
| Library | `/library` | ⬜ | Not built, not linked |
| Admin | `/admin` + 3 subpages | ✅ | Health, users, admins, audit log |
| Cron | `/api/cron/*` | ✅ | Session generation + stats refresh |

**The single most visible problem:** three of the four navigation tabs lead to 404, and the one
extra page that does work is unreachable. A new user's second click breaks.

---

## 2. Fix these first — they affect every surface

These are small, and leaving them until later makes every later change harder to verify.

### 2.1 Navigation points at pages that do not exist

`components/app-nav.tsx` — `TABS` lists `/today`, `/schedule`, `/analytics`, `/body`.

**Change:** drive the tab list from what exists. Until Schedule and Stats ship:

```ts
const TABS = [
  { href: "/today",   label: "Today" },
  { href: "/history", label: "History" },
] as const;
```

Add `/schedule` and `/analytics` back as each ships. `/body` and `/library` stay out of the nav
until they are built — they are not in this plan's scope.

**Acceptance:** every link in the top tabs and the bottom nav resolves to a rendered page.

### 2.2 The centre `＋` button does nothing

It links to `/today?start=1`, but `TodayPage()` takes no `searchParams`, so the parameter is
ignored.

**Change:** either read the param and auto-start the session, or point the button at `/today`
plainly. Auto-start is better — it is the reason the button exists.

```ts
export default async function TodayPage({ searchParams }: PageProps<"/today">) {
  const { start } = await searchParams;
  // if start === "1" and the session is still `planned`, start it before rendering
}
```

### 2.3 Two hardcoded values look like working features

`app/(app)/today/page.tsx`:

```ts
// ~line 53 — an in-progress session always shows this exact string
: session.startedAt ? "00:23:32" : "00:00:00"
```

```tsx
{/* the "Next target" card — not computed from anything */}
<span …>+rep ready</span>
```

**Change:**

- The timer must count from `session.startedAt`. It has to tick, so it belongs in a small client
  component (`"use client"`, `setInterval`, cleared on unmount), seeded with the server's
  `startedAt` so there is no hydration mismatch.
- `+rep ready` must either be computed by the progression rule (§5.3) or be removed. A badge that
  is always on is worse than no badge — it trains the user to ignore it.

### 2.4 An empty set can be saved

`logSetSchema` in `app/(app)/today/actions.ts` allows every measurement field to be `null`, so
pressing ✓ with nothing filled in writes a row and advances the progress bar.

**Change:** add a refinement keyed on the exercise kind.

```ts
const logSetSchema = z.object({ /* … */ })
  .refine(v => v.reps != null || v.durationS != null || v.distanceM != null, {
    message: "today.emptySet",     // a dictionary key — see 12-i18n-spec.md §3.4
  });
```

Validate against the exercise's `kind` on the server (the client already knows which fields it
rendered).

### 2.5 Language — decided: bilingual, English headings

The Today page drifted into all-English copy while the GDD said Thai-only. **This is now settled:
the app supports Thai and English, and headings stay English in both.** Full spec, dictionary
shape and file-by-file changes: **`12-i18n-spec.md`**.

Practical consequence for everything below: **every page built from here — Forgot password,
Schedule, Stats, Settings — is written bilingual from the first commit.** Retrofitting is what
makes i18n expensive; pages that do not exist yet cost nothing extra.

### 2.6 The palette drifted too — still open

Separate from language. `app/(app)/today/page.tsx` uses literal hex values (`#121a14`, `#5fd482`,
`#304032`) instead of the tokens in `app/globals.css`, which were validated for contrast and
colour-vision deficiency (`03-ui-spec.md` §1).

Two ways out, and one has to be chosen before Stats is built — charts are where an unvalidated
palette does real damage:

| Option | What it costs |
|---|---|
| **A. Return to the documented tokens** | Rework the Today page's colours; every later page follows the existing spec |
| **B. Adopt the dark-green palette** | Update `03-ui-spec.md` §1 and `WEBSITE_GDD.md` §8.1, re-run the palette validator against the new surfaces, restate the heatmap ramp |

Either is fine. Having both in the codebase is not.

## 3. Authentication

### 3.1 Sign up ✅ — small changes only

**Current:** `signUp` in `app/(auth)/actions.ts` validates with Zod (email + 8-char password),
calls `supabase.auth.signUp` with `emailRedirectTo: {siteUrl}/auth/callback`, and — when email
confirmation is off and a session comes back — provisions before redirecting.

**Problems:**

1. When confirmation is **on**, the success path returns through the *error* channel:
   `return { error: "ส่งลิงก์ยืนยันไปที่อีเมลแล้ว …" }`. It renders in red as a failure.
2. Password policy is length-only. Supabase can enforce more server-side.
3. No display name is collected, so `users.display_name` falls back to the email.

**Changes:**

- Widen `AuthState` to `{ errorKey: string | null; noticeKey: string | null }` and render the
  notice in a neutral style. Confirming an email is a success, not a failure. Keys rather than
  sentences, because the action has no locale context — `12-i18n-spec.md` §3.4.
- Add an optional display-name field; pass it as `options.data.full_name` so the trigger/provision
  path can use it.
- Decide whether email confirmation is on. It changes the first-run experience completely:
  **on** = the user cannot use the app until they open the mail; **off** = instant access, and any
  typo'd address is unrecoverable because there is no password reset to a mailbox they own.
  With §3.3 built, **on** is the safer default.

**Acceptance:** sign up with a fresh address → confirmation notice in neutral styling → open the
link → land on `/today` with a full week already scheduled.

### 3.2 Log in ✅ — no changes required

Zod-validated, generic failure message (`อีเมลหรือรหัสผ่านไม่ถูกต้อง` — correctly does not reveal
which half was wrong), and `safeNext()` refuses absolute URLs and `//` prefixes.

**Two additions:** the forgot-password link from §3.3 under the password field, and the message
moved to a dictionary key (§3.1).

### 3.3 Forgot password ⬜ — build this

Nothing exists. This is the largest genuinely-missing piece of the auth surface, and without it a
user who forgets a password has no route back into their account.

#### Flow

```
/login  "ลืมรหัสผ่าน?"
   ↓
/forgot-password           email field
   ↓  resetPasswordForEmail()
   ✉  Supabase sends a recovery link → /auth/callback?next=/reset-password
   ↓  callback exchanges the code — the user now has a session
/reset-password            new password ×2
   ↓  updateUser({ password })
/today
```

#### Files to add

| File | Contents |
|---|---|
| `app/(auth)/forgot-password/page.tsx` | Email form, reuses the `(auth)` layout |
| `app/(auth)/reset-password/page.tsx` | New password + confirm |
| `app/(auth)/actions.ts` | `requestPasswordReset` and `updatePassword` |

```ts
// app/(auth)/actions.ts

const emailOnly = z.object({ email: z.string().email("อีเมลไม่ถูกต้อง") });

export async function requestPasswordReset(
  _prev: AuthState, formData: FormData,
): Promise<AuthState> {
  const parsed = emailOnly.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, notice: null };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await getSiteURL()}/auth/callback?next=/reset-password`,
  });

  // Always the same answer, whether or not the address exists. Anything that
  // differs turns this form into a way to test which emails have accounts.
  return {
    error: null,
    notice: "ถ้าอีเมลนี้มีบัญชีอยู่ ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว",
  };
}

const newPassword = z.object({
  password: z.string().min(8, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"),
  confirm:  z.string(),
}).refine(v => v.password === v.confirm, {
  message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน", path: ["confirm"],
});

export async function updatePassword(
  _prev: AuthState, formData: FormData,
): Promise<AuthState> {
  const parsed = newPassword.safeParse({
    password: formData.get("password"),
    confirm:  formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message, notice: null };

  const supabase = await createClient();
  // The recovery link already produced a session, so this is an ordinary update.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "ลิงก์หมดอายุแล้ว ขอลิงก์ใหม่อีกครั้ง", notice: null };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "ตั้งรหัสผ่านใหม่ไม่สำเร็จ ลองใหม่อีกครั้ง", notice: null };

  revalidatePath("/", "layout");
  redirect("/today");
}
```

#### Changes to existing files

- **`proxy.ts`** — add `/forgot-password` to `PUBLIC_PATHS`.
  **Do not add `/reset-password`.** By the time the user reaches it the callback has already
  created a session, so the existing guard is exactly right: someone opening
  `/reset-password` without a valid recovery link gets bounced to `/login`, which is the desired
  behaviour.
- **`app/(auth)/auth-form.tsx`** — add the link, login mode only:

  ```tsx
  {mode === "login" && (
    <Link href="/forgot-password" className="text-[12px] text-text-2 hover:text-text-1">
      ลืมรหัสผ่าน?
    </Link>
  )}
  ```
- **`app/auth/callback/route.ts`** — no change. It already exchanges the code and honours `next`,
  and `provisionUser` is idempotent, so a recovery round-trip costs one cheap count query.

#### Supabase configuration

- Authentication → URL Configuration → Redirect URLs must already allow `/auth/callback`
  (it does, for OAuth). No new entry needed.
- Authentication → Email Templates → **Reset Password**: the default template points at
  `{{ .ConfirmationURL }}`, which resolves to the redirect above. Translate the copy to match the
  app's language (§2.5).
- Supabase rate-limits recovery emails per address and per hour. Do not add a second limiter;
  do surface the generic notice above so a rate-limited request looks identical to a sent one.

#### Acceptance

- [ ] Requesting a reset for an address that exists sends mail; for one that does not, the page
      says exactly the same thing and no mail is sent
- [ ] The link lands on `/reset-password` with a session
- [ ] Setting a password shorter than 8 characters, or two that differ, is rejected inline
- [ ] After success the old password no longer works and the new one does
- [ ] Opening `/reset-password` directly, with no session, redirects to `/login`
- [ ] An expired or reused link shows "ลิงก์หมดอายุแล้ว" rather than a bare 500

### 3.4 Google login ✅ — configuration only

The code is complete: `signInWithOAuth({ provider: "google" })` with the `next` parameter
preserved through the callback, and a failure redirect to `/login?error=google`.

**What is not done is the setup around it:**

- [ ] Google Cloud Console → OAuth client → Authorized redirect URI:
      `https://<project-ref>.supabase.co/auth/v1/callback`
- [ ] Supabase → Authentication → Providers → Google: client ID and secret
- [ ] Supabase → Redirect URLs: production domain **and** the preview wildcard
      `https://*-<team-slug>.vercel.app/**` — without it, every preview deployment bounces the
      user back to localhost after consent
- [ ] `/login?error=google` currently sets a query parameter nothing reads. Render it.

**One behaviour to decide:** a user who signed up with a password and later uses Google with the
same address. Supabase links them by email when the address is verified. Confirm this is what you
want before launch, because the alternative — two accounts, two sets of training data — is not
something the app can merge afterwards.

---

## 4. Today 🟡

Covered in §2.2–2.4 for the fixes. What remains is the feature work.

### 4.1 Day plan variants

Spec: **`10-day-plan-variants.md`**. Migration `20260818000100_day_plan_variants.sql` is written
and ready to run.

- [ ] Run the migration on staging first — `sessions_one_plan_linked_per_day` will fail loudly if
      any user already has two plan-linked sessions on one date
- [ ] `lib/queries/today.ts` — return the weekday's sibling variants alongside the session
- [ ] Render the picker only when there are ≥ 2, disabled once `status = 'completed'`
- [ ] Call `switch_session_plan(session_id, plan_day_id)`
- [ ] Add the **"นอกแผน" / Off-plan** section for sets whose exercise is not in the newly selected
      variant — without it, switching makes logged work vanish from the screen while remaining in
      the database
- [ ] Provisioning and the cron must select `is_default`

### 4.2 Progression engine

Full spec: **`13-progression-spec.md`**. Migration `20260818000300_progression.sql` is written.

The shape: **performance decides whether today is harder; time only advises**, except for the
3-week stall rule. Reps go up by one per set per session; weight goes up only when every set has
reached the top of the range. Alongside that, each row shows how many sessions and days it has been
since the last increase, and a projection of how many sessions remain — the day-counting the
original design lacked.

- [ ] Run `20260818000300_progression.sql` (adds `weight_step_kg`, `harder_variant_of`,
      `progression_events`)
- [ ] `lib/progression.ts` — **pure function, no I/O**
- [ ] **Every row of the test table in `13-progression-spec.md` §4 passes before any UI is written**
- [ ] Query the previous session's sets per exercise. The index
      `session_sets (exercise_id, completed_at desc)` exists but cannot filter by user — join
      `sessions` and let RLS scope it
- [ ] Render `Last time` / `Today` on each strength and bodyweight row
- [ ] Banners: ceiling → deload → add-weight → raise-range, **one at a time**, each writing a
      `progression_events` row on accept or dismiss
- [ ] The 10% guard: a step that would raise the load by more than a tenth offers a rep-range raise
      instead
- [ ] Per-side exercises progress each side independently
- [ ] Cardio shows no progression UI

This replaces the hardcoded `+rep ready` badge from §2.3.

## 5. Schedule ⬜

The template editor. This is the feature the GDD calls the core value proposition, and it does not
exist yet.

### 5.1 Scope

- Week view, 7 columns, current day highlighted
- Each day lists its **plan variants**, with the default marked
- Per variant: edit exercises · rename · duplicate · set as default · delete
- `＋ Add plan` on each day, empty or copied from an existing variant
- Exercise editor: add from the library, reorder, set target sets / rep range / duration, remove
- Switch the active plan wholesale
- Weekly goal rings (strength days, cardio sessions)

### 5.2 Rules that must hold

| Rule | Why |
|---|---|
| Editing a variant affects **future `planned` sessions only** | Sessions already `partial` or `completed` are history |
| Deleting a variant referenced by a session is blocked | Offer "delete and move those sessions to the default" |
| The last variant of a weekday cannot be deleted | Mark the day a rest day instead |
| Exactly one default per weekday | Enforced by `plan_days_one_default_per_day` |
| Variant labels are unique within a weekday | Enforced by `plan_days_unique_variant` |
| Regenerating planned sessions never touches a past date | The cron already only writes forward — keep it that way |

### 5.3 Needed from elsewhere

- The exercise picker needs a library list. Either build `/library` first, or ship a modal picker
  inside Schedule and treat `/library` as a later browse-only view. **The modal is enough** — a
  standalone library page is not required for the schedule editor to work.
- `user_equipment` filters which exercises are offered.

### 5.4 Acceptance

- [ ] Add a second plan to Monday, name it, add three exercises, set it as default
- [ ] Next Monday's Today page shows that plan
- [ ] The old plan is still selectable from the Today picker
- [ ] Editing a plan does not alter a session already completed
- [ ] Deleting a plan in use is refused with a usable alternative

---

## 6. Stats ⬜

Spec: `04-analytics-spec.md`. Build it against `daily_stats`, not raw `session_sets`.

### 6.1 The one modelling problem to solve first

`daily_stats` is written from `session_sets`, so **a planned day the user skipped has no row at
all**. The heatmap needs three distinct states:

| State | Source |
|---|---|
| Trained | `daily_stats` row with volume/duration |
| Planned but missed | a `sessions` row for that date that never went `partial` |
| Planned rest day | `plan_days.is_rest` for that weekday |

So the heatmap query is a date series **left joined** to both `daily_stats` and `sessions` — not a
`daily_stats` scan. Decide this before writing the component; it changes the query shape, not the
rendering.

Also note `daily_stats.total_duration_s` sums `session_sets.duration_s` only, so a pure strength
day reports ~0 minutes. If the tooltip is to show session length, read
`sessions.started_at`/`ended_at` instead.

### 6.2 Build order

1. Stat tiles — streak, adherence, total sessions, total volume
2. Heatmap (the highest-value chart; ship it before the rest)
3. Weekly volume line + 4-week average
4. Days vs goal bars
5. Muscle-group balance, ordered by the user's priority list, not by value
6. Progressive-overload step chart (needs §4.2 data)
7. Cardio minutes vs target band

### 6.3 Non-negotiables from the spec

- One y-axis per chart — never two
- Maximum three series colours; beyond that, facet
- Sequential ramps are one hue, light→dark; never a rainbow
- Every chart has a working **"view as table"** toggle
- Charts with fewer than two data points render a message, not an empty frame
- Settle the definition of **streak** in one place and use it everywhere. Three documents currently
  disagree; the correct one is *consecutive weeks in which the number of days with a completed
  session ≥ `user_settings.weekly_goal_days`*

---

## 7. Settings ⬜

Every column this page needs already exists. Nothing new in the database.

| Group | Fields | Table |
|---|---|---|
| Profile | display name, avatar | `users` |
| Units | `unit` (kg/lb), `length_unit` (cm/in) | `user_settings` |
| Week | `week_start`, `weekly_goal_days`, `weekly_cardio_goal` | `user_settings` |
| Training | `rir_target_min` / `max`, `vtaper_target` | `user_settings` |
| Plan | `active_plan_id` | `user_settings` |
| Appearance | `theme` | `user_settings` |
| Time | `timezone`, `reminder_time` | `user_settings` |
| Equipment | label, `max_weight_kg`, attributes | `user_equipment` |
| Account | change password, sign out, delete account | Supabase Auth |

**Notes:**

- `unit = 'lb'` and `length_unit = 'in'` have no conversion anywhere in the code. Either implement
  display conversion (store kg/cm always, convert at the edges) or **remove the options** — an
  inert setting is worse than a missing one. Note the +2.5 kg progression increment becomes 5.51 lb,
  so the increment needs its own imperial value (5 lb).
- `reminder_time` has no delivery mechanism. Hide the field until notifications exist.
- Changing `max_weight_kg` must feed the overload ceiling check in §4.2 — that is the setting's
  whole purpose.
- Deleting an account: `on delete cascade` covers every child table. Confirm with a typed
  confirmation, and delete the Supabase Auth user too, not just the `users` row.
- Add `/settings` to the header (it does not belong in the 5-slot bottom bar).

---

## 8. Admin ✅

Built and, from the code, built carefully — DB-enforced role via `is_admin()`, 404 rather than 403,
an audit log with no update or delete policy, and a re-check inside each server action rather than
relying on the layout.

**Remaining work, all from `08-admin-spec.md`:**

- [ ] Exercise library editing — the reason a typo currently needs a `seed.sql` edit and a deploy
- [ ] Data-integrity view: users with no upcoming planned sessions (the symptom of a silently dead
      cron)
- [ ] One-click maintenance: re-run provisioning for a user, rebuild `daily_stats` for a date range
- [ ] Confirm `npm run test:admin` covers: a non-admin calling each server action directly, and an
      admin action that fails to write its audit entry

---

## 9. Database changes required

| Migration | Status | Purpose |
|---|---|---|
| `20260818000100_day_plan_variants.sql` | **written, not run** | Multiple plans per weekday + `switch_session_plan()` |
| `20260818000200_user_locale.sql` | **written, not run** | `user_settings.locale` for the bilingual UI (§2.5, `12-i18n-spec.md`) |
| `20260818000300_progression.sql` | **written, not run** | `weight_step_kg`, `harder_variant_of`, `progression_events` (`13-progression-spec.md`) |
| — | to write | Nothing else. Settings, Stats and forgot-password need no further schema change |

Take a dump before running the variants migration — it is not reversible without data loss.

---

## 10. Environment and external configuration

| Item | Status | Action |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `_PUBLISHABLE_KEY` | ✅ | — |
| `SUPABASE_SECRET_KEY` | ✅ | Confirm it is **not** prefixed `NEXT_PUBLIC_` in Vercel |
| `CRON_SECRET` | ✅ | Confirm it is set in Production, and that cron runs only there |
| `NEXT_PUBLIC_SITE_URL` | ✅ in `.env.example` | Set per environment in Vercel |
| Supabase Redirect URLs | ⬜ | Production domain + `https://*-<team-slug>.vercel.app/**` |
| Google OAuth client | ⬜ | Redirect URI + client ID/secret in Supabase |
| Reset-password email template | ⬜ | Enable and translate |
| Email confirmation on/off | ⬜ | Decide (§3.1) |
| Staging Supabase project | ⬜ | Preview deployments must not point at production |

---

## 11. Build order

Each step is shippable on its own and leaves the app in a working state.

| # | Work | Depends on | Rough size |
|---|---|---|---|
| 1 | §2.1 nav, §2.2 ＋ button, §2.4 empty-set validation | — | hours |
| 2 | **i18n scaffolding** — `locale` migration, `lib/i18n/`, provider, convert Today (`12-i18n-spec.md` §5) | — | 1 day |
| 2b | §2.6 settle the palette | — | hours |
| 3 | §2.3 real timer, remove the fake badge | 2 | hours |
| 4 | §3.3 forgot password, bilingual (+ §3.1 notice channel, keys not sentences) | 2 | half a day |
| 5 | §3.4 Google + Supabase configuration, both email templates | — | hours |
| 6 | §7 Settings, including the Language control (`12-i18n-spec.md` §4) | 2 | 1 day |
| 7 | Run the variants migration, §4.1 picker + off-plan section | migration | 1 day |
| 8 | §5 Schedule editor | 7 | 2–3 days |
| 9 | §4.2 progression engine — **tests first**, then UI (`13-progression-spec.md`) | 7 | 2 days |
| 10 | §6 Stats — tiles and heatmap | 9 | 1–2 days |
| 11 | §6 remaining charts | 10 | 1–2 days |
| 12 | §8 Admin extras | — | 1 day |

Steps 1–5 are the ones that decide whether a stranger can get into the app and back out of a
forgotten password. Do them before anything visual.

**Step 2 moved ahead of everything else on purpose.** Every later step writes user-facing copy; if
the dictionary is not in place first, each of them has to be rewritten.

---

## 12. End-to-end acceptance script

Run this on a **fresh account against staging** before calling the system working. Every step must
pass without touching the database directly.

1. Open `/` → the purpose is clear without scrolling
2. Sign up with a new email → confirmation notice renders as a notice, not an error
3. Open the emailed link → land on `/today` with a full week already scheduled
4. Sign out → sign back in with the password
5. Sign out → **forgot password** → the message is identical for a real and a fake address
6. Open the reset link → set a new password → land on `/today`
7. The old password now fails; the new one works
8. Sign in with Google using a different address → a second, separate account with its own plan
9. On `/today`: log a set, edit it, delete it — the progress bar tracks each change
10. Press ✓ with every field empty → refused
11. Start a session → the timer counts up in real time
12. On a day with two plans → switch → the exercise list changes, logged sets survive, off-plan
    sets are listed
13. Finish the workout → it appears in `/history` with the right volume
14. On `/schedule`: add a plan to a weekday, add exercises, set it as default → next week reflects it
15. On `/analytics`: the heatmap shows today as trained, yesterday's skipped plan as missed, and
    Sunday as a planned rest day — three visibly different states
16. On `/settings`: change the weekly goal → `/analytics` reflects it
17. Sign in as the second account → none of the first account's data is visible anywhere
18. As a non-admin, open `/admin` → 404, and no admin link in the header
19. `curl` a cron endpoint without the secret → 401
20. Switch the language in Settings → body copy changes, **headings stay English**, and the choice
    survives a sign-out
21. Repeat 9–13 on a phone → every control is thumb-reachable and nothing overflows

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| i18n retrofitted late | Every page written before step 2 has to be rewritten — do the scaffolding first |
| Palette decision deferred | Charts are where it hurts; settle before Stats (step 10) |
| Variants migration fails on real data | Run on staging first; the unique index is the check |
| Progression rule wrong | Unit tests before UI — the §4 table in `13-progression-spec.md` is the minimum |
| Weight step too large at light loads | The 10% guard; without it a 7.5 kg lift jumps 33% and fails on set one |
| Heatmap built on `daily_stats` alone | Missed days would be invisible; use the left-join shape in §6.1 |
| Streak defined three ways | Pick one, put it in `lib/stats.ts`, delete the others |
| Preview deployments hitting production data | Separate Supabase project before sharing any preview link |
| Unit toggles that do nothing | Implement conversion or remove the options |
