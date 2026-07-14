import { Router } from 'express';
import { and, asc, desc, eq, inArray, like, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { feedItems, feedItemTags, tags } from '../../db/schema';
import { promoteFeedItem } from '../../core/promote';
import { getActiveProfileId } from '../../profile/loader';

const router = Router();

// GET /inbox?group=<source|date|pillar>&tags=<id,id>&q=<search>&state=<inbox|archived>
// Returns feed_items in the requested triage state, each with its joined tags.
// tags = OR filter (any of the given ids); q = substring over title/summary.
router.get('/inbox', (req, res) => {
  const pid = getActiveProfileId();
  const state = typeof req.query.state === 'string' && req.query.state !== '' ? req.query.state : 'inbox';
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const tagsParam = typeof req.query.tags === 'string' ? req.query.tags : '';
  const tagIds = tagsParam
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');

  const clauses = [eq(feedItems.profileId, pid), eq(feedItems.triageState, state)];
  if (q !== '') {
    const search = or(like(feedItems.title, `%${q}%`), like(feedItems.summary, `%${q}%`));
    if (search) clauses.push(search);
  }
  const rows = db
    .select()
    .from(feedItems)
    .where(and(...clauses))
    .orderBy(desc(feedItems.fetchedAt))
    .all();

  // Attach tags: one join lookup for the returned items, resolved against the vocabulary.
  const ids = rows.map((r) => r.id);
  const joinRows = ids.length
    ? db.select().from(feedItemTags).where(inArray(feedItemTags.feedItemId, ids)).all()
    : [];
  const vocab = db.select().from(tags).where(eq(tags.profileId, pid)).orderBy(asc(tags.name)).all();
  const tagById = new Map(vocab.map((t) => [t.id, t]));
  const tagsByItem = new Map<string, typeof vocab>();
  for (const j of joinRows) {
    const t = tagById.get(j.tagId);
    if (!t) continue;
    const list = tagsByItem.get(j.feedItemId) ?? [];
    list.push(t);
    tagsByItem.set(j.feedItemId, list);
  }

  let result = rows.map((r) => ({ ...r, tags: tagsByItem.get(r.id) ?? [] }));
  if (tagIds.length > 0) {
    result = result.filter((item) => item.tags.some((t) => tagIds.includes(t.id)));
  }
  res.json(result);
});

router.post('/:id/archive', (req, res) => {
  const updated = db
    .update(feedItems)
    .set({ triageState: 'archived', archivedAt: Date.now() })
    .where(eq(feedItems.id, req.params.id))
    .returning()
    .all();
  if (updated.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(updated[0]);
});

router.post('/:id/unarchive', (req, res) => {
  const updated = db
    .update(feedItems)
    .set({ triageState: 'inbox', archivedAt: null })
    .where(eq(feedItems.id, req.params.id))
    .returning()
    .all();
  if (updated.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(updated[0]);
});

// Save for later: move a feed item from the inbox to the 'saved' shortlist. This is the
// low-friction, pre-queue "keep" — no take required (that's what promote asks for). A
// saved item leaves the inbox and shows under the Saved view until promoted or archived.
router.post('/:id/save', (req, res) => {
  const updated = db
    .update(feedItems)
    .set({ triageState: 'saved' })
    .where(eq(feedItems.id, req.params.id))
    .returning()
    .all();
  if (updated.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(updated[0]);
});

// Unsave: move a saved item back to the inbox (an undo of save-for-later).
router.post('/:id/unsave', (req, res) => {
  const updated = db
    .update(feedItems)
    .set({ triageState: 'inbox' })
    .where(eq(feedItems.id, req.params.id))
    .returning()
    .all();
  if (updated.length === 0) return res.status(404).json({ error: 'not found' });
  res.json(updated[0]);
});

// Promote: create a seeded idea_queue_items row and flip the feed item to promoted.
// The write lives in the shared promoteFeedItem (src/core/promote.ts) so this manual
// path and the `discovery` skill's CLI stay identical. Idempotent — a feed item that
// already carries promotedIdeaId is not re-promoted.
// `comment` is the owner's take (the seed); `silo`/`points` are optional. Developed
// points passed at promote time let `discovery` promote straight into a substantial idea.
router.post('/:id/promote', (req, res) => {
  const { comment, silo, points } = req.body;
  const result = promoteFeedItem(req.params.id, { seed: comment, silo, points });
  if (!result.ok) {
    if (result.error === 'not-found') return res.status(404).json({ error: 'not found' });
    return res.status(409).json({ error: 'already promoted', promotedIdeaId: result.promotedIdeaId });
  }
  res.status(201).json({ id: result.ideaId });
});

// Attach a tag to a feed item; the composite key makes a duplicate attach a no-op.
router.post('/:id/tags', (req, res) => {
  const { tagId } = req.body;
  db.insert(feedItemTags)
    .values({ feedItemId: req.params.id, tagId })
    .onConflictDoNothing()
    .run();
  res.status(201).json({ feedItemId: req.params.id, tagId });
});

router.delete('/:id/tags/:tagId', (req, res) => {
  db.delete(feedItemTags)
    .where(and(eq(feedItemTags.feedItemId, req.params.id), eq(feedItemTags.tagId, req.params.tagId)))
    .run();
  res.status(204).end();
});

export default router;
