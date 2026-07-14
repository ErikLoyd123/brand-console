import { Router } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { articles, drafts, ideaQueueItems, publishedPosts, scheduledPosts } from '../../db/schema';
import { getActiveProfileId } from '../../profile/loader';

const router = Router();

router.get('/', (req, res) => {
  const pid = getActiveProfileId();
  const status = req.query.status as string | undefined;
  const where = status
    ? and(eq(ideaQueueItems.profileId, pid), eq(ideaQueueItems.status, status))
    : eq(ideaQueueItems.profileId, pid);
  const rows = db
    .select()
    .from(ideaQueueItems)
    .where(where)
    .orderBy(desc(ideaQueueItems.score))
    .all();
  res.json(rows);
});

router.post('/:id/seed', (req, res) => {
  const { seed } = req.body;
  const updated = db
    .update(ideaQueueItems)
    .set({ seed, status: 'seeded' })
    .where(eq(ideaQueueItems.id, req.params.id))
    .returning()
    .all();
  if (updated.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(updated[0]);
});

// Set the developed points on a queue item — the 2-4 beats that raise it above a bare
// angle. Written by the console's hand editor and by the `develop` skill's HTTP path.
// Body: { points: string[] }. Blank entries are dropped; an empty array is valid (clears).
router.post('/:id/points', (req, res) => {
  const points = Array.isArray(req.body?.points)
    ? req.body.points.map((p: unknown) => String(p).trim()).filter((p: string) => p !== '')
    : [];
  const updated = db
    .update(ideaQueueItems)
    .set({ points })
    .where(eq(ideaQueueItems.id, req.params.id))
    .returning()
    .all();
  if (updated.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(updated[0]);
});

// DELETE /api/queue/:id — remove an idea and everything downstream of it: its drafts
// (and their calendar plans) and, for a web idea, its article row. Refused (409) when any
// of its drafts was published — shipped history lives on the Published screen and should
// not silently disappear; the raw spark capture, when there was one, stays in the sparks
// log either way. Returns what went with it so the console can say exactly what happened.
router.delete('/:id', (req, res) => {
  const pid = getActiveProfileId();
  const idea = db
    .select()
    .from(ideaQueueItems)
    .where(and(eq(ideaQueueItems.id, req.params.id), eq(ideaQueueItems.profileId, pid)))
    .get();
  if (!idea) return res.status(404).json({ error: 'not found' });

  const draftIds = db
    .select({ id: drafts.id })
    .from(drafts)
    .where(eq(drafts.ideaId, idea.id))
    .all()
    .map((r) => r.id);
  if (draftIds.length > 0) {
    const published = db
      .select({ id: publishedPosts.id })
      .from(publishedPosts)
      .where(inArray(publishedPosts.draftId, draftIds))
      .get();
    if (published) {
      return res
        .status(409)
        .json({ error: 'a draft of this idea was published — it is part of the Published archive' });
    }
  }

  let articleDeleted = false;
  db.transaction((tx) => {
    if (draftIds.length > 0) {
      tx.delete(scheduledPosts).where(inArray(scheduledPosts.draftId, draftIds)).run();
      tx.delete(drafts).where(inArray(drafts.id, draftIds)).run();
    }
    const article = tx
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.ideaId, idea.id))
      .get();
    if (article) {
      tx.delete(articles).where(eq(articles.id, article.id)).run();
      articleDeleted = true;
    }
    tx.delete(ideaQueueItems).where(eq(ideaQueueItems.id, idea.id)).run();
  });
  res.json({ ok: true, draftsDeleted: draftIds.length, articleDeleted });
});

export default router;
