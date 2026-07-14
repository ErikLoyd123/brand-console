// src/profile/write-pillars.ts
// CLI the `pillars` skill invokes to persist the pillar list to
// the active profile's identity.yaml — the pillar analogue of write-register.ts. Pillars are a
// whole-list write (like the console's pillar editor): the skill reads the current
// pillars, applies its change, and hands the complete new list back here as JSON.
//
//   npx tsx src/profile/write-pillars.ts '[{"key":"brewing","label":"Brewing","weight":40}, ...]'
//   cat pillars.json | npx tsx src/profile/write-pillars.ts
//
// writePillars validates the list (at least one pillar, unique keys, a label and a
// numeric weight >= 0 each) and writes it through the comment-preserving identity
// writer. A ValidationError exits non-zero with the message on stderr so the skill can
// surface it verbatim; anything else re-throws.

import { readFileSync } from 'node:fs';
import { writePillars, ValidationError, type PillarInput } from './write-identity';

function readJson(): string {
  const arg = process.argv[2];
  if (arg && arg.trim() !== '') return arg;
  // Fall back to stdin (fd 0) so a large list need not be shell-escaped.
  return readFileSync(0, 'utf8');
}

let input: PillarInput[];
try {
  input = JSON.parse(readJson()) as PillarInput[];
} catch {
  console.error('write-pillars: expected the full pillar list as a JSON array.');
  process.exit(1);
}

try {
  const pillars = writePillars(input);
  console.log(
    `Saved ${pillars.length} pillar${pillars.length === 1 ? '' : 's'}: ` +
      pillars.map((p) => `${p.key}=${p.weight}`).join(', ') + '.',
  );
  console.log(JSON.stringify({ ok: true, pillars }, null, 2));
} catch (e) {
  if (e instanceof ValidationError) {
    console.error(`ValidationError: ${e.message}`);
    process.exit(1);
  }
  throw e;
}
