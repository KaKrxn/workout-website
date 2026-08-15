/**
 * Proves the admin role grants read-only access and nothing more.
 *
 * This matters more than the admin console itself: the whole point of the role
 * is to cross the boundary every other part of the app respects, so the exact
 * width of that crossing has to be pinned down by a test rather than assumed.
 *
 * Checklist from Report/09-admin-implementation-plan.md §6.4.
 *
 * Usage: npm run test:admin
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });

let failures = 0;
const check = (name, passed, detail = "") => {
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures++;
};

/**
 * A blocked read must return empty *without* an error. An error means the role
 * lacks the GRANT, which looks identical to a working policy from the outside
 * and hides real failures — that exact confusion bit us in test-rls.mjs.
 */
const expectEmptyRead = (name, { data, error }) =>
  check(name, !error && (data?.length ?? -1) === 0,
    error ? `unexpected error: ${error.message}` : `got ${data?.length} rows`);

const expectRows = (name, { data, error }, atLeast = 1) =>
  check(name, !error && (data?.length ?? 0) >= atLeast,
    error ? `error: ${error.message}` : `got ${data?.length} rows`);

const expectBlockedWrite = (name, { data, error }) =>
  check(name, !!error || (data?.length ?? 0) === 0,
    error ? "blocked with error" : "affected 0 rows");

async function makeUser(email) {
  const password = "admin-test-password-1234";
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);

  const client = createClient(URL_, PUBLISHABLE, { auth: { persistSession: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw new Error(`signIn(${email}): ${signInErr.message}`);

  return { id: data.user.id, client };
}

const stamp = Date.now();
let plain, boss;

try {
  console.log("\nAdmin role isolation\n");

  plain = await makeUser(`admin-plain-${stamp}@example.com`);
  boss = await makeUser(`admin-boss-${stamp}@example.com`);

  // Grant admin the only way it can be granted: a row, inserted out of band.
  const { error: grantErr } = await admin
    .from("admin_users").insert({ user_id: boss.id, note: "test" });
  if (grantErr) throw new Error(`grant admin: ${grantErr.message}`);

  // Give the plain user data worth protecting.
  const { data: session } = await plain.client
    .from("sessions")
    .insert({ user_id: plain.id, date: "2026-08-14", status: "completed" })
    .select("id").single();

  await plain.client.from("session_sets").insert({
    session_id: session.id, exercise_id: "db_bench_press",
    client_id: crypto.randomUUID(), set_index: 1, reps: 10, weight_kg: 20,
  });
  await plain.client.from("body_metrics").insert({
    user_id: plain.id, date: "2026-08-14", metric_id: "weight", value: 70,
  });

  // ── is_admin() reports correctly ──
  const { data: plainIsAdmin } = await plain.client.rpc("is_admin");
  check("is_admin() is false for a normal user", plainIsAdmin === false, String(plainIsAdmin));

  const { data: bossIsAdmin } = await boss.client.rpc("is_admin");
  check("is_admin() is true for an admin", bossIsAdmin === true, String(bossIsAdmin));

  // ── What an admin may read ──
  expectRows("admin reads all users", await boss.client.from("users").select("id"), 2);
  expectRows("admin reads user_settings", await boss.client.from("user_settings").select("user_id"), 2);
  expectRows("admin reads other users' sessions",
    await boss.client.from("sessions").select("id").eq("user_id", plain.id));
  expectRows("admin reads job_runs", await boss.client.from("job_runs").select("id"), 0);

  // ── What an admin may NOT read: the private tables ──
  expectEmptyRead("admin cannot read others' session_sets",
    await boss.client.from("session_sets").select("id"));
  expectEmptyRead("admin cannot read others' body_metrics",
    await boss.client.from("body_metrics").select("id"));
  expectEmptyRead("admin cannot read others' progress_photos",
    await boss.client.from("progress_photos").select("id"));
  expectEmptyRead("admin cannot read others' equipment",
    await boss.client.from("user_equipment").select("id"));

  // ── Read-only: no writes to another user's data ──
  expectBlockedWrite("admin cannot update another user's session",
    await boss.client.from("sessions").update({ note: "x" }).eq("id", session.id).select("id"));
  expectBlockedWrite("admin cannot delete another user's session",
    await boss.client.from("sessions").delete().eq("id", session.id).select("id"));
  expectBlockedWrite("admin cannot delete another user's row",
    await boss.client.from("users").delete().eq("id", plain.id).select("id"));

  // ── The exercise library is the one writable surface ──
  const { error: stockErr } = await boss.client
    .from("exercises").update({ note: "edited by admin" }).eq("id", "db_bench_press");
  check("admin can edit a stock exercise", !stockErr, stockErr?.message);

  const { error: plainStockErr } = await plain.client
    .from("exercises").update({ note: "nope" }).eq("id", "db_bench_press");
  const { data: after } = await admin
    .from("exercises").select("note").eq("id", "db_bench_press").single();
  check("a normal user cannot edit a stock exercise",
    !!plainStockErr || after?.note === "edited by admin", after?.note ?? "");

  // ── The drift function is admin-only ──
  const { error: driftDenied } = await plain.client.rpc("admin_stats_drift", { p_days: 7 });
  check("admin_stats_drift rejects a normal user", !!driftDenied,
    driftDenied ? "blocked" : "ALLOWED");

  const { error: driftOk } = await boss.client.rpc("admin_stats_drift", { p_days: 7 });
  check("admin_stats_drift works for an admin", !driftOk, driftOk?.message);

  // ── admin_users is not readable at all ──
  expectEmptyRead("the admin roster is not readable through the API",
    await boss.client.from("admin_users").select("user_id"));

  // ── Audit log is append-only and cannot be forged ──
  const { error: auditOk } = await boss.client
    .from("admin_audit_log").insert({ actor_id: boss.id, action: "test" });
  check("admin can append to the audit log", !auditOk, auditOk?.message);

  const { error: forgeErr } = await boss.client
    .from("admin_audit_log").insert({ actor_id: plain.id, action: "forged" });
  check("admin cannot write a log entry attributed to someone else", !!forgeErr);

  const { error: plainAuditErr } = await plain.client
    .from("admin_audit_log").insert({ actor_id: plain.id, action: "sneaky" });
  check("a normal user cannot write to the audit log", !!plainAuditErr);

  expectEmptyRead("a normal user cannot read the audit log",
    await plain.client.from("admin_audit_log").select("id"));

  const { data: wiped } = await boss.client
    .from("admin_audit_log").delete().neq("action", "").select("id");
  check("nobody can delete audit entries", (wiped?.length ?? 0) === 0);

  // ── No regression: plain users are still isolated from each other ──
  expectEmptyRead("a normal user still cannot see the admin's rows",
    await plain.client.from("sessions").select("id").eq("user_id", boss.id));
} catch (err) {
  console.error(`\nERROR: ${err.message}`);
  failures++;
} finally {
  for (const id of [plain?.id, boss?.id].filter(Boolean)) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      console.error(`  WARN  could not delete test user ${id}: ${error.message}`);
      failures++;
    }
  }
  // Undo the library edit so the test leaves nothing behind.
  await admin.from("exercises").update({ note: null }).eq("id", "db_bench_press");
}

console.log(failures === 0 ? "\nAll admin checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
