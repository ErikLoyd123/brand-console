// src/ingest/promote-item.ts
// CLI the `discovery` skill invokes to promote a Discovery feed item straight into a
// developed queue idea — creating the seeded idea_queue_items row (with the owner's take,
// intent, and beats) and flipping the feed item to 'promoted'. The discovery-side analogue
// of develop-idea.ts; both write only what the owner drew out. The actual write is the
// shared promoteFeedItem (src/core/promote.ts), the same one POST /discovery/:id/promote
// uses, so the AI and manual promote paths cannot drift.
//
//   npx tsx src/ingest/promote-item.ts <feedItemId> '{"seed":"...","silo":"teach","points":["beat 1","beat 2"]}'
//   cat payload.json | npx tsx src/ingest/promote-item.ts <feedItemId>
//
// Only `seed` is really needed; `silo` defaults to 'teach' and `points` may be omitted.
// A feed item that is already promoted, or an unknown id, exits non-zero with the reason
// on stderr so the skill can surface it verbatim rather than double-promote.

import { readFileSync } from 'node:fs';
import { promoteFeedItem, type PromoteInput } from '../core/promote';

const feedItemId = process.argv[2];
if (!feedItemId || feedItemId.trim() === '') {
  console.error('promote-item: expected a feed-item id as the first argument.');
  process.exit(1);
}

function readJson(): string {
  const arg = process.argv[3];
  if (arg && arg.trim() !== '') return arg;
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '{}';
  }
}

let input: PromoteInput;
try {
  const raw = readJson().trim();
  input = raw === '' ? {} : (JSON.parse(raw) as PromoteInput);
} catch {
  console.error('promote-item: expected a JSON payload with optional "seed", "silo", and "points".');
  process.exit(1);
}

const result = promoteFeedItem(feedItemId, input);
if (!result.ok) {
  if (result.error === 'not-found') {
    console.error(`promote-item: no feed item with id ${feedItemId}.`);
  } else {
    console.error(
      `promote-item: feed item ${feedItemId} is already promoted (idea ${result.promotedIdeaId}).`,
    );
  }
  process.exit(1);
}

const beats = Array.isArray(input.points)
  ? input.points.map((p) => String(p).trim()).filter((p) => p !== '').length
  : 0;
// Report the created idea id in a form the console's result-linker can parse (it prefers
// an id labeled "idea" wrapped in backticks): promoted feed item → idea `<ideaId>`.
console.log(
  `Promoted feed item ${feedItemId} to idea \`${result.ideaId}\`` +
    `${beats > 0 ? ` with ${beats} point${beats === 1 ? '' : 's'}` : ''}.`,
);
