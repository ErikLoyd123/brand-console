import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { drafts, ideaQueueItems, publishedPosts, scheduledPosts } from '../../db/schema';
import { getActiveProfileId } from '../../profile/loader';

const router = Router();

router.get('/', (_req, res) => {
  const pid = getActiveProfileId();
  const rows = db
    .select({
      draft: drafts,
      platform: ideaQueueItems.platform,
      tone: ideaQueueItems.tone,
      silo: ideaQueueItems.silo,
    })
    .from(drafts)
    .leftJoin(ideaQueueItems, eq(drafts.ideaId, ideaQueueItems.id))
    .where(eq(drafts.profileId, pid))
    .orderBy(desc(drafts.createdAt))
    .all();
  res.json(
    rows.map((r) => ({ ...r.draft, platform: r.platform, tone: r.tone, silo: r.silo })),
  );
});

router.get('/:id', (req, res) => {
  const row = db
    .select({
      draft: drafts,
      platform: ideaQueueItems.platform,
      tone: ideaQueueItems.tone,
      silo: ideaQueueItems.silo,
    })
    .from(drafts)
    .leftJoin(ideaQueueItems, eq(drafts.ideaId, ideaQueueItems.id))
    .where(eq(drafts.id, req.params.id))
    .get();
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({ ...row.draft, platform: row.platform, tone: row.tone, silo: row.silo });
});

router.post('/', (req, res) => {
  const { ideaId, hookOptions, body, close, mediaSuggestion } = req.body;
  const idea = db
    .select()
    .from(ideaQueueItems)
    .where(eq(ideaQueueItems.id, ideaId))
    .get();
  if (!idea) return res.status(404).json({ error: 'idea not found' });
  const inserted = db
    .insert(drafts)
    .values({
      ideaId,
      profileId: getActiveProfileId(),
      hookOptions: hookOptions ?? [],
      body: body ?? '',
      close: close ?? '',
      mediaSuggestion: mediaSuggestion ?? '',
    })
    .returning()
    .all();
  db.update(ideaQueueItems)
    .set({ status: 'drafted' })
    .where(eq(ideaQueueItems.id, ideaId))
    .run();
  res.status(201).json(inserted[0]);
});

router.post('/:id/review', (req, res) => {
  const { reviewStatus } = req.body;
  const updated = db
    .update(drafts)
    .set({ reviewStatus })
    .where(eq(drafts.id, req.params.id))
    .returning()
    .all();
  if (updated.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(updated[0]);
});

router.patch('/:id', (req, res) => {
  const { body, hookOptions, close, mediaSuggestion } = req.body;
  const set: Record<string, unknown> = {};
  if (body !== undefined) set.body = body;
  if (hookOptions !== undefined) set.hookOptions = hookOptions;
  if (close !== undefined) set.close = close;
  if (mediaSuggestion !== undefined) set.mediaSuggestion = mediaSuggestion;
  const updated = db
    .update(drafts)
    .set(set)
    .where(eq(drafts.id, req.params.id))
    .returning()
    .all();
  if (updated.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(updated[0]);
});

// DELETE /api/drafts/:id — remove a draft. A published draft is refused (409): the
// Published screen's archive rows reference it, and shipped history should not silently
// disappear. Any calendar plan for it is just a plan, so it goes with the draft. The
// idea the draft came from stays in the queue; when this was its only draft, its status
// flips back to `seeded` so it reads as draftable again rather than pointing at nothing.
router.delete('/:id', (req, res) => {
  const pid = getActiveProfileId();
  const draft = db
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, req.params.id), eq(drafts.profileId, pid)))
    .get();
  if (!draft) return res.status(404).json({ error: 'not found' });
  const published = db
    .select({ id: publishedPosts.id })
    .from(publishedPosts)
    .where(eq(publishedPosts.draftId, draft.id))
    .get();
  if (published) {
    return res
      .status(409)
      .json({ error: 'this draft was published — it is part of the Published archive' });
  }
  let ideaReseeded = false;
  db.transaction((tx) => {
    tx.delete(scheduledPosts).where(eq(scheduledPosts.draftId, draft.id)).run();
    tx.delete(drafts).where(eq(drafts.id, draft.id)).run();
    const remaining = tx
      .select({ id: drafts.id })
      .from(drafts)
      .where(eq(drafts.ideaId, draft.ideaId))
      .get();
    if (!remaining) {
      tx.update(ideaQueueItems)
        .set({ status: 'seeded' })
        .where(and(eq(ideaQueueItems.id, draft.ideaId), eq(ideaQueueItems.status, 'drafted')))
        .run();
      ideaReseeded = true;
    }
  });
  res.json({ ok: true, ideaReseeded });
});

router.post('/:id/publish', (req, res) => {
  const { permalink } = req.body;
  const draft = db.select().from(drafts).where(eq(drafts.id, req.params.id)).get();
  if (!draft) return res.status(404).json({ error: 'not found' });
  const inserted = db
    .insert(publishedPosts)
    .values({
      draftId: req.params.id,
      permalink: permalink ?? null,
    })
    .returning()
    .all();
  res.status(201).json(inserted[0]);
});

export default router;
