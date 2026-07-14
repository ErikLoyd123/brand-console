import { Router } from 'express';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { articles, drafts, ideaQueueItems, publishedPosts, scheduledPosts } from '../../db/schema';
import { getActiveProfileId } from '../../profile/loader';
import { exportArticle } from '../../core/export-article';

const router = Router();

// The queue is the review phase: each idea rides with its written content — the latest
// draft for a post idea, the article (single markdown body + SEO fields) for a web idea —
// so the workbench can show, edit, and publish the full piece from one card.
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

  const ideaIds = rows.map((r) => r.id);
  const draftsByIdea = new Map<string, (typeof drafts.$inferSelect)[]>();
  const articleByIdea = new Map<string, typeof articles.$inferSelect>();
  if (ideaIds.length > 0) {
    for (const d of db
      .select()
      .from(drafts)
      .where(inArray(drafts.ideaId, ideaIds))
      .orderBy(desc(drafts.createdAt))
      .all()) {
      const list = draftsByIdea.get(d.ideaId) ?? [];
      list.push(d);
      draftsByIdea.set(d.ideaId, list);
    }
    for (const a of db.select().from(articles).where(inArray(articles.ideaId, ideaIds)).all()) {
      articleByIdea.set(a.ideaId, a);
    }
  }

  res.json(
    rows.map((idea) => {
      const ideaDrafts = draftsByIdea.get(idea.id) ?? [];
      const article = articleByIdea.get(idea.id);
      return {
        ...idea,
        // Latest draft first; the workbench edits draft[0].
        draft: ideaDrafts[0] ?? null,
        article: article
          ? {
              id: article.id,
              title: article.title,
              slug: article.slug,
              targetKeyword: article.targetKeyword,
              searchIntent: article.searchIntent,
              metaDescription: article.metaDescription,
              lengthTarget: article.lengthTarget,
              body:
                article.body.trim() !== ''
                  ? article.body
                  : // Legacy structured rows: flatten so the workbench always sees one document.
                    article.sections
                      .map((s) => `## ${s.heading}\n\n${s.body}`.trim())
                      .join('\n\n'),
              stage: article.stage,
              reviewStatus: article.reviewStatus,
              exportPath: article.exportPath,
            }
          : null,
      };
    }),
  );
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

// POST /api/queue/:id/publish — the queue's approve action: the idea's content is good to
// go, ship it and move the idea to Published. Per platform: `web` exports the markdown file
// (export IS publish for the long-form lane — the file is the shipped artifact); `reddit`
// and manually-posted LinkedIn record a published_posts row (with the pasted permalink when
// given). API-backed LinkedIn publishing stays on its own type-PUBLISH-gated route
// (/api/publish/linkedin), which flips the idea the same way after a real post. Either
// path sets the idea's status to 'published', which removes it from the queue view.
router.post('/:id/publish', (req, res) => {
  const pid = getActiveProfileId();
  const idea = db
    .select()
    .from(ideaQueueItems)
    .where(and(eq(ideaQueueItems.id, req.params.id), eq(ideaQueueItems.profileId, pid)))
    .get();
  if (!idea) return res.status(404).json({ error: 'not found' });

  if (idea.platform === 'web') {
    const article = db.select().from(articles).where(eq(articles.ideaId, idea.id)).get();
    if (!article) return res.status(409).json({ error: 'no article for this idea yet' });
    if (article.slug === null || article.slug.trim() === '') {
      return res.status(409).json({ error: 'article has no slug yet — set one before publishing' });
    }
    if (article.body.trim() === '' && article.sections.length === 0) {
      return res.status(409).json({ error: 'article has no body yet — write it before publishing' });
    }
    const result = exportArticle(article.id);
    if (!result.ok) return res.status(400).json({ error: result.error });
    db.update(ideaQueueItems)
      .set({ status: 'published' })
      .where(eq(ideaQueueItems.id, idea.id))
      .run();
    return res.json({ ok: true, exportPath: result.path });
  }

  // Post lanes (reddit / manually-posted linkedin): record the publish against the latest draft.
  const draft = db
    .select()
    .from(drafts)
    .where(eq(drafts.ideaId, idea.id))
    .orderBy(desc(drafts.createdAt))
    .get();
  if (!draft) return res.status(409).json({ error: 'no draft for this idea yet' });
  const permalink = typeof req.body?.permalink === 'string' && req.body.permalink.trim() !== ''
    ? req.body.permalink.trim()
    : null;
  const inserted = db
    .insert(publishedPosts)
    .values({ draftId: draft.id, permalink, platform: idea.platform ?? 'linkedin' })
    .returning()
    .all();
  db.update(ideaQueueItems)
    .set({ status: 'published' })
    .where(eq(ideaQueueItems.id, idea.id))
    .run();
  res.status(201).json({ ok: true, post: inserted[0] });
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
  const exportedArticle = db
    .select({ id: articles.id, stage: articles.stage })
    .from(articles)
    .where(eq(articles.ideaId, idea.id))
    .get();
  if (exportedArticle && exportedArticle.stage === 'exported') {
    return res
      .status(409)
      .json({ error: 'this piece was published (exported) — it is part of the Published archive' });
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
