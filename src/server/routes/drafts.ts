import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { drafts, ideaQueueItems, publishedPosts } from '../../db/schema';
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
