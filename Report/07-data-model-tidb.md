# 07 — Data Model for TiDB

This document is an **alternative to `02-data-model.md`** (which is written for PostgreSQL/Supabase).
It is not a supplement — pick one or the other.

Checked against the official TiDB documentation as of August 2026.

---

## 1. Read this before deciding

TiDB is a distributed, MySQL-compatible database. It's strong at horizontal scale and HTAP workloads.
For this project, though, **four things are missing** and have to be built by hand:

| Supabase gives you | Does TiDB have it? | What you write instead |
|---|---|---|
| **Row Level Security** | ❌ No | Enforce access control entirely in the application layer |
| **Auth** (email + Google) | ❌ No | Auth.js v5 or Better Auth |
| **Storage** (photos) | ❌ No | Vercel Blob, or S3/R2 |
| **Triggers / stored procedures** | ❌ **Not supported** | Move the computation into the app |

**The honest assessment:** this is a personal workout tracker with a few dozen users and a few tens
of thousands of rows per year. **It does not need what TiDB is good at.** What TiDB is good at isn't
this project's bottleneck, while the four things it lacks are all things you'd have to write.

Reasons that *do* justify choosing TiDB here:

- You're more comfortable with MySQL than Postgres and want to stay in that ecosystem
- You want to learn TiDB, and a real project is the best way to do it
- You genuinely plan to grow this into a large multi-tenant system later
- You need the MySQL wire protocol to connect existing tooling

If one of those is your reason, read on — this document is complete enough to build from.

---

## 2. Differences that shape the schema

| Topic | PostgreSQL | TiDB | Effect on the schema |
|---|---|---|---|
| Primary key | `uuid` + `gen_random_uuid()` | **`BIGINT AUTO_RANDOM`** | Changes every table — see §3.1 |
| Arrays (`text[]`) | Yes | ❌ No | Use `JSON` |
| `jsonb` | Yes | `JSON` (no binary variant) | Use plain `JSON` |
| `timestamptz` | Yes | ❌ No | Use `DATETIME(3)`, always storing UTC |
| Triggers | Yes | ❌ **Not supported** | Move `daily_stats` into the app |
| Stored functions | Yes | ❌ **Not supported** | Write them in TypeScript |
| Row Level Security | Yes | ❌ No | Enforce in the app — see §5 |
| `CHECK` constraints | On by default | Present, but **off by default** | Prefer `ENUM` |
| Foreign keys | Yes | Yes — GA since v8.5.0 | Usable, with a performance cost |
| `SERIAL` / auto-increment | Yes | Yes, but creates a write hotspot | **Never use it as a PK** |
| `NULLS NOT DISTINCT` on unique keys | Yes (PG 15+) | ❌ No | Use a sentinel value — see §7.1 |

---

## 3. Four key decisions

### 3.1 Primary key: `BIGINT AUTO_RANDOM`, not UUID and not AUTO_INCREMENT

TiDB distributes data by key range. If the primary key increases monotonically, **every new row
lands on the same node** — the classic distributed-database write hotspot.

```sql
id BIGINT AUTO_RANDOM PRIMARY KEY    -- ✅ spreads across the cluster
id BIGINT AUTO_INCREMENT PRIMARY KEY -- ❌ hotspot
id CHAR(36) PRIMARY KEY              -- ❌ 4.5× the index footprint for the same thing
```

`AUTO_RANDOM` constraints: it must be `BIGINT`, it must be the first column of the primary key,
it's a clustered index, and **it cannot be added later with `ALTER TABLE`** — decide up front.

> The generated values are large and non-sequential, e.g. `4611686018427387905`. Don't put them in
> URLs. If you want readable URLs, add a separate `slug` or `public_id CHAR(21)` (nanoid) column.

### 3.2 `ENUM` instead of `CHECK (x IN (...))`

TiDB supports `CHECK` but **leaves it disabled by default**; enabling it requires
`SET GLOBAL tidb_enable_check_constraint = ON;` and it still has limitations (you can't add a
column and its CHECK in the same statement).

MySQL's `ENUM` behaves the same way, is faster, and stores as 1–2 bytes. Use that.

### 3.3 `JSON` instead of arrays and `jsonb`

TiDB has no array type; store arrays as JSON.

```sql
focus JSON  -- ["chest","back_lat","shoulders"]
```

If you need to search by array member often, add a **multi-valued index**:

```sql
ALTER TABLE sessions ADD INDEX idx_focus ((CAST(focus AS CHAR(16) ARRAY)));
SELECT * FROM sessions WHERE 'back_lat' MEMBER OF (focus);
```

### 3.4 `DATETIME(3)`, always UTC

TiDB has no `timestamptz`, and MySQL's `TIMESTAMP` runs out in 2038.
Use `DATETIME(3)` (millisecond precision) and **store UTC only**.
Convert to local time in the app, reading `user_settings.timezone`.

---

## 4. Schema

```sql
-- ═══════════════ Users ═══════════════
CREATE TABLE users (
  id            BIGINT AUTO_RANDOM PRIMARY KEY,
  auth_subject  VARCHAR(255) NOT NULL,          -- user id from Auth.js / Better Auth
  email         VARCHAR(255) NOT NULL,
  display_name  VARCHAR(120) NOT NULL,
  avatar_url    VARCHAR(512),
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_users_subject (auth_subject),
  UNIQUE KEY uk_users_email (email)
);

CREATE TABLE user_settings (
  user_id             BIGINT PRIMARY KEY,
  unit                ENUM('kg','lb')   NOT NULL DEFAULT 'kg',
  length_unit         ENUM('cm','in')   NOT NULL DEFAULT 'cm',
  week_start          ENUM('mon','sun') NOT NULL DEFAULT 'mon',
  weekly_goal_days    TINYINT  NOT NULL DEFAULT 5,
  weekly_cardio_goal  TINYINT  NOT NULL DEFAULT 3,
  active_plan_id      BIGINT   NOT NULL DEFAULT 0,   -- 0 = none selected
  rir_target_min      TINYINT  NOT NULL DEFAULT 1,
  rir_target_max      TINYINT  NOT NULL DEFAULT 3,
  theme               ENUM('light','dark','system') NOT NULL DEFAULT 'system',
  timezone            VARCHAR(64) NOT NULL DEFAULT 'Asia/Bangkok',
  reminder_time       TIME NULL,
  vtaper_target       DECIMAL(4,3) NOT NULL DEFAULT 1.618,
  CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- Note: active_plan_id has no FK, because plans is created later and 0 is a sentinel
-- rather than a real row. Validate it in the app.

CREATE TABLE user_equipment (
  id            BIGINT AUTO_RANDOM PRIMARY KEY,
  user_id       BIGINT NOT NULL,
  equipment_id  VARCHAR(48) NOT NULL,     -- 'dumbbell_adj_25' | 'bench_flat' | 'treadmill'
  label         VARCHAR(120) NOT NULL,
  max_weight_kg DECIMAL(5,2) NULL,        -- 25.00
  attributes    JSON NULL,                -- {"incline": false}
  UNIQUE KEY uk_user_equipment (user_id, equipment_id),
  CONSTRAINT fk_equipment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ═══════════════ Exercise library ═══════════════
-- owner_id = 0 means a stock exercise seeded by the system
-- (0 rather than NULL, because NULL in a unique key behaves badly — see §7.1)
CREATE TABLE exercises (
  id              VARCHAR(48) PRIMARY KEY,   -- 'db_bench_press'
  owner_id        BIGINT NOT NULL DEFAULT 0,
  name            VARCHAR(160) NOT NULL,
  kind            ENUM('strength','bodyweight','cardio','duration') NOT NULL,
  muscle          ENUM('back_lat','shoulders','chest','legs','arms','core',
                       'glutes','cardio','neck') NOT NULL,
  secondary       JSON NULL,                 -- ["shoulders","arms"]
  equipment       JSON NULL,                 -- ["dumbbell_adj_25","bench_flat"]
  rep_min         SMALLINT NULL,
  rep_max         SMALLINT NULL,
  duration_min_s  INT NULL,
  duration_max_s  INT NULL,
  per_side        BOOLEAN NOT NULL DEFAULT FALSE,
  is_key_lift     BOOLEAN NOT NULL DEFAULT FALSE,
  note            TEXT NULL,
  is_public       BOOLEAN NOT NULL DEFAULT TRUE,
  KEY idx_ex_owner (owner_id),
  KEY idx_ex_muscle (muscle)
);

-- ═══════════════ Plans ═══════════════
CREATE TABLE plans (
  id          BIGINT AUTO_RANDOM PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  seed_id     VARCHAR(48) NULL,          -- 'plan_a_bodyweight' | 'plan_b_dumbbell'
  name        VARCHAR(160) NOT NULL,
  split_type  VARCHAR(64) NULL,
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  use_when    TEXT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_plans_user (user_id, is_active),
  CONSTRAINT fk_plans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE plan_days (
  id               BIGINT AUTO_RANDOM PRIMARY KEY,
  plan_id          BIGINT NOT NULL,
  day_of_week      TINYINT NOT NULL,       -- 0=Sunday … 6=Saturday, 9=add-on (unscheduled)
  label            VARCHAR(160) NOT NULL,
  focus            JSON NULL,
  is_rest          BOOLEAN NOT NULL DEFAULT FALSE,
  is_cardio_day    BOOLEAN NOT NULL DEFAULT FALSE,
  is_priority_day  BOOLEAN NOT NULL DEFAULT FALSE,
  rest_note        TEXT NULL,
  note             TEXT NULL,
  UNIQUE KEY uk_plan_day (plan_id, day_of_week),
  CONSTRAINT fk_days_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);

CREATE TABLE plan_items (
  id                    BIGINT AUTO_RANDOM PRIMARY KEY,
  plan_day_id           BIGINT NOT NULL,
  exercise_id           VARCHAR(48) NOT NULL,
  order_index           SMALLINT NOT NULL,
  target_sets           TINYINT NOT NULL,
  target_rep_min        SMALLINT NULL,
  target_rep_max        SMALLINT NULL,
  target_duration_min_s INT NULL,
  target_duration_max_s INT NULL,
  per_side              BOOLEAN NOT NULL DEFAULT FALSE,
  is_key                BOOLEAN NOT NULL DEFAULT FALSE,
  note                  TEXT NULL,
  UNIQUE KEY uk_items_order (plan_day_id, order_index),
  CONSTRAINT fk_items_day FOREIGN KEY (plan_day_id) REFERENCES plan_days(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_ex  FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

-- ═══════════════ What actually happened ═══════════════
CREATE TABLE sessions (
  id           BIGINT AUTO_RANDOM PRIMARY KEY,
  user_id      BIGINT NOT NULL,
  plan_day_id  BIGINT NOT NULL DEFAULT 0,   -- 0 = unplanned session (never NULL — see §7.1)
  plan_id      BIGINT NOT NULL DEFAULT 0,   -- which program was actually used (A or B)
  date         DATE NOT NULL,
  started_at   DATETIME(3) NULL,
  ended_at     DATETIME(3) NULL,
  status       ENUM('planned','completed','skipped','partial') NOT NULL DEFAULT 'planned',
  focus        JSON NULL,
  note         TEXT NULL,
  session_rpe  TINYINT NULL,
  UNIQUE KEY uk_session (user_id, date, plan_day_id),
  KEY idx_sessions_user_date (user_id, date DESC),
  KEY idx_sessions_status (user_id, status, date),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE session_sets (
  id            BIGINT AUTO_RANDOM PRIMARY KEY,
  session_id    BIGINT NOT NULL,
  user_id       BIGINT NOT NULL,             -- deliberately duplicated — see §5.2
  exercise_id   VARCHAR(48) NOT NULL,
  set_index     TINYINT NOT NULL,
  side          ENUM('left','right') NULL,
  reps          SMALLINT NULL,
  weight_kg     DECIMAL(6,2) NULL,
  duration_s    INT NULL,
  distance_m    DECIMAL(8,1) NULL,
  incline_pct   DECIMAL(4,1) NULL,
  rir           TINYINT NULL,
  is_warmup     BOOLEAN NOT NULL DEFAULT FALSE,
  client_id     CHAR(36) NOT NULL,           -- makes offline sync idempotent
  completed_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_client (client_id),
  KEY idx_sets_session (session_id, set_index),
  KEY idx_sets_lookup (user_id, exercise_id, completed_at DESC),  -- the "last time" lookup
  CONSTRAINT fk_sets_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_sets_ex      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
);

-- ═══════════════ Body composition ═══════════════
CREATE TABLE body_metrics (
  id        BIGINT AUTO_RANDOM PRIMARY KEY,
  user_id   BIGINT NOT NULL,
  date      DATE NOT NULL,
  metric_id ENUM('weight','body_fat_pct','measure_shoulder','measure_chest',
                 'measure_waist','measure_arm','measure_neck') NOT NULL,
  value     DECIMAL(7,2) NOT NULL,
  note      TEXT NULL,
  UNIQUE KEY uk_metric (user_id, date, metric_id),
  KEY idx_metric_series (user_id, metric_id, date DESC),
  CONSTRAINT fk_metrics_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE progress_photos (
  id           BIGINT AUTO_RANDOM PRIMARY KEY,
  user_id      BIGINT NOT NULL,
  date         DATE NOT NULL,
  pose         ENUM('front','side','back') NOT NULL,
  storage_key  VARCHAR(512) NOT NULL,       -- the key in Vercel Blob / S3, not a public URL
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_photos_user (user_id, date DESC),
  CONSTRAINT fk_photos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ═══════════════ Rollup table ═══════════════
CREATE TABLE daily_stats (
  user_id          BIGINT NOT NULL,
  date             DATE NOT NULL,
  session_count    SMALLINT NOT NULL DEFAULT 0,
  total_volume_kg  DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_duration_s INT NOT NULL DEFAULT 0,
  cardio_minutes   SMALLINT NOT NULL DEFAULT 0,
  sets_by_muscle   JSON NULL,               -- {"chest": 7, "back_lat": 8}
  was_planned      BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
                     ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id, date)
);
```

**On `daily_stats` hotspots:** the primary key is `(user_id, date)`, and `user_id` comes from
`AUTO_RANDOM`, so it already spreads well. Nothing more to do.
(Flipping it to `(date, user_id)` would create a hotspot immediately, since everyone writes the
same date — **don't**.)

---

## 5. Security — what you write yourself in the absence of RLS

This is where TiDB differs most from Supabase, and where a mistake is most dangerous.
**In Postgres the database protects you. In TiDB, a single missing `WHERE user_id = ?` leaks data.**

### 5.1 Exactly one layer touches the database

Never query from a component. Everything goes through a repository layer whose first parameter is
always `userId`.

```ts
// lib/db/repo.ts — the only place SQL is written
export function createRepo(userId: bigint) {
  return {
    async getSessions(from: string, to: string) {
      return db.select().from(sessions)
        .where(and(eq(sessions.userId, userId),      // ← every query needs this line
                   between(sessions.date, from, to)));
    },
    async getSetsForSession(sessionId: bigint) {
      return db.select().from(sessionSets)
        .where(and(eq(sessionSets.userId, userId),   // ← not just sessionId
                   eq(sessionSets.sessionId, sessionId)));
    },
  };
}

// lib/db/context.ts — a repo can only be built from an authenticated session
export async function getRepo() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('unauthenticated');
  return createRepo(await resolveUserId(session.user.id));
}
```

### 5.2 Why `session_sets` carries a duplicate `user_id`

`session_sets` is normally reached through `session_id`, but duplicating `user_id` means:

1. Every query can say `WHERE user_id = ?` without a JOIN — **much harder to forget**
2. The index `(user_id, exercise_id, completed_at DESC)` serves the "last time" lookup in one read
3. No cross-node JOIN, which costs more in TiDB than in Postgres

Deliberate denormalisation like this is standard practice in distributed databases.

### 5.3 Rules that need tooling behind them

- [ ] An ESLint rule forbidding `db` imports outside `lib/db/`
- [ ] Every PR touching SQL must answer where `user_id` is filtered
- [ ] An integration test where user A tries to read user B's data and gets an empty result
- [ ] The application's database user has only `SELECT, INSERT, UPDATE, DELETE` on one schema —
      no `DROP`, `CREATE USER`, or `GRANT`

---

## 6. `daily_stats` without triggers

TiDB has no triggers, so `02-data-model.md` §6 doesn't apply. The work moves into the app.

**Call this after every set write, edit, or delete**, in the same transaction:

```ts
// lib/db/refresh-daily-stats.ts
export async function refreshDailyStats(
  tx: Tx, userId: bigint, date: string
) {
  const [agg] = await tx.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM sessions s
        WHERE s.user_id = ${userId} AND s.date = ${date}
          AND s.status IN ('completed','partial'))                 AS session_count,
      (SELECT COALESCE(SUM(ss.weight_kg * ss.reps), 0)
         FROM session_sets ss JOIN sessions s ON s.id = ss.session_id
        WHERE s.user_id = ${userId} AND s.date = ${date}
          AND ss.is_warmup = 0)                                    AS total_volume_kg,
      (SELECT COALESCE(SUM(ss.duration_s), 0)
         FROM session_sets ss JOIN sessions s ON s.id = ss.session_id
        WHERE s.user_id = ${userId} AND s.date = ${date})          AS total_duration_s,
      (SELECT COALESCE(SUM(ss.duration_s), 0) DIV 60
         FROM session_sets ss
         JOIN sessions  s ON s.id = ss.session_id
         JOIN exercises e ON e.id = ss.exercise_id
        WHERE s.user_id = ${userId} AND s.date = ${date}
          AND e.kind = 'cardio')                                   AS cardio_minutes,
      (SELECT COALESCE(MAX(s.plan_day_id <> 0), 0) FROM sessions s
        WHERE s.user_id = ${userId} AND s.date = ${date})          AS was_planned
  `);

  // Set counts per muscle group come from a second query, assembled into JSON in TS
  const rows = await tx.execute(sql`
    SELECT e.muscle, COUNT(*) AS cnt
    FROM session_sets ss
    JOIN sessions   s ON s.id = ss.session_id
    JOIN exercises  e ON e.id = ss.exercise_id
    WHERE s.user_id = ${userId} AND s.date = ${date} AND ss.is_warmup = 0
    GROUP BY e.muscle
  `);
  const setsByMuscle = Object.fromEntries(rows.map(r => [r.muscle, Number(r.cnt)]));

  await tx.execute(sql`
    INSERT INTO daily_stats
      (user_id, date, session_count, total_volume_kg,
       total_duration_s, cardio_minutes, sets_by_muscle, was_planned)
    VALUES
      (${userId}, ${date}, ${agg.session_count}, ${agg.total_volume_kg},
       ${agg.total_duration_s}, ${agg.cardio_minutes},
       ${JSON.stringify(setsByMuscle)}, ${!!agg.was_planned})
    ON DUPLICATE KEY UPDATE
      session_count    = VALUES(session_count),
      total_volume_kg  = VALUES(total_volume_kg),
      total_duration_s = VALUES(total_duration_s),
      cardio_minutes   = VALUES(cardio_minutes),
      sets_by_muscle   = VALUES(sets_by_muscle),
      was_planned      = VALUES(was_planned)
  `);
}
```

Each subquery is scoped independently rather than joined together, for the same reason as the
Postgres version: a single grouped join fans out and produces wrong counts once a day has both
multiple sessions and multiple sets per exercise.

**Every call site has to be covered** — miss one and the stats go silently wrong:

| Action | Call `refreshDailyStats` |
|---|---|
| Log a new set | ✅ |
| Edit a set | ✅ |
| Delete a set | ✅ |
| Finish a workout | ✅ |
| Change a session's status or date | ✅ (both the old and new date, if the date moved) |
| Sync from offline | ✅ once per affected date |
| Nightly cron | ✅ recompute the last 7 days as a safety net |

> `ON DUPLICATE KEY UPDATE` is MySQL/TiDB's upsert
> (equivalent to Postgres's `ON CONFLICT … DO UPDATE`).

---

## 7. Traps to watch for

### 7.1 `UNIQUE KEY` and `NULL`

In MySQL/TiDB, **`NULL` never collides with `NULL`** in a unique index.
If `sessions.plan_day_id` were nullable, you could insert unlimited duplicate sessions for one day.

```sql
-- ❌ many NULL rows, and the unique key stays silent
plan_day_id BIGINT NULL,
UNIQUE KEY uk (user_id, date, plan_day_id)

-- ✅ use 0 to mean "not linked to a plan"
plan_day_id BIGINT NOT NULL DEFAULT 0,
UNIQUE KEY uk (user_id, date, plan_day_id)
```

*(The same hazard exists in PostgreSQL. `02-data-model.md` handles it with
`UNIQUE NULLS NOT DISTINCT`, which PG 15 added and TiDB does not have — hence the sentinel here.)*

### 7.2 `BIGINT` exceeds JavaScript's safe integer range

`AUTO_RANDOM` produces 64-bit values, well past `Number.MAX_SAFE_INTEGER` — **they corrupt silently**.

```ts
// ❌ 4611686018427387905 → 4611686018427388000
// ✅ use BigInt internally, and stringify on the way out
JSON.stringify({ id: row.id.toString() })
```

Configure the driver to return `BIGINT` as a string or BigInt from the start. Never let it be a `number`.

### 7.3 Schema changes need forward planning

- `AUTO_RANDOM` **cannot** be added later via `ALTER TABLE` — it has to be there at `CREATE TABLE`
- A single `ALTER TABLE` doing several things at once is more restricted than in MySQL
- Foreign keys don't work with partitioned tables

### 7.4 Foreign keys have a cost

FKs have been GA since v8.5.0, but the documentation warns about performance.
At this project's size, **turn them on** — data integrity matters more here.
If growth ever makes them a bottleneck, drop them and move the checks into the app.

### 7.5 Don't rely on `CHECK`

It's off by default. Migrate the database or spin up a new cluster and forget to enable it, and the
constraints vanish silently. **Validate in the app (Zod) as the primary line of defence, always.**

---

## 8. Connecting from Vercel

### 8.1 Serverless driver (over HTTP)

Serverless functions can't hold TCP connections open, so TiDB Cloud provides a driver that speaks
HTTP. It works in both the Node and Edge runtimes.

```bash
npm install @tidbcloud/serverless
```

```ts
// lib/db/client.ts
import { connect } from '@tidbcloud/serverless';
import { drizzle } from 'drizzle-orm/tidb-serverless';
import * as schema from './schema';

const conn = connect({ url: process.env.DATABASE_URL! });
export const db = drizzle(conn, { schema, mode: 'default' });
```

```ts
// app/api/stats/route.ts
export const runtime = 'edge';   // works, because the driver speaks HTTP
```

Supported ORMs: **Drizzle**, **Prisma** (via adapter), **Kysely** (via dialect).
**Drizzle** is the recommendation — lightest, and type-safe against the schema.

### 8.2 Environment variables

TiDB Cloud has a Vercel marketplace integration that sets these automatically:

```
TIDB_HOST  TIDB_PORT  TIDB_USER  TIDB_PASSWORD  TIDB_DATABASE
DATABASE_URL          ← used by Prisma and the serverless driver
```

Replace the env var table in `06-deploy-vercel.md` §5 with:

| Variable | Production | Preview | Type |
|---|---|---|---|
| `DATABASE_URL` | prod cluster | **staging cluster** | Encrypted |
| `AUTH_SECRET` | random, 32+ chars | a different value | Encrypted |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from Google Cloud | can be shared | Encrypted |
| `BLOB_READ_WRITE_TOKEN` | from Vercel Blob | staging store | Encrypted |
| `CRON_SECRET` | random | — | Encrypted |

Create **two separate clusters** (prod / staging), same as the Supabase approach.

### 8.3 What changes in the stack

| Part | Was (Supabase) | Now (TiDB) |
|---|---|---|
| Database | Postgres | TiDB Cloud |
| ORM / client | `@supabase/supabase-js` | `@tidbcloud/serverless` + Drizzle |
| Auth | Supabase Auth | **Auth.js v5** or **Better Auth** (both have MySQL adapters) |
| Photo storage | Supabase Storage | **Vercel Blob** (private) or Cloudflare R2 |
| Access control | RLS | Repository layer + tests |
| Migrations | Supabase CLI | **Drizzle Kit** (`drizzle-kit generate` / `migrate`) |

---

## 9. Seeding

`data/program-seed.json` is unchanged; only the loading mechanism differs:

```ts
// scripts/seed.ts
import seed from '../Report/data/program-seed.json';

await db.insert(exercises).values(
  seed.exercises.map(e => ({
    id: e.id, ownerId: 0n, name: e.name, kind: e.kind, muscle: e.muscle,
    secondary: e.secondary ?? [], equipment: e.equipment ?? [],
    repMin: e.repRange?.[0] ?? null, repMax: e.repRange?.[1] ?? null,
    durationMinS: e.durationRangeS?.[0] ?? null,
    durationMaxS: e.durationRangeS?.[1] ?? null,
    perSide: !!e.perSide, isKeyLift: !!e.isKeyLift, note: e.note ?? null,
  }))
).onDuplicateKeyUpdate({ set: { name: sql`VALUES(name)` } });
```

> `plans` / `plan_days` / `plan_items` have to be tied to a real `user_id`, so they're seeded when
> a user signs up, not when the database is set up. Write it as `provisionUser(userId)` and call it
> after a successful signup.

Note that the `addon_neck` plan has `dayOfWeek: null` in the seed. Map it to `9` when inserting,
per the `plan_days` convention in §4.

---

## 10. TiDB-specific checklist

- [ ] Every primary key is `BIGINT AUTO_RANDOM` — no `AUTO_INCREMENT` anywhere
- [ ] The driver returns `BIGINT` as a string or BigInt, never a `number`
- [ ] No column in any `UNIQUE KEY` is nullable
- [ ] Every query goes through the repository layer and filters on `user_id`
- [ ] There's a test proving user A can't read user B's data
- [ ] `refreshDailyStats` is called at all seven sites in the §6 table
- [ ] A nightly cron recomputes `daily_stats` for the last 7 days as a safety net
- [ ] App-layer validation (Zod) is complete; nothing depends on database `CHECK`
- [ ] Cluster region matches the Vercel function region (Singapore)
- [ ] Separate prod / staging clusters, with preview pointed only at staging
- [ ] The app's database user has no `DROP` or `GRANT` privileges

---

## 11. Summary

TiDB can do everything this project needs — the schema here is ready to build on.
The cost is roughly three extra pieces of work: **the access-control layer**, **authentication**,
and **the `daily_stats` computation** — all of which Supabase provides for free.

Rough estimate: about **1–2 extra weeks**, spread across phases 1 and 4.
If your reason is MySQL familiarity or wanting to learn TiDB, that's a fair trade.
If your goal is to finish as fast as possible, use `02-data-model.md` instead.

---

*Verified against the [TiDB docs](https://docs.pingcap.com/) as of August 2026. TiDB ships often —
check the current status of foreign keys and CHECK constraints in particular before starting.*
