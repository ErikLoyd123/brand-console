import { Router } from 'express';
import { mkdirSync, rmSync } from 'node:fs';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  appSettings,
  articles,
  drafts,
  feedItems,
  feedItemTags,
  ideaQueueItems,
  linkedinTokens,
  profiles,
  publishedPosts,
  scheduledPosts,
  sources,
  sparks,
  tags,
} from '../../db/schema';
import {
  fileExistsNonEmpty,
  getActiveProfileId,
  interviewPath,
  profileDirBySlug,
} from '../../profile/loader';
import { checkCompleteness } from '../../profile/completeness';

const router = Router();

const ACTIVE_KEY = 'active_profile_id';

// Lowercase kebab-case slug from a display name: "Acme Labs" -> "acme-labs".
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// A slug unique within the profiles table, suffixing -2, -3, ... on collision so the
// profiles_slug_uniq index (phase 01) never rejects the insert.
function uniqueSlug(name: string): string {
  const base = slugify(name) || 'profile';
  const taken = new Set(db.select({ slug: profiles.slug }).from(profiles).all().map((r) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// Upsert the single active-profile pointer row. Shared by PUT and POST.
function setActiveProfile(id: string): void {
  db.insert(appSettings)
    .values({ key: ACTIVE_KEY, value: id })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: id } })
    .run();
}

// GET /api/profiles — every profile as { id, name, kind, active, complete, missing,
// interviewStarted }. active marks the current active_profile_id; complete/missing are
// that profile's completeness result — missing lists what setup still has to fill, which
// the Voice page's setup surface renders as a checklist. interviewStarted says whether
// interview.md holds any saved answers yet (setup appends after every question), so the
// setup surface can say "resume" instead of "this profile is empty" after an interrupted
// interview. This is the switcher's menu and provenance source.
router.get('/profiles', (_req, res) => {
  const rows = db.select().from(profiles).all();
  // Zero profiles (fresh clone) is a valid answer here, not an error: this is the
  // bootstrap endpoint the console's welcome screen and health badge rely on, so it
  // must never trip NoProfileError.
  if (rows.length === 0) return res.json([]);
  const activeId = getActiveProfileId();
  res.json(
    rows.map((p) => {
      const completeness = checkCompleteness(p.slug);
      return {
        id: p.id,
        name: p.displayName,
        kind: p.kind,
        active: p.id === activeId,
        complete: completeness.complete,
        missing: completeness.missing,
        interviewStarted: fileExistsNonEmpty(interviewPath(p.slug)),
      };
    }),
  );
});

// PUT /api/active-profile — body { profileId }. Writes the pointer row and returns the
// now-active profile. 404 on an unknown id.
router.put('/active-profile', (req, res) => {
  const profileId = typeof req.body?.profileId === 'string' ? req.body.profileId : '';
  const profile = db.select().from(profiles).where(eq(profiles.id, profileId)).get();
  if (!profile) return res.status(404).json({ error: 'no profile with that id' });
  setActiveProfile(profile.id);
  const completeness = checkCompleteness(profile.slug);
  res.json({
    id: profile.id,
    name: profile.displayName,
    kind: profile.kind,
    active: true,
    complete: completeness.complete,
    missing: completeness.missing,
    interviewStarted: fileExistsNonEmpty(interviewPath(profile.slug)),
  });
});

// POST /api/profiles — body { name, kind }. Insert a profiles row with a derived unique
// slug, create the skeleton profiles/<slug>/ dir (no identity/voice/interview yet — the
// profile is intentionally incomplete), set it active, and return it. Population is the
// onboarding gate + setup's job, not creation's.
router.post('/profiles', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const kind = req.body?.kind === 'brand' ? 'brand' : 'personal';
  if (name === '') return res.status(400).json({ error: 'name is required' });
  const slug = uniqueSlug(name);
  const inserted = db.insert(profiles).values({ slug, displayName: name, kind }).returning().all();
  const profile = inserted[0];
  // Design 02's creation order: insert the row, create the skeleton dir, then activate.
  mkdirSync(profileDirBySlug(slug), { recursive: true });
  setActiveProfile(profile.id);
  res.status(201).json({
    id: profile.id,
    name: profile.displayName,
    kind: profile.kind,
    active: true,
    complete: false,
    missing: checkCompleteness(slug).missing,
    interviewStarted: false,
  });
});

// DELETE /api/profiles/:id — remove a profile and everything it owns: every scoped
// content row (in FK-safe order), the profiles row, and the profiles/<slug>/ directory
// on disk. Deliberately refuses the ACTIVE profile (switch away first) — which also
// makes the last remaining profile undeletable. The console confirms before calling.
router.delete('/profiles/:id', (req, res) => {
  const profile = db.select().from(profiles).where(eq(profiles.id, req.params.id)).get();
  if (!profile) return res.status(404).json({ error: 'no profile with that id' });
  if (profile.id === getActiveProfileId()) {
    return res.status(400).json({ error: 'cannot delete the active profile — switch to another profile first' });
  }

  db.transaction((tx) => {
    // Children first (rows only reachable through a scoped parent), then the scoped
    // tables, then the profile row itself.
    const feedItemIds = tx
      .select({ id: feedItems.id })
      .from(feedItems)
      .where(eq(feedItems.profileId, profile.id))
      .all()
      .map((r) => r.id);
    if (feedItemIds.length > 0) {
      tx.delete(feedItemTags).where(inArray(feedItemTags.feedItemId, feedItemIds)).run();
    }
    const draftIds = tx
      .select({ id: drafts.id })
      .from(drafts)
      .where(eq(drafts.profileId, profile.id))
      .all()
      .map((r) => r.id);
    if (draftIds.length > 0) {
      tx.delete(scheduledPosts).where(inArray(scheduledPosts.draftId, draftIds)).run();
      tx.delete(publishedPosts).where(inArray(publishedPosts.draftId, draftIds)).run();
    }
    tx.delete(articles).where(eq(articles.profileId, profile.id)).run();
    tx.delete(drafts).where(eq(drafts.profileId, profile.id)).run();
    tx.delete(ideaQueueItems).where(eq(ideaQueueItems.profileId, profile.id)).run();
    tx.delete(feedItems).where(eq(feedItems.profileId, profile.id)).run();
    tx.delete(sources).where(eq(sources.profileId, profile.id)).run();
    tx.delete(sparks).where(eq(sparks.profileId, profile.id)).run();
    tx.delete(tags).where(eq(tags.profileId, profile.id)).run();
    tx.delete(linkedinTokens).where(eq(linkedinTokens.profileId, profile.id)).run();
    tx.delete(profiles).where(eq(profiles.id, profile.id)).run();
  });

  // Disk last, after the DB transaction committed: the gitignored identity folder.
  rmSync(profileDirBySlug(profile.slug), { recursive: true, force: true });

  res.status(204).end();
});

export default router;
