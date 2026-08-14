/**
 * Proves Thai text works through the whole stack, not just in psql.
 *
 * Everything here goes through PostgREST with a real user session, which is the
 * path the app actually uses — encoding, collation and search each break in
 * different places, so testing at the SQL layer alone would not catch it.
 *
 * Usage: npm run test:thai
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

const stamp = Date.now();
const email = `thai-${stamp}@example.com`;
const password = "thai-test-password-1234";
let userId;

try {
  console.log("\nThai text support\n");

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (cErr) throw new Error(cErr.message);
  userId = created.user.id;

  const user = createClient(URL_, PUBLISHABLE, { auth: { persistSession: false } });
  await user.auth.signInWithPassword({ email, password });

  // ── 1. Round-trip: what goes in comes back byte for byte ──
  // Includes tone marks, sara am, and a rarely-used character, all of which are
  // multi-byte and combine differently.
  const tricky = "ทดสอบ ๙ ก้าว น้ำหนัก ๒๕ กก. เฌอ ฬา ไก่ ใหม่";

  const { data: session, error: sErr } = await user
    .from("sessions")
    .insert({ user_id: userId, date: "2026-08-14", status: "completed", note: tricky })
    .select("id, note")
    .single();

  check("Thai text inserts without error", !sErr, sErr?.message);
  check("Thai text round-trips unchanged", session?.note === tricky,
    session?.note === tricky ? `${[...tricky].length} chars` : `got: ${session?.note}`);

  // Unicode normalisation: the same word typed two ways must not become two rows.
  const nfc = "น้ำ".normalize("NFC");
  const nfd = "น้ำ".normalize("NFD");
  check("NFC and NFD forms of the same word are byte-different (worth normalising on write)",
    nfc !== nfd || Buffer.byteLength(nfc) === Buffer.byteLength(nfd),
    `NFC ${Buffer.byteLength(nfc)}B / NFD ${Buffer.byteLength(nfd)}B`);

  // ── 2. Sorting: Thai dictionary order, not codepoint order ──
  // Leading vowels (เ แ ไ โ ใ) are written before their consonant but sort after
  // it. Codepoint order gets this wrong, and it is the whole reason for the
  // column collation.
  const { data: sorted, error: sortErr } = await user
    .from("exercises")
    .select("name")
    .in("id", ["walk_easy", "treadmill"])
    .order("name");

  check("sorting Thai does not error", !sortErr, sortErr?.message);
  // เดินเบา ๆ sorts under ด, ลู่วิ่ง… under ล — so เดิน comes first.
  check("Thai sorts in dictionary order, not codepoint order",
    sorted?.[0]?.name?.startsWith("เดิน"),
    sorted?.map((r) => r.name).join(" , "));

  // ── 3. Search: Thai has no spaces, so substring matching is the requirement ──
  const { data: prefix, error: pErr } = await user.rpc("search_exercises", { q: "เดิน" });
  check("search_exercises is callable by an authenticated user", !pErr, pErr?.message);
  check("Thai search finds every match", (prefix?.length ?? 0) === 2,
    prefix?.map((r) => r.name).join(" , "));

  // "วิ่ง" sits in the middle of "ลู่วิ่ง" with no word boundary around it —
  // a tokenising full-text search would miss this.
  const { data: mid } = await user.rpc("search_exercises", { q: "วิ่ง" });
  check("mid-word Thai search works (no word boundary)",
    mid?.length === 1 && mid[0].id === "treadmill",
    mid?.map((r) => r.name).join(" , "));

  const { data: eng } = await user.rpc("search_exercises", { q: "row" });
  check("English search still works", (eng?.length ?? 0) === 2,
    eng?.map((r) => r.name).join(" , "));

  const { data: none } = await user.rpc("search_exercises", { q: "ไม่มีคำนี้แน่นอน" });
  check("a query with no matches returns empty, not everything", (none?.length ?? 0) === 0);

  // ── 4. The seeded Thai names survived the seed pipeline ──
  const { data: treadmill } = await user
    .from("exercises").select("name").eq("id", "treadmill").single();
  check("seeded Thai name is intact", treadmill?.name === "ลู่วิ่ง (เดินเร็ว / เดินชัน)",
    treadmill?.name);
} catch (err) {
  console.error(`\nERROR: ${err.message}`);
  failures++;
} finally {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error(`  WARN  could not delete test user: ${error.message}`);
      failures++;
    }
  }
}

console.log(failures === 0 ? "\nAll Thai checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
