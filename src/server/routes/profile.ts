import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { getPillars, getPillarLabel } from '../../core/pillars';
import { getActiveProfileId, tryLoadIdentity, tryReadVoiceCard, type CtaPolicy } from '../../profile/loader';
import { db } from '../../db/client';
import { linkedinTokens, profiles, sources } from '../../db/schema';

const router = Router();

// Format the structured cta_policy object into one human-readable sentence.
// ProfileData.ctaPolicy is a string on the wire; identity.yaml stores the
// structured object, so the sentence is derived deterministically here.
function formatCtaPolicy(c: CtaPolicy): string {
  const personal = c.personal_posts_carry_ask
    ? 'Personal-brand posts may carry an ask'
    : 'Personal-brand posts carry no ask';
  const n = c.product_posts_max_ask_lines;
  const count = n === 1 ? 'one' : String(n);
  const noun = n === 1 ? 'line' : 'lines';
  const style = c.ask_style.replace(/-/g, ' '); // "soft-honest" -> "soft honest"
  return `${personal}; product-adjacent posts get at most ${count} ${style} ${noun}.`;
}

// GET /api/pillars — the active profile's pillars as { key, label } pairs.
// The console renders pillar badges from this list instead of a hardcoded map,
// so arbitrary user-defined pillar keys label correctly. getPillars() returns
// keys only (phase 02), so each key is paired with getPillarLabel() to build
// the { key, label } shape the console expects, served straight from
// profile/identity.yaml.
router.get('/pillars', (_req, res) => {
  res.json(getPillars().map((key) => ({ key, label: getPillarLabel(key) })));
});

// GET /api/profile — the full ProfileData the Voice page reads: display name,
// pillar badges, the raw voice-card markdown, the CTA policy as a sentence, and
// the flattened list of feeds/lenses the engine ingests. Every field is read
// from profile/ files; nothing is fabricated.
router.get('/profile', (_req, res) => {
  const pid = getActiveProfileId();
  // Tolerant of a skeleton profile awaiting setup: identity/voice card may not exist
  // yet, and the Voice page's setup surface renders from the empty shape instead of a 500.
  const identity = tryLoadIdentity();
  // Feeds live in the DB now (the sources table), not identity.yaml — list the enabled ones.
  const feedNames = db
    .select({ name: sources.name })
    .from(sources)
    .where(and(eq(sources.enabled, true), eq(sources.profileId, pid)))
    .all()
    .map((r) => r.name);
  const row = db.select().from(profiles).where(eq(profiles.id, pid)).get();
  res.json({
    name: identity?.display_name ?? row?.displayName ?? '',
    pillars: getPillars().map((key) => ({ key, label: getPillarLabel(key) })),
    voiceCard: tryReadVoiceCard(),
    ctaPolicy: identity ? formatCtaPolicy(identity.cta_policy) : '',
    feedSources: feedNames,
  });
});

// GET /api/connections — real LinkedIn status backed by the linkedin_tokens
// table (server-side OAuth store); reddit, x, and newsletter remain honest stubs.
// Reddit has no OAuth — it's a manual copy-paste channel — and x/newsletter have
// no OAuth wired up yet. No token field is ever included in this response — that's
// the secrets boundary between server and browser.
router.get('/connections', (_req, res) => {
  const pid = getActiveProfileId();
  const [linkedin] = db.select().from(linkedinTokens).where(eq(linkedinTokens.profileId, pid)).all();
  res.json([
    {
      platform: 'linkedin',
      connected: Boolean(linkedin),
      displayName: linkedin?.name ?? null,
      avatarUrl: linkedin?.avatarUrl ?? null,
      headline: linkedin?.headline ?? null,
      connectedAt: linkedin?.connectedAt ?? null,
      scopes: linkedin?.scopes ?? [],
    },
    {
      platform: 'x',
      connected: false,
      displayName: null,
      avatarUrl: null,
      headline: null,
      connectedAt: null,
      scopes: [],
    },
    {
      platform: 'newsletter',
      connected: false,
      displayName: null,
      avatarUrl: null,
      headline: null,
      connectedAt: null,
      scopes: [],
    },
  ]);
});

export default router;
