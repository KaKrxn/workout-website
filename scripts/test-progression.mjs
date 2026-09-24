import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/progression.ts", import.meta.url), "utf8")
  .replace(
    'import { MAX_DUMBBELL_KG, WEIGHT_INCREMENT_KG } from "@/lib/program-seed";\n',
    "const MAX_DUMBBELL_KG = 25;\nconst WEIGHT_INCREMENT_KG = 2.5;\n",
  )
  .replace(
    'import { DUMBBELL_MAX_KG, WEIGHT_INCREMENT_KG } from "@/lib/program-seed";\n',
    "const DUMBBELL_MAX_KG = 25;\nconst WEIGHT_INCREMENT_KG = 2.5;\n",
  )
  .replace('import type { ExerciseKind } from "@/lib/program-seed";\n', "");

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const commonJsModule = { exports: {} };
vm.runInNewContext(
  compiled,
  { module: commonJsModule, exports: commonJsModule.exports },
  { filename: "progression.cjs" },
);

const { computeProgressionTarget, roundToIncrement } = commonJsModule.exports;

assert.equal(roundToIncrement(11.1, 2.5), 10);
assert.equal(roundToIncrement(11.4, 2.5), 12.5);

assert.deepEqual(
  computeProgressionTarget({
    kind: "strength",
    previousSets: [
      { setIndex: 1, side: null, reps: 11, weightKg: 10, durationS: null },
      { setIndex: 2, side: null, reps: 10, weightKg: 10, durationS: null },
      { setIndex: 3, side: null, reps: 9, weightKg: 10, durationS: null },
      { setIndex: 4, side: null, reps: 8, weightKg: 10, durationS: null },
    ],
    repMin: 6,
    repMax: 12,
    durationMinS: null,
    durationMaxS: null,
  }).targetReps,
  [12, 11, 10, 9],
);

const addWeight = computeProgressionTarget({
  kind: "strength",
  previousSets: [
    { setIndex: 1, side: null, reps: 12, weightKg: 10, durationS: null },
    { setIndex: 2, side: null, reps: 12, weightKg: 10, durationS: null },
    { setIndex: 3, side: null, reps: 12, weightKg: 10, durationS: null },
    { setIndex: 4, side: null, reps: 12, weightKg: 10, durationS: null },
  ],
  repMin: 6,
  repMax: 12,
  durationMinS: null,
  durationMaxS: null,
});
assert.equal(addWeight.kind, "add_weight");
assert.equal(addWeight.targetWeightKg, 12.5);

const ceiling = computeProgressionTarget({
  kind: "strength",
  previousSets: [
    { setIndex: 1, side: null, reps: 12, weightKg: 25, durationS: null },
    { setIndex: 2, side: null, reps: 12, weightKg: 25, durationS: null },
  ],
  repMin: 6,
  repMax: 12,
  durationMinS: null,
  durationMaxS: null,
});
assert.equal(ceiling.kind, "ceiling");
assert.equal(ceiling.targetWeightKg, 25);

const duration = computeProgressionTarget({
  kind: "duration",
  previousSets: [
    { setIndex: 1, side: null, reps: null, weightKg: null, durationS: 30 },
    { setIndex: 2, side: null, reps: null, weightKg: null, durationS: 40 },
  ],
  repMin: null,
  repMax: null,
  durationMinS: 30,
  durationMaxS: 45,
});
assert.deepEqual(duration.targetDurationS, [35, 45]);

console.log("progression tests passed");
