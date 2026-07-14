// src/core/promote.ts
// The single source of truth for promoting a Discovery feed item into a queue idea:
// create the seeded idea_queue_items row (carrying the owner's take, intent, and beats)
// and flip the feed item to 'promoted'. Both the HTTP route (POST /discovery/:id/promote)
// and the `discovery` skill's CLI (src/ingest/promote-item.ts) call this, so the manual and
// AI promote paths can never drift apart. Idempotent at the data layer: a feed item that
// already carries a promotedIdeaId is never re-promoted.

import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { feedItems, ideaQueueItems, sources } from '../db/schema';
import { getActiveProfileId } from '../profile/loader';

export interface PromoteInput {
  /** The owner's one-to-two-sentence take, stored as the idea's seed. */
  seed?: string;
  /** The post's intent; validated against the roster upstream. Defaults to 'teach'. */
  silo?: string;
  /** Developed beats (from `discovery`); a bare promote omits them. */
  points?: string[];
}

export type PromoteResult =
  | { ok: true; ideaId: string }
  | { ok: false; error: 'not-found' }
  | { ok: false; error: 'already-promoted'; promotedIdeaId: string };

export function promoteFeedItem(feedItemId: string, input: PromoteInput = {}): PromoteResult {
  const found = db.select().from(feedItems).where(eq(feedItems.id, feedItemId)).all();
  if (found.length === 0) return { ok: false, error: 'not-found' };
  const item = found[0];
  if (item.promotedIdeaId) {
    return { ok: false, error: 'already-promoted', promotedIdeaId: item.promotedIdeaId };
  }

  const src = db.select().from(sources).where(eq(sources.id, item.sourceId)).all();
  const pillar = src.length > 0 && src[0].pillar ? src[0].pillar : 'general';
  // Feed origin defaults to 'teach'; a pure signal-boost is 'curate' and a celebration
  // is 'win', both passed explicitly by the caller. See design 01-silo-model.
  const silo = typeof input.silo === 'string' && input.silo.trim() !== '' ? input.silo.trim() : 'teach';
  const points = Array.isArray(input.points)
    ? input.points.map((p) => String(p).trim()).filter((p) => p !== '')
    : [];

  const inserted = db
    .insert(ideaQueueItems)
    .values({
      profileId: getActiveProfileId(),
      pillar,
      silo,
      tag: 'ready-to-draft',
      status: 'seeded',
      seed: input.seed ?? '',
      points,
      sourceRef: item.url ?? null,
      proposedAngle: item.title,
      score: item.score ?? 0,
    })
    .returning()
    .all();
  const idea = inserted[0];

  db.update(feedItems)
    .set({ triageState: 'promoted', promotedIdeaId: idea.id })
    .where(eq(feedItems.id, item.id))
    .run();

  return { ok: true, ideaId: idea.id };
}
