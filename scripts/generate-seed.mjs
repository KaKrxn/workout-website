/**
 * Generates supabase/seed.sql from Report/data/program-seed.json.
 *
 * Only the stock exercise library is global and therefore seeded here.
 * Plans, plan days, plan items, equipment and settings are per-user and are
 * created by provisionUser() at signup — see Report/02-data-model.md §8.
 *
 * Usage: npm run seed:generate
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seedPath = join(root, "Report", "data", "program-seed.json");
const outPath = join(root, "supabase", "seed.sql");

/** Quote a value as a SQL string literal, or NULL. */
const sqlStr = (v) =>
  v === undefined || v === null || v === "" ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;

/** Quote a list of strings as a text[] literal. */
const sqlTextArray = (arr) =>
  !arr || arr.length === 0
    ? "'{}'::text[]"
    : `ARRAY[${arr.map((v) => sqlStr(v)).join(", ")}]::text[]`;

const sqlNum = (v) => (v === undefined || v === null ? "NULL" : String(v));
const sqlBool = (v) => (v ? "TRUE" : "FALSE");

const seed = JSON.parse(readFileSync(seedPath, "utf8"));

const MUSCLES = new Set([
  "back_lat", "shoulders", "chest", "legs", "arms", "core", "glutes", "cardio", "neck",
]);
const KINDS = new Set(["strength", "bodyweight", "cardio", "duration"]);

const rows = seed.exercises.map((e) => {
  if (!KINDS.has(e.kind)) throw new Error(`${e.id}: unknown kind "${e.kind}"`);
  if (!MUSCLES.has(e.muscle)) throw new Error(`${e.id}: unknown muscle "${e.muscle}"`);

  // `holdS` has no column in the schema; fold it into the note so the information survives.
  let note = e.note ?? null;
  if (e.holdS) {
    const hold = `ค้าง ${e.holdS[0]}–${e.holdS[1]} วินาทีต่อครั้ง`;
    note = note ? `${note} · ${hold}` : hold;
  }

  return [
    sqlStr(e.id),
    "NULL", // owner_id — stock exercise
    sqlStr(e.name),
    sqlStr(e.kind),
    sqlStr(e.muscle),
    sqlTextArray(e.secondary),
    sqlTextArray(e.equipment),
    sqlNum(e.repRange?.[0]),
    sqlNum(e.repRange?.[1]),
    sqlNum(e.durationRangeS?.[0]),
    sqlNum(e.durationRangeS?.[1]),
    sqlBool(e.perSide),
    sqlBool(e.isKeyLift),
    sqlStr(note),
    "TRUE", // is_public
  ];
});

const header = `-- GENERATED FILE — do not edit by hand.
-- Run \`npm run seed:generate\` to regenerate from Report/data/program-seed.json.
--
-- Contains the ${rows.length} stock exercises only. Everything else is per-user and
-- is created by provisionUser() at signup (Report/02-data-model.md §8).
-- Safe to run more than once.
`;

const body = `
insert into exercises (
  id, owner_id, name, kind, muscle, secondary, equipment,
  rep_min, rep_max, duration_min_s, duration_max_s,
  per_side, is_key_lift, note, is_public
) values
${rows.map((r) => `  (${r.join(", ")})`).join(",\n")}
on conflict (id) do update set
  name           = excluded.name,
  kind           = excluded.kind,
  muscle         = excluded.muscle,
  secondary      = excluded.secondary,
  equipment      = excluded.equipment,
  rep_min        = excluded.rep_min,
  rep_max        = excluded.rep_max,
  duration_min_s = excluded.duration_min_s,
  duration_max_s = excluded.duration_max_s,
  per_side       = excluded.per_side,
  is_key_lift    = excluded.is_key_lift,
  note           = excluded.note,
  is_public      = excluded.is_public
where exercises.owner_id is null;
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, header + body, "utf8");

const keyLifts = seed.exercises.filter((e) => e.isKeyLift).length;
console.log(`Wrote ${outPath}`);
console.log(`  ${rows.length} exercises, ${keyLifts} key lifts`);
