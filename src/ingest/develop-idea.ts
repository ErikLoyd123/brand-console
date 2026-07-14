// src/ingest/develop-idea.ts
// CLI the `develop` skill invokes to raise a queue item above a bare angle — writing the
// owner's developed take (seed) and/or the beats of the argument (points) onto an existing
// idea_queue_items row. The queue-side analogue of write-register.ts / write-pillars.ts.
//
//   npx tsx src/ingest/develop-idea.ts <ideaId> '{"seed":"...","points":["beat 1","beat 2"]}'
//   cat patch.json | npx tsx src/ingest/develop-idea.ts <ideaId>
//
// Only the fields present in the JSON are touched (a points-only or seed-only develop is
// valid). Blank point entries are dropped. Writing a seed advances status to 'seeded' so the
// item reads as handled, matching the console's seed path. An unknown id exits non-zero with
// the message on stderr so the skill can surface it verbatim.

import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { ideaQueueItems } from '../db/schema';

type Patch = { seed?: string; points?: string[] };

const ideaId = process.argv[2];
if (!ideaId || ideaId.trim() === '') {
  console.error('develop-idea: expected an idea id as the first argument.');
  process.exit(1);
}

function readJson(): string {
  const arg = process.argv[3];
  if (arg && arg.trim() !== '') return arg;
  return readFileSync(0, 'utf8');
}

let patch: Patch;
try {
  patch = JSON.parse(readJson()) as Patch;
} catch {
  console.error('develop-idea: expected a JSON patch with optional "seed" and "points".');
  process.exit(1);
}

const existing = db.select().from(ideaQueueItems).where(eq(ideaQueueItems.id, ideaId)).get();
if (!existing) {
  console.error(`develop-idea: no idea-queue item with id ${ideaId}.`);
  process.exit(1);
}

const set: Partial<typeof ideaQueueItems.$inferInsert> = {};
if (typeof patch.seed === 'string' && patch.seed.trim() !== '') {
  set.seed = patch.seed.trim();
  set.status = 'seeded';
}
if (Array.isArray(patch.points)) {
  set.points = patch.points.map((p) => String(p).trim()).filter((p) => p !== '');
}
if (Object.keys(set).length === 0) {
  console.error('develop-idea: nothing to write — provide "seed" and/or "points".');
  process.exit(1);
}

const updated = db
  .update(ideaQueueItems)
  .set(set)
  .where(eq(ideaQueueItems.id, ideaId))
  .returning()
  .get();

console.log(
  `Developed idea ${ideaId}: ${updated?.points.length ?? 0} point${updated?.points.length === 1 ? '' : 's'}` +
    `${set.seed ? ', take set' : ''}.`,
);
