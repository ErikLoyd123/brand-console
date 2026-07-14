import { Router } from 'express';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { sources, feedItems, feedItemTags } from '../../db/schema';
import { runRss, runOneById } from '../../ingest/discover-rss';
import { getActiveProfileId } from '../../profile/loader';

const router = Router();

// Normalize a keyword list and default-tag from a request body, shared by POST and PUT.
function cleanKeywords(keywords: unknown): string[] {
  return Array.isArray(keywords) ? keywords.map((k) => String(k).trim()).filter(Boolean) : [];
}
function cleanTag(tag: unknown): 'needs-your-take' | 'ready-to-draft' {
  return tag === 'ready-to-draft' ? 'ready-to-draft' : 'needs-your-take';
}

router.get('/', (_req, res) => {
  const pid = getActiveProfileId();
  res.json(db.select().from(sources).where(eq(sources.profileId, pid)).orderBy(desc(sources.createdAt)).all());
});

// POST /api/sources/run — run every enabled RSS feed now. Record-only (fills the inbox);
// returns the per-feed summary. Synchronous: a handful of feeds take a few seconds.
router.post('/run', async (_req, res) => {
  try {
    const summary = await runRss();
    res.json(summary);
  } catch (e) {
    console.error('POST /api/sources/run failed:', e);
    res.status(500).json({ error: 'Discovery run failed.' });
  }
});

// POST /api/sources/:id/run — run one RSS feed by id. 404 if unknown or not an rss source.
router.post('/:id/run', async (req, res) => {
  try {
    const result = await runOneById(req.params.id);
    if (!result) {
      res.status(404).json({ error: 'No RSS feed with that id.' });
      return;
    }
    res.json(result);
  } catch (e) {
    console.error('POST /api/sources/:id/run failed:', e);
    res.status(500).json({ error: 'Discovery run failed.' });
  }
});

router.post('/', (req, res) => {
  const { kind, name, url, pillar, keywords, default_tag, curated, config, enabled } = req.body;
  if (!name || !url) {
    res.status(400).json({ error: 'A feed needs a name and a URL.' });
    return;
  }
  // curated => a feed you trust to be on-topic; every item gets a high relevance floor at run
  // time instead of keyword scoring. Stored in config so it needs no dedicated column.
  const cfg = { ...(config ?? {}), curated: curated === true };
  const inserted = db
    .insert(sources)
    .values({
      profileId: getActiveProfileId(),
      kind: kind ?? 'rss',
      name,
      url,
      pillar: pillar ?? null,
      keywords: cleanKeywords(keywords),
      defaultTag: cleanTag(default_tag),
      config: cfg,
      enabled: enabled ?? true,
    })
    .returning()
    .all();
  res.status(201).json(inserted[0]);
});

// PUT /api/sources/:id — update an existing feed's editable fields. Only fields present in the
// body are changed; `curated` is folded into config, preserving any other config keys.
router.put('/:id', (req, res) => {
  const { name, url, pillar, keywords, default_tag, curated, enabled } = req.body;
  const existing = db.select().from(sources).where(eq(sources.id, req.params.id)).all();
  if (existing.length === 0) {
    res.status(404).json({ error: 'No feed with that id.' });
    return;
  }
  const row = existing[0];
  const patch: Partial<typeof sources.$inferInsert> = {};
  if (name !== undefined) patch.name = String(name);
  if (url !== undefined) patch.url = String(url);
  if (pillar !== undefined) patch.pillar = pillar || null;
  if (keywords !== undefined) patch.keywords = cleanKeywords(keywords);
  if (default_tag !== undefined) patch.defaultTag = cleanTag(default_tag);
  if (enabled !== undefined) patch.enabled = Boolean(enabled);
  if (curated !== undefined) patch.config = { ...(row.config ?? {}), curated: curated === true };

  const updated = db.update(sources).set(patch).where(eq(sources.id, req.params.id)).returning().all();
  res.json(updated[0]);
});

// DELETE /api/sources/:id — remove a feed and everything it brought in. FK enforcement is on,
// so we cascade in order: feed_item_tags -> feed_items -> the source. Promoted queue ideas keep
// their plain-text sourceRef and are untouched. Returns how many inbox items were removed.
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  const items = db.select({ id: feedItems.id }).from(feedItems).where(eq(feedItems.sourceId, id)).all();
  const itemIds = items.map((i) => i.id);
  if (itemIds.length > 0) {
    db.delete(feedItemTags).where(inArray(feedItemTags.feedItemId, itemIds)).run();
    db.delete(feedItems).where(eq(feedItems.sourceId, id)).run();
  }
  const deleted = db.delete(sources).where(eq(sources.id, id)).returning().all();
  if (deleted.length === 0) {
    res.status(404).json({ error: 'No feed with that id.' });
    return;
  }
  res.json({ ok: true, deletedItems: itemIds.length });
});

export default router;
