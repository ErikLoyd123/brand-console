// src/review/voice-checks.verify.ts
// Runs the mechanical voice checks over the fixtures and exits non-zero when an expected
// finding is missing, an expected match is absent, or a forbidden rule fired. The repo has
// no test runner; this is the check the plan's validation step runs.
//   npx tsx src/review/voice-checks.verify.ts
import { runVoiceChecks } from "./voice-checks";
import { FIXTURES } from "./voice-checks.fixtures";

let failures = 0;
for (const f of FIXTURES) {
  const findings = runVoiceChecks(f.body, {
    isProductAdjacent: false,
    silo: f.silo,
    seed: f.seed,
    points: f.points,
    close: f.close,
    length: f.length,
    products: ["RoastLog"],
    protectedRelationships: [],
  });
  const byRule = new Map(findings.map((x) => [x.rule, x]));
  for (const exp of f.expect) {
    const hit = byRule.get(exp.rule);
    if (!hit) {
      failures++;
      console.error(`FAIL ${f.name}: expected ${exp.rule} to fire`);
      continue;
    }
    for (const m of exp.matches) {
      if (!hit.matches.some((x) => x.toLowerCase().includes(m.toLowerCase()))) {
        failures++;
        console.error(`FAIL ${f.name}: ${exp.rule} missing match "${m}" (got ${JSON.stringify(hit.matches)})`);
      }
    }
  }
  for (const rule of f.forbid) {
    if (byRule.has(rule)) {
      failures++;
      console.error(`FAIL ${f.name}: ${rule} fired unexpectedly (${JSON.stringify(byRule.get(rule)?.matches)})`);
    }
  }
  console.log(`${failures === 0 ? "ok " : "-- "}${f.name}: ${findings.map((x) => x.rule).join(", ") || "clean"}`);
}
if (failures > 0) {
  console.error(`${failures} failure(s).`);
  process.exit(1);
}
console.log("All fixtures pass.");
