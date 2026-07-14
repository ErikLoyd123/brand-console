import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { ideaQueueItems } from '../../db/schema';
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

export default router;
