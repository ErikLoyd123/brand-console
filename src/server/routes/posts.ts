import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { publishedPosts, drafts, ideaQueueItems } from '../../db/schema';
import { getActiveProfileId } from '../../profile/loader';

const router = Router();

router.get('/', (_req, res) => {
  const pid = getActiveProfileId();

  // Scope through drafts: only posts whose draft belongs to the active profile.
  const draftIdeaById = new Map(
    db.select().from(drafts).where(eq(drafts.profileId, pid)).all().map((d) => [d.id, d.ideaId]),
  );
  const ideaPillarById = new Map(
    db
      .select()
      .from(ideaQueueItems)
      .where(eq(ideaQueueItems.profileId, pid))
      .all()
      .map((i) => [i.id, i.pillar]),
  );

  const posts = db
    .select()
    .from(publishedPosts)
    .orderBy(desc(publishedPosts.publishedAt))
    .all()
    .filter((p) => draftIdeaById.has(p.draftId));

  res.json(
    posts.map((p) => {
      const ideaId = draftIdeaById.get(p.draftId);
      const pillar = ideaId ? ideaPillarById.get(ideaId) ?? null : null;
      return { ...p, pillar };
    }),
  );
});

// PATCH /api/posts/:id — update a published post's permalink after the fact (the
// manual publish log). Returns the updated row.
router.patch('/:id', (req, res) => {
  const body = (req.body ?? {}) as {
    permalink?: unknown;
  };
  const set: Record<string, unknown> = {};

  if (body.permalink !== undefined) {
    const p = body.permalink;
    if (p !== null && (typeof p !== 'string' || p.trim() === '')) {
      return res
        .status(400)
        .json({ error: 'permalink must be a non-empty string or null' });
    }
    set.permalink = p;
  }

  if (Object.keys(set).length === 0) {
    return res.status(400).json({ error: 'no updatable fields provided' });
  }

  const updated = db
    .update(publishedPosts)
    .set(set)
    .where(eq(publishedPosts.id, req.params.id))
    .returning()
    .all();
  if (updated.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(updated[0]);
});

export default router;
