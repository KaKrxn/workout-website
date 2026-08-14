# 06 — Deploying on Vercel

A guide to deploying FitTrack (Next.js App Router + Supabase) on Vercel.
Checked against the Vercel and Supabase documentation as of August 2026.

---

## 1. Architecture

```
GitHub repo (workout-website)
      │  push
      ▼
┌─────────────────────────────────┐        ┌──────────────────────┐
│ Vercel                          │        │ Supabase             │
│  · Production  ← branch main    │◄──────►│  · Project: prod     │
│  · Preview     ← every PR/branch│        │  · Project: staging  │
│  · Edge network + image opt.    │        │  Postgres + Auth     │
│  · Cron jobs                    │        │  + Storage + RLS     │
└─────────────────────────────────┘        └──────────────────────┘
```

**The rule:** run **two separate Supabase projects** (prod / staging).
Every preview deployment points at staging only — that keeps an unfinished migration away from
real data.

---

## 2. Preparing the repository

`Z:\!Website\workout-website` is already a git repo. Add:

**`.gitignore`**

```gitignore
node_modules
.next
.vercel
.env*.local
.env
supabase/.temp
*.log
```

**`.env.example`** — commit this file (with no real values) so the required variables are documented

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
CRON_SECRET=
```

> **Never commit a `.env.local` containing real values.** If one is pushed by accident,
> rotate the keys in the Supabase dashboard immediately. Deleting the commit is not enough.

**Should `Report/` be committed?** Yes — keeping the design docs next to the code stops the two
from drifting apart, and Vercel doesn't build `.md` files outside `app/`, so it costs nothing at
build time.

---

## 3. Supabase setup

### 3.1 Create two projects

| Project | Used by | Suggested region |
|---|---|---|
| `fittrack-prod` | Production | Singapore (`ap-southeast-1`) — closest to Thailand |
| `fittrack-staging` | Preview + development | Singapore as well |

### 3.2 Which keys to use (important — the key format changed)

Supabase moved to a new key format, and **the legacy keys are being retired through the end of 2026**.
New projects should use the new format from the start. Don't use `anon` / `service_role`.

| Key | Format | Where it's used | Replaces |
|---|---|---|---|
| Publishable | `sb_publishable_…` | Safe in the browser — low privilege, relies on RLS | `anon` (legacy) |
| Secret | `sb_secret_…` | **Server only.** Bypasses RLS entirely | `service_role` (legacy) |

> The secret key bypasses all RLS — leaking it to the client is equivalent to opening the whole
> database. Never give it a variable name starting with `NEXT_PUBLIC_`; Next.js inlines those into
> the client bundle.

### 3.3 Running migrations

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`db push` applies everything in `supabase/migrations/`. Run it against staging first, always.

**Seeding is a separate step.** `supabase/seed.sql` is applied automatically by
`supabase db reset`, which is a *local* workflow — `--linked` variant drops and recreates the
remote database, so do not point it at a project with real data. For a remote project, apply the
seed directly:

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

Write `seed.sql` so it is idempotent (`on conflict … do nothing` on the stock exercise rows),
because it will get run more than once. Note that only the exercise library is global —
plans and settings are created per user by `provisionUser()` at signup, not by the seed file
(see `02-data-model.md` §8).

> Recent Supabase CLI versions have added flags for including the seed in a push. Check
> `npx supabase db push --help` for what your installed version supports before relying on it.

---

## 4. Connecting Vercel

### 4.1 Import the project

1. Vercel dashboard → **Add New… → Project** → pick the `workout-website` repo
2. Framework preset: **Next.js** (Vercel detects it)
3. Root directory: `./` — point it at the subfolder if the Next.js app lives in one
4. Build command / output directory: **leave the defaults alone**

### 4.2 Two ways to wire up Supabase

| Approach | Upside | Watch out for |
|---|---|---|
| **A. Supabase marketplace integration** (recommended) | Sets env vars automatically, rotates them on change | Links one Supabase project to one Vercel project — you still have to configure preview separately if you want staging |
| **B. Set env vars manually** | Full control, prod/preview split however you like | You rotate keys yourself |

**Integration A sets these automatically:**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
POSTGRES_URL              POSTGRES_URL_NON_POOLING
POSTGRES_PRISMA_URL       POSTGRES_USER / HOST / PASSWORD / DATABASE
```

---

## 5. Environment variables

Set these at Vercel → Project → **Settings → Environment Variables**.
Vercel keeps three environments distinct; give them different values:

| Variable | Production | Preview | Development | Type |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | prod URL | **staging URL** | staging URL | Plain |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | prod key | staging key | staging key | Plain |
| `SUPABASE_SECRET_KEY` | prod secret | staging secret | staging secret | **Encrypted** |
| `CRON_SECRET` | random, 32+ chars | (not needed) | (not needed) | **Encrypted** |
| `NEXT_PUBLIC_SITE_URL` | the real domain | leave empty (inferred) | `http://localhost:3000` | Plain |

**System variables Vercel provides** (don't set these yourself):

| Variable | Value | Use |
|---|---|---|
| `VERCEL_ENV` | `production` / `preview` / `development` | Switch config by environment |
| `VERCEL_URL` | The URL of that specific deployment | Building preview redirect URLs |
| `VERCEL_PROJECT_PRODUCTION_URL` | The production domain | A stable base URL even from a preview |

**Resolving the right base URL in every environment:**

```ts
// lib/site-url.ts
export function getSiteURL() {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??            // the real domain, if set
    process.env.NEXT_PUBLIC_VERCEL_URL ??          // this preview deployment's URL
    'http://localhost:3000';
  return url.startsWith('http') ? url : `https://${url}`;
}
```

---

## 6. Auth redirect configuration (the most common thing to get wrong)

Supabase keeps an allow-list of redirect URLs. Without it, **logging in from a preview deployment
bounces back to localhost**.

Go to Supabase → **Authentication → URL Configuration**

**Site URL**

```
https://fittrack.your-domain.com
```

**Redirect URLs** — Supabase supports wildcards (`*` doesn't cross a separator, `**` does)

```
http://localhost:3000/**
https://fittrack.your-domain.com/**
https://*-<team-slug>.vercel.app/**      ← covers every preview deployment
```

> The Supabase docs recommend restricting wildcards to localhost and previews.
> Production should list explicit paths rather than a broad `**`.

**Configure Google OAuth too** — in the Google Cloud console, add
`https://<project-ref>.supabase.co/auth/v1/callback` as an authorised redirect URI.

---

## 7. `vercel.json`

At the project root:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/generate-sessions",
      "schedule": "0 18 * * 0"
    },
    {
      "path": "/api/cron/refresh-stats",
      "schedule": "0 19 * * *"
    }
  ],
  "functions": {
    "app/api/**/*": { "maxDuration": 30 }
  }
}
```

**What the two cron jobs do**

| Path | Schedule (UTC) | Local time (ICT) | Purpose |
|---|---|---|---|
| `/api/cron/generate-sessions` | `0 18 * * 0` | Mon 01:00 | Create four weeks of `status='planned'` sessions ahead, from `plan_days` |
| `/api/cron/refresh-stats` | `0 19 * * *` | Daily 02:00 | Recompute `daily_stats` for the last 7 days as a safety net behind the triggers |

> **Vercel cron schedules are always UTC.** Subtract 7 hours from Thai time.
> Monday 01:00 ICT = Sunday 18:00 UTC → `0 18 * * 0`.

**Protect the cron endpoints** — otherwise anyone can call them:

```ts
// app/api/cron/generate-sessions/route.ts
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // …the actual work
  return Response.json({ ok: true });
}
```

Vercel attaches the `Authorization: Bearer <CRON_SECRET>` header automatically once that variable
is set.

> **The route guard has to let cron through.** A cron request carries no session cookie, so any
> auth middleware that redirects unauthenticated requests will bounce the scheduler to `/login`
> with a 307 and the job silently never runs. Exclude `/api/cron` from the guard's public-path
> list — the handler's own `CRON_SECRET` check is what protects it.
>
> On Next.js 16 that guard lives in `proxy.ts`; the `middleware` file convention was renamed.

---

## 8. Project-specific gotchas

### 8.1 PWA / service worker

- Put `manifest.json` and `sw.js` in `public/`; Vercel serves them as static files
- **Set `sw.js` to no-cache**, or users get stuck on an old version:

```json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}
```

### 8.2 Caching and the analytics page

`/analytics` is per-user data and **must never be cached at the edge**.
Add `export const dynamic = 'force-dynamic'` to any page reading user data — or use `cookies()`,
which already forces Next.js into dynamic rendering.

### 8.3 Progress photos

Store them in a **private Supabase Storage bucket**, not in Vercel's `public/`.
Serve them through short-lived signed URLs (60 seconds is plenty).

If you use `next/image` with Supabase-hosted images, allow the host:

```ts
// next.config.ts
export default {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/**' },
    ],
  },
};
```

### 8.4 Function region

Set the Vercel function region to **Singapore (`sin1`)** to match Supabase.
Different continents add hundreds of milliseconds to every query — the analytics page will
feel it immediately.

---

## 9. Custom domain

1. Vercel → Settings → **Domains** → Add
2. At your registrar, create the record Vercel specifies
   (`A` → Vercel's IP for an apex domain, or `CNAME` → `cname.vercel-dns.com` for a subdomain)
3. HTTPS is issued automatically; nothing to do
4. **Go back and update the Supabase site URL and redirect URLs to the new domain**

---

## 10. Pre-launch checklist

**Security**

- [ ] RLS is enabled on every table, and verified with two real accounts that can't see each other
- [ ] `SUPABASE_SECRET_KEY` is not prefixed with `NEXT_PUBLIC_`
- [ ] `CRON_SECRET` is set, and the cron endpoints actually check the header
- [ ] No `.env` in git history (`git log --all -- .env`)
- [ ] The photo storage bucket is private and served via signed URLs

**Functionality**

- [ ] Login/signup works on a **preview deployment**, not just localhost
- [ ] Google OAuth redirect URI is registered in the Google Cloud console
- [ ] Both cron jobs fire successfully (Vercel → Observability → Crons)
- [ ] `/analytics` isn't cached across users — check by alternating two accounts
- [ ] Dark mode is correct on all four pages
- [ ] On a real phone, the bottom nav and set checkboxes are comfortable one-handed

**Performance**

- [ ] Function region matches the Supabase region (Singapore)
- [ ] `daily_stats` is in use — the analytics page never queries `session_sets` directly
- [ ] Mobile Lighthouse ≥ 90 for both Performance and Accessibility

---

## 11. Common problems

| Symptom | Cause | Fix |
|---|---|---|
| Build succeeds, **every** page returns 500 — including static ones | The auth guard runs before every route and throws when the Supabase env vars are missing | Set the variables and redeploy. The guard should also skip Supabase on public paths and return a readable 503 when unset, so one missing variable doesn't take the whole site down |
| Build succeeds, runtime errors | An env var missing in that environment | Check the variable is ticked for Production / Preview / Development |
| Changed an env var, nothing happened | Vercel inlines env vars at build time | **Redeploy** — a refresh isn't enough |
| Login on preview redirects to localhost | Redirect URLs don't cover previews | Add `https://*-<team-slug>.vercel.app/**` in Supabase |
| `NEXT_PUBLIC_*` is `undefined` on the client | Misspelled, or deployed before it was set | The prefix must be exactly `NEXT_PUBLIC_`, then redeploy |
| Cron never fires | It's on a preview deployment | **Cron only runs on production deployments** |
| Cron returns 307 to /login | The auth guard runs before the handler | Add `/api/cron` to the guard's public paths — cron has no session cookie |
| Cron schedule silently downgraded | Hobby plans cap cron frequency and count | Check the current Hobby limits; both jobs here are ≤ daily, which is the safe side |
| Cron fires at the wrong time | Thai time entered directly | Vercel uses UTC — subtract 7 hours |
| A user sees someone else's data | Incomplete RLS, or a cached page | Audit the policies and add `dynamic = 'force-dynamic'` |
| Service worker stuck on an old version | `sw.js` is being cached | Set `Cache-Control: max-age=0, must-revalidate` |

---

## 12. Cost

| Service | Free tier | Enough for this project? |
|---|---|---|
| Vercel Hobby | Personal use only, not commercial · includes cron | **Yes**, for a few dozen users |
| Supabase Free | 500 MB database · 1 GB storage · project pauses after a week of inactivity | **Yes** — but progress photos will hit the 1 GB limit before anything else does |

Storage from progress photos is the first ceiling you'll hit. Three poses weekly at ~2 MB each is
roughly 300 MB per user per year. Compressing to WebP before upload cuts that by about 70%.

> **Watch out on the Supabase free tier:** projects are paused after a period of inactivity.
> For serious long-term use, a paid plan avoids finding the database asleep when you need it.

---

## 13. Commands you'll use often

```bash
npm i -g vercel          # install the CLI
vercel link              # link this folder to the Vercel project
vercel env pull .env.local   # pull env vars down for local dev
vercel                   # deploy a preview
vercel deploy --prod     # deploy to production
vercel build --prod      # build locally with production env (useful for debugging builds)
vercel logs <url>        # view a deployment's logs
```

---

*Verified against the Vercel and Supabase documentation as of August 2026. Check
[Vercel Docs](https://vercel.com/docs) and [Supabase Docs](https://supabase.com/docs) before
relying on any of it — these details change often.*
