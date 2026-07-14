import { Router } from 'express';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { tags, feedItemTags } from '../../db/schema';
import { getActiveProfileId } from '../../profile/loader';

// Normalize a display name into a stable slug key: lowercase, non-alphanumerics
// collapse to single hyphens, trim leading/trailing hyphens. "Cost Anomaly" -> "cost-anomaly".
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const router = Router();

// List the vocabulary with a per-tag usage count (how many feed items carry it),
// via a left join so tags attached to nothing still report 0.
router.get('/', (_req, res) => {
  const pid = getActiveProfileId();
  const rows = db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      color: tags.color,
      createdAt: tags.createdAt,
      usageCount: sql<number>`count(${feedItemTags.feedItemId})`,
    })
    .from(tags)
    .leftJoin(feedItemTags, eq(feedItemTags.tagId, tags.id))
    .where(eq(tags.profileId, pid))
    .groupBy(tags.id)
    .orderBy(asc(tags.name))
    .all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const pid = getActiveProfileId();
  const { name } = req.body;
  const slug = slugify(typeof name === 'string' ? name : '');
  if (slug === '') return res.status(400).json({ error: 'name is required' });
  const existing = db
    .select()
    .from(tags)
    .where(and(eq(tags.profileId, pid), eq(tags.slug, slug)))
    .all();
  if (existing.length > 0) return res.json(existing[0]);
  const inserted = db.insert(tags).values({ name, slug, profileId: pid }).returning().all();
  res.status(201).json(inserted[0]);
});

// Rename and/or recolor. Only `name` and `color` are writable — `slug` is the tag's
// frozen identity (the unique key and what feed items are rendered/filtered by), so
// a rename never re-slugs and can never orphan a reference. `color: null` clears the
// color back to the auto index palette.
router.patch('/:id', (req, res) => {
  const { name, color } = req.body;
  const patch: { name?: string; color?: string | null } = {};
  if (typeof name === 'string' && name.trim() !== '') patch.name = name.trim();
  if (color !== undefined) patch.color = color;
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'nothing to update' });
  }
  const updated = db.update(tags).set(patch).where(eq(tags.id, req.params.id)).returning().all();
  if (updated.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(updated[0]);
});

// Cascade delete. Foreign keys are ON (see db/client.ts) and feed_item_tags.tagId
// references tags.id, so the join rows must go first — both in one transaction so a
// tag is never left half-deleted. Callers warn on usageCount (from GET /) beforehand.
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.select().from(tags).where(eq(tags.id, id)).all();
  if (existing.length === 0) return res.status(404).json({ error: 'not found' });
  db.transaction((tx) => {
    tx.delete(feedItemTags).where(eq(feedItemTags.tagId, id)).run();
    tx.delete(tags).where(eq(tags.id, id)).run();
  });
  res.status(204).end();
});

export default router;
