import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { scheduledPosts, drafts, ideaQueueItems } from '../../db/schema';
import { getActiveProfileId } from '../../profile/loader';

const router = Router();

// GET /api/scheduled -> the planned-post slots, soonest first. The Calendar used
// to fabricate "planned" markers on every future Tue/Thu; that invented data on a
// screen that also shows real published posts. This serves the actual
// scheduled_posts table instead, resolving pillar + a title (first hook) via
// slot -> draft -> idea so the calendar can label real plans and nothing else.
// Empty table -> [], which is the honest state until something is scheduled.
router.get('/', (_req, res) => {
  const pid = getActiveProfileId();

  // Scope through drafts: only slots whose draft belongs to the active profile.
  const draftById = new Map(
    db.select().from(drafts).where(eq(drafts.profileId, pid)).all().map((d) => [d.id, d]),
  );
  const ideaPillarById = new Map(
    db
      .select()
      .from(ideaQueueItems)
      .where(eq(ideaQueueItems.profileId, pid))
      .all()
      .map((i) => [i.id, i.pillar]),
  );

  const slots = db
    .select()
    .from(scheduledPosts)
    .orderBy(asc(scheduledPosts.plannedFor))
    .all()
    .filter((s) => draftById.has(s.draftId));

  res.json(
    slots.map((s) => {
      const draft = draftById.get(s.draftId);
      const pillar = draft ? ideaPillarById.get(draft.ideaId) ?? null : null;
      const title = draft?.hookOptions?.[0] ?? null;
      return {
        id: s.id,
        draftId: s.draftId,
        plannedFor: s.plannedFor,
        status: s.status,
        pillar,
        title,
      };
    }),
  );
});

export default router;
