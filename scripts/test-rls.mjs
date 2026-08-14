/**
 * Proves Row Level Security actually blocks cross-user access.
 *
 * Report/05-implementation-plan.md phase 1 requires this to be verified with two
 * real accounts, not just assumed. Runs against whatever NEXT_PUBLIC_SUPABASE_URL
 * points at — normally the local stack from `npx supabase start`.
 *
 * Usage: npm run test:rls
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env.local reader — avoids pulling in a dotenv dependency for one script.
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

if (!URL_ || !PUBLISHABLE || !SECRET) {
  console.error("Missing Supabase env vars. Check .env.local.");
  process.exit(1);
}

const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });

let failures = 0;
const check = (name, passed, detail = "") => {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures++;
};

/**
 * A negative read must come back empty *and* without an error.
 * An error would mean the role lacks the GRANT entirely, which looks like a pass
 * but proves nothing about the policies — that is how a missing grant hid real
 * failures the first time this ran.
 */
const expectEmptyRead = (name, { data, error }) =>
  check(name, !error && (data?.length ?? -1) === 0,
    error ? `unexpected error: ${error.message}` : `got ${data?.length} rows`);

/** A negative write may either error or silently affect nothing. */
const expectBlockedWrite = (name, { data, error }) =>
  check(name, !!error || (data?.length ?? 0) === 0,
    error ? "blocked with error" : "affected 0 rows");

async function makeUser(email) {
  const password = "rls-test-password-1234";
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw new Error(`createUser(${email}): ${createErr.message}`);

  const client = createClient(URL_, PUBLISHABLE, { auth: { persistSession: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn(${email}): ${signInErr.message}`);

  return { id: created.user.id, client };
}

async function cleanup(ids) {
  for (const id of ids) {
    // supabase-js resolves with { error } rather than rejecting, so a .catch()
    // here would swallow nothing and hide leftover test accounts. Report instead.
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      console.error(`  WARN  could not delete test user ${id}: ${error.message}`);
      failures++;
    }
  }
}

const stamp = Date.now();
let a, b;

try {
  console.log("\nRLS cross-user access test\n");

  a = await makeUser(`rls-a-${stamp}@example.com`);
  b = await makeUser(`rls-b-${stamp}@example.com`);

  // The signup trigger should have created the public.users + user_settings rows.
  const { data: aSelf } = await a.client.from("users").select("id").eq("id", a.id).maybeSingle();
  check("signup trigger created the user row", aSelf?.id === a.id);

  const { data: aSettings } = await a.client
    .from("user_settings").select("weekly_goal_days").eq("user_id", a.id).maybeSingle();
  check("signup trigger created user_settings", aSettings?.weekly_goal_days === 5,
    `weekly_goal_days=${aSettings?.weekly_goal_days}`);

  // A writes a session of their own.
  const { data: aSession, error: aInsErr } = await a.client
    .from("sessions")
    .insert({ user_id: a.id, date: "2026-08-14", status: "completed" })
    .select("id").single();
  check("user A can insert their own session", !aInsErr && !!aSession?.id, aInsErr?.message);

  // ── The actual isolation checks ──

  expectEmptyRead(
    "user B cannot read user A's sessions",
    await b.client.from("sessions").select("id").eq("user_id", a.id),
  );

  expectEmptyRead(
    "an unfiltered select returns only B's own rows",
    await b.client.from("sessions").select("id"),
  );

  expectBlockedWrite(
    "user B cannot insert a row owned by A",
    await b.client
      .from("sessions").insert({ user_id: a.id, date: "2026-08-15", status: "completed" }).select("id"),
  );

  expectBlockedWrite(
    "user B cannot update A's session",
    await b.client.from("sessions").update({ note: "hijacked" }).eq("id", aSession.id).select("id"),
  );

  expectBlockedWrite(
    "user B cannot delete A's session",
    await b.client.from("sessions").delete().eq("id", aSession.id).select("id"),
  );

  expectEmptyRead(
    "user B cannot read A's user row",
    await b.client.from("users").select("id").eq("id", a.id),
  );

  // Child table reached through its parent.
  await a.client.from("session_sets").insert({
    session_id: aSession.id,
    exercise_id: "db_bench_press",
    client_id: crypto.randomUUID(),
    set_index: 1,
    reps: 10,
    weight_kg: 12.5,
  });
  const { data: aSets, error: aSetsErr } = await a.client.from("session_sets").select("id");
  check("user A can read their own sets", !aSetsErr && aSets?.length === 1,
    aSetsErr?.message ?? `got ${aSets?.length} rows`);

  expectEmptyRead(
    "user B cannot read A's session_sets",
    await b.client.from("session_sets").select("id"),
  );

  // The rollup is user-scoped too, and the trigger should have populated it.
  const { data: aStats } = await a.client
    .from("daily_stats").select("total_volume_kg, sets_by_muscle").eq("date", "2026-08-14").maybeSingle();
  check("trigger populated daily_stats for A", Number(aStats?.total_volume_kg) === 125,
    `total_volume_kg=${aStats?.total_volume_kg} (expected 125 = 12.5kg × 10)`);
  check("daily_stats counted the set against its muscle group",
    aStats?.sets_by_muscle?.chest === 1, JSON.stringify(aStats?.sets_by_muscle));

  expectEmptyRead(
    "user B cannot read A's daily_stats",
    await b.client.from("daily_stats").select("date"),
  );

  // The stock library is deliberately readable by everyone.
  const { count: exCount, error: exErr } = await b.client
    .from("exercises").select("id", { count: "exact", head: true });
  check("both users can read the stock exercise library", !exErr && exCount === 41,
    exErr?.message ?? `count=${exCount}`);

  expectBlockedWrite(
    "a user cannot insert a stock (unowned) exercise",
    await b.client
      .from("exercises")
      .insert({ id: "hacked", name: "x", kind: "strength", muscle: "chest" }).select("id"),
  );
} catch (err) {
  console.error(`\nERROR: ${err.message}`);
  failures++;
} finally {
  await cleanup([a?.id, b?.id].filter(Boolean));
}

console.log(failures === 0 ? "\nAll RLS checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
