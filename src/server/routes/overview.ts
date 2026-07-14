import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { publishedPosts, drafts, ideaQueueItems, feedItems } from '../../db/schema';
import { getPillars, getPillarLabel } from '../../core/pillars';
import { getActiveProfileId } from '../../profile/loader';

const router = Router();

// Posts-per-week cadence is averaged over this fixed trailing window (see
// GET /overview). Documented so the number is legible.
const WINDOW_WEEKS = 8;

// One PillarCoverage per profile pillar, in declared order. posts + queue are the
// pipeline-coverage counts per pillar (not performance metrics): posts is resolved
// per pillar by walking published post -> draft -> idea (a post whose idea row is
// gone has no resolvable pillar and is skipped, not crashed); queue counts every
// idea_queue_items row for that pillar, no status filter. A pillar with 0 posts and
// 0 queue is a coverage gap.
export function computePillarStats() {
  const pid = getActiveProfileId();
  const draftRows = db.select().from(drafts).where(eq(drafts.profileId, pid)).all();
  const ideaRows = db.select().from(ideaQueueItems).where(eq(ideaQueueItems.profileId, pid)).all();

  const ideaPillarById = new Map(ideaRows.map((i) => [i.id, i.pillar]));
  const draftIdeaById = new Map(draftRows.map((d) => [d.id, d.ideaId]));

  const posts = db.select().from(publishedPosts).all().filter((p) => draftIdeaById.has(p.draftId));

  const postsByPillar = new Map<string, number>();
  for (const p of posts) {
    const ideaId = draftIdeaById.get(p.draftId);
    if (!ideaId) continue;
    const pillar = ideaPillarById.get(ideaId);
    if (!pillar) continue;
    postsByPillar.set(pillar, (postsByPillar.get(pillar) ?? 0) + 1);
  }

  const queueByPillar = new Map<string, number>();
  for (const i of ideaRows) {
    queueByPillar.set(i.pillar, (queueByPillar.get(i.pillar) ?? 0) + 1);
  }

  return getPillars().map((key) => ({
    pillar: key,
    label: getPillarLabel(key),
    posts: postsByPillar.get(key) ?? 0,
    queue: queueByPillar.get(key) ?? 0,
  }));
}

// GET /api/pillars/stats -> PillarCoverage[]. A pillar with no posts and no queue
// items still appears, with zeros.
router.get('/pillars/stats', (_req, res) => {
  res.json(computePillarStats());
});

// GET /api/overview -> OverviewData. Every figure is a real count/list over real
// rows; an empty published_posts table yields zeros and empty arrays.
router.get('/overview', (_req, res) => {
  const pid = getActiveProfileId();
  const draftRows = db.select().from(drafts).where(eq(drafts.profileId, pid)).all();
  const ideaRows = db.select().from(ideaQueueItems).where(eq(ideaQueueItems.profileId, pid)).all();
  const draftIdeaById = new Map(draftRows.map((d) => [d.id, d.ideaId]));
  const posts = db.select().from(publishedPosts).all().filter((p) => draftIdeaById.has(p.draftId));
  const inbox = db
    .select()
    .from(feedItems)
    .where(and(eq(feedItems.profileId, pid), eq(feedItems.triageState, 'inbox')))
    .all();

  // The queue is the review phase: everything not yet shipped or archived lives there.
  const queueCount = ideaRows.filter(
    (i) => i.status !== 'archived' && i.status !== 'published',
  ).length;

  const funnel = [
    { key: 'discovery', label: 'Discovery', count: inbox.length },
    { key: 'queue', label: 'Queue', count: queueCount },
    { key: 'published', label: 'Published', count: posts.length },
  ];

  // Honest-empty: 0 when nothing has been reviewed, never a fabricated percent.
  const reviewed = draftRows.filter((d) => d.reviewStatus !== 'pending');
  const passed = reviewed.filter(
    (d) => d.reviewStatus === 'passed' || d.reviewStatus === 'edited',
  );
  const reviewPassRate = reviewed.length
    ? Math.round((passed.length / reviewed.length) * 100)
    : 0;

  // Trailing WINDOW_WEEKS-week average posts/week, one decimal place; 0 when empty.
  const windowStart = Date.now() - WINDOW_WEEKS * 7 * 86_400_000;
  const recentPosts = posts.filter((p) => p.publishedAt >= windowStart);
  const cadencePerWeek = recentPosts.length
    ? Math.round((recentPosts.length / WINDOW_WEEKS) * 10) / 10
    : 0;

  // needs-your-take items awaiting a take, best score first, capped at 4.
  const needsTake = ideaRows
    .filter((i) => i.tag === 'needs-your-take' && i.status === 'new')
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  // Most recently published, newest first, capped at 5.
  const recent = [...posts]
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, 5);

  res.json({
    funnel,
    reviewPassRate,
    cadencePerWeek,
    needsTake,
    recent,
  });
});

export default router;
