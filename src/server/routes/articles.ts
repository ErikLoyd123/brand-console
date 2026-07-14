// The long-form articles surface the console consumes: list (light), detail (full), patch (via
// the shared updateArticle writer), and export (via the shared exportArticle writer). Every
// route resolves the active profile via getActiveProfileId() and scopes its query by it, so a
// stale console tab can never read or write across profiles. Content edits through PATCH reset
// reviewStatus exactly as the drafts path does. Export does not publish.

import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { articles, drafts, ideaQueueItems } from '../../db/schema';
import { getActiveProfileId } from '../../profile/loader';
import { updateArticle } from '../../core/update-article';
import { exportArticle } from '../../core/export-article';

const router = Router();

// The Articles list: joins each article's idea for pillar/silo/platform/tone; omits section
// bodies (only a section count rides the wire).
router.get('/', (_req, res) => {
  const profileId = getActiveProfileId();
  const rows = db
    .select({
      article: articles,
      pillar: ideaQueueItems.pillar,
      silo: ideaQueueItems.silo,
      platform: ideaQueueItems.platform,
      tone: ideaQueueItems.tone,
    })
    .from(articles)
    .leftJoin(ideaQueueItems, eq(articles.ideaId, ideaQueueItems.id))
    .where(eq(articles.profileId, profileId))
    .orderBy(desc(articles.updatedAt))
    .all();
  res.json(
    rows.map((r) => {
      const { sections, ...rest } = r.article;
      return {
        ...rest,
        sectionCount: sections.length,
        pillar: r.pillar,
        silo: r.silo,
        platform: r.platform,
        tone: r.tone,
      };
    }),
  );
});

// One article in full, sections included — the detail editor's load.
router.get('/:id', (req, res) => {
  const profileId = getActiveProfileId();
  const row = db
    .select({
      article: articles,
      pillar: ideaQueueItems.pillar,
      silo: ideaQueueItems.silo,
      platform: ideaQueueItems.platform,
      tone: ideaQueueItems.tone,
    })
    .from(articles)
    .leftJoin(ideaQueueItems, eq(articles.ideaId, ideaQueueItems.id))
    .where(and(eq(articles.id, req.params.id), eq(articles.profileId, profileId)))
    .get();
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({
    ...row.article,
    pillar: row.pillar,
    silo: row.silo,
    platform: row.platform,
    tone: row.tone,
  });
});

// Save edits through the same shared writer the skill CLI uses.
router.patch('/:id', (req, res) => {
  const profileId = getActiveProfileId();
  const existing = db
    .select()
    .from(articles)
    .where(and(eq(articles.id, req.params.id), eq(articles.profileId, profileId)))
    .get();
  if (!existing) return res.status(404).json({ error: 'not found' });
  try {
    updateArticle(req.params.id, req.body ?? {});
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
  const updated = db.select().from(articles).where(eq(articles.id, req.params.id)).get();
  res.json(updated);
});

// DELETE /api/articles/:id — remove a long-form piece for good. The article row (sections
// and SEO fields ride on it) goes, and the queue idea it grew from goes with it unless a
// draft still references that idea (FK enforcement; a web idea normally has none). The raw
// spark capture, when there was one, stays in the sparks log — it is history, not pipeline
// state. Returns whether the idea went too, so the console can say exactly what happened.
router.delete('/:id', (req, res) => {
  const profileId = getActiveProfileId();
  const existing = db
    .select()
    .from(articles)
    .where(and(eq(articles.id, req.params.id), eq(articles.profileId, profileId)))
    .get();
  if (!existing) return res.status(404).json({ error: 'not found' });
  // Same published-guard as the queue/drafts deletes: an exported article IS the web
  // lane's Published record, so it must not silently disappear.
  if (existing.stage === 'exported') {
    return res
      .status(409)
      .json({ error: 'this piece was published (exported) — it is part of the Published archive' });
  }
  db.delete(articles).where(eq(articles.id, req.params.id)).run();
  const dependentDrafts = db
    .select({ id: drafts.id })
    .from(drafts)
    .where(eq(drafts.ideaId, existing.ideaId))
    .all();
  let ideaDeleted = false;
  if (dependentDrafts.length === 0) {
    db.delete(ideaQueueItems).where(eq(ideaQueueItems.id, existing.ideaId)).run();
    ideaDeleted = true;
  }
  res.json({ ok: true, ideaDeleted });
});

// Export to markdown through the shared writer; returns the written path.
router.post('/:id/export', (req, res) => {
  const profileId = getActiveProfileId();
  const existing = db
    .select()
    .from(articles)
    .where(and(eq(articles.id, req.params.id), eq(articles.profileId, profileId)))
    .get();
  if (!existing) return res.status(404).json({ error: 'not found' });
  const result = exportArticle(req.params.id);
  if (!result.ok) {
    if (result.error === 'no-slug') {
      return res.status(400).json({ error: 'article has no slug yet' });
    }
    return res.status(404).json({ error: 'not found' });
  }
  const updated = db.select().from(articles).where(eq(articles.id, req.params.id)).get();
  res.json({ ...updated, exportPath: result.path });
});

export default router;
