import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { publishedPosts, drafts, ideaQueueItems, articles } from '../../db/schema';
import { getActiveProfileId } from '../../profile/loader';

const router = Router();

// Everything shipped, across every lane: post-lane publishes (published_posts rows —
// LinkedIn/Reddit) unioned with web-lane exports (articles at stage 'exported'; the
// exported file IS the web lane's shipped artifact). Each row carries a platform so the
// Published screen can slice by lane; web rows carry the article title and export path.
router.get('/', (_req, res) => {
  const pid = getActiveProfileId();

  // Scope through drafts: only posts whose draft belongs to the active profile.
  const draftIdeaById = new Map(
    db.select().from(drafts).where(eq(drafts.profileId, pid)).all().map((d) => [d.id, d.ideaId]),
  );
  const ideaById = new Map(
    db
      .select()
      .from(ideaQueueItems)
      .where(eq(ideaQueueItems.profileId, pid))
      .all()
      .map((i) => [i.id, i]),
  );

  const posts = db
    .select()
    .from(publishedPosts)
    .orderBy(desc(publishedPosts.publishedAt))
    .all()
    .filter((p) => draftIdeaById.has(p.draftId));

  const postRows = posts.map((p) => {
    const ideaId = draftIdeaById.get(p.draftId);
    const idea = ideaId ? ideaById.get(ideaId) : undefined;
    return {
      ...p,
      pillar: idea?.pillar ?? null,
      // The idea's platform wins over the row's (older rows default to linkedin).
      platform: idea?.platform ?? p.platform ?? 'linkedin',
      title: null as string | null,
      exportPath: null as string | null,
    };
  });

  const webRows = db
    .select()
    .from(articles)
    .where(and(eq(articles.profileId, pid), eq(articles.stage, 'exported')))
    .all()
    .map((a) => {
      const idea = ideaById.get(a.ideaId);
      return {
        id: a.id,
        draftId: null as string | null,
        permalink: null as string | null,
        publishedAt: a.exportedAt ?? a.updatedAt,
        platform: 'web',
        destination: null as string | null,
        platformPostId: null as string | null,
        linkedinUrn: null as string | null,
        pillar: idea?.pillar ?? null,
        title: a.title as string | null,
        exportPath: a.exportPath,
      };
    });

  res.json([...postRows, ...webRows].sort((x, y) => y.publishedAt - x.publishedAt));
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
