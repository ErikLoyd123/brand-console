// src/draft/revise-context.ts
// Everything the revise procedure needs, in one call, so a revision does not spend its
// first minute on five separate lookups. Given a queue-item id OR a draft id it prints one
// JSON document: the newest draft for the idea (the row the queue card shows), the idea
// (take, points, silo, length, register), the resolved register guidance, the identity
// bits the voice checks need, and the active profile's voice card. The newest draft is
// resolved here, never by the skill, so a revision can never land on an older row.
//
//   npx tsx src/draft/revise-context.ts <ideaId | draftId>
//
// Exits non-zero with the reason on stderr when nothing matches, when the idea has no
// draft yet (that is a write, not a revise), or when the profile has no voice card.

import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { drafts, ideaQueueItems } from '../db/schema';
import { loadIdentity, tryReadVoiceCard } from '../profile/loader';
import { resolveRegisterFromProfile } from '../core/resolve-register';
import { getDefaultLength } from '../core/lengths';
import type { Silo } from '../core/silos';

const id = process.argv[2];
if (!id || id.trim() === '') {
  console.error('usage: tsx src/draft/revise-context.ts <ideaId | draftId>');
  process.exit(1);
}

// Accept either id: a draft id resolves to its idea, then the idea's newest draft wins.
const byDraft = db.select().from(drafts).where(eq(drafts.id, id)).get();
const ideaId = byDraft ? byDraft.ideaId : id;
const idea = db.select().from(ideaQueueItems).where(eq(ideaQueueItems.id, ideaId)).get();
if (!idea) {
  console.error(`revise-context: no queue item or draft with id ${id}`);
  process.exit(1);
}
const all = db
  .select()
  .from(drafts)
  .where(eq(drafts.ideaId, idea.id))
  .orderBy(desc(drafts.createdAt))
  .all();
const draft = all[0];
if (!draft) {
  console.error(`revise-context: idea ${idea.id} has no draft yet; write one first (draft procedure).`);
  process.exit(1);
}
const voiceCard = tryReadVoiceCard();
if (voiceCard.trim() === '') {
  console.error('revise-context: the active profile has no voice card; run setup first.');
  process.exit(1);
}
const identity = loadIdentity();
const register = resolveRegisterFromProfile(idea.platform ?? null, idea.tone ?? null);

console.log(
  JSON.stringify(
    {
      draft: {
        id: draft.id,
        hookOptions: draft.hookOptions,
        body: draft.body,
        close: draft.close,
        mediaSuggestion: draft.mediaSuggestion,
        reviewStatus: draft.reviewStatus,
        // Older rows for the same idea, if any. The newest is the one on the card; the
        // save-once rule keeps this at zero for new runs.
        olderDrafts: all.length - 1,
      },
      idea: {
        id: idea.id,
        pillar: idea.pillar,
        silo: idea.silo,
        length: idea.length ?? getDefaultLength(idea.silo as Silo),
        lengthIsDefault: idea.length === null,
        platform: idea.platform,
        tone: idea.tone,
        proposedAngle: idea.proposedAngle,
        seed: idea.seed,
        points: idea.points,
      },
      register,
      identity: {
        products: identity.products,
        protected_relationships: identity.protected_relationships,
      },
      voiceCard,
    },
    null,
    2,
  ),
);
