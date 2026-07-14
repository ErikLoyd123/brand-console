// src/profile/loader.ts
// Profile loader for the content engine. Resolves the gitignored repo-root
// profiles/<slug>/ directory of the ACTIVE profile (app_settings.active_profile_id),
// reads and parses identity.yaml into a typed shape with the design's defaults
// applied, and exposes accessors for the three profile files. The runtime reads
// profiles/ and only profiles/; it never falls back to profile.example/.
// Canonical schema: design 01-profile-model. lenses is an
// addition beyond that design doc's schema, added here to close the gap the
// opensourcedrop lens needs (design 04 says it "reads its feed URL from
// config"); it is optional, keyed by lens name, and defaults to {}.

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { appSettings, profiles } from '../db/schema';

export type DefaultTag = 'needs-your-take' | 'ready-to-draft';

export interface ProfilePillar {
  key: string;
  label: string;
  weight: number;
}

export interface FeedSource {
  name: string;
  url: string;
}

export interface FeedGroup {
  name: string;
  pillar: string;
  sources: FeedSource[];
  keywords: string[];
  default_tag: DefaultTag;
}

export interface CtaPolicy {
  personal_posts_carry_ask: boolean;
  product_posts_max_ask_lines: number;
  ask_style: string;
}

// An optional add-on discovery lens's config, keyed by lens name in
// enabled_lenses (for example "opensourcedrop"). Only lenses that need
// config beyond their on/off switch appear here; absent means unconfigured.
export interface LensConfig {
  name: string;
  url: string;
  pillar: string;
}

// A user's lean on / personalization of one register tone or theme. `key`
// references a shipped tone/theme key from src/core/registers.ts OR a
// user-custom key the roster does not define; `note` is one-line personalization
// prose ('' if absent). See design 01-register-axis.
export interface PlatformToneSelection {
  key: string;
  note: string;
}

// One configured Reddit destination: a subreddit the owner posts to — the bare
// subreddit name (no "r/") plus a human label for the console picker. The owner's
// own u/ profile is NOT represented here; it is always available and derived from
// the connected Reddit identity, not from config. See design
// 2026-07-03-reddit-publishing-channel/03-destinations.
export interface RedditDestination {
  subreddit: string; // bare name, no "r/" prefix
  label: string;
}

// A user's selection of one platform: which platform, whether it is active and
// default, and any tones/themes they lean on. The menu is committed
// (src/core/registers.ts); this selection is per-user config.
export interface PlatformSelection {
  key: string; // references a registers.ts Platform
  active: boolean; // default true
  default: boolean; // default false; resolved into one winner at read time
  tones: PlatformToneSelection[];
  themes: PlatformToneSelection[];
  // reddit-only: the subreddits the owner posts to. Omitted/undefined for
  // platforms without a community model (e.g. linkedin). See design 03.
  destinations?: RedditDestination[];
}

export interface Identity {
  display_name: string;
  products: string[];
  protected_relationships: string[];
  pillars: ProfilePillar[];
  feed_groups: FeedGroup[];
  cta_policy: CtaPolicy;
  enabled_lenses: string[];
  lenses: Record<string, LensConfig>;
  platforms: PlatformSelection[];
}

// Schema defaults from design 01-profile-model. The cta_policy default
// reproduces the current no-ask-by-default behavior.
export const DEFAULT_CTA_POLICY: CtaPolicy = {
  personal_posts_carry_ask: false,
  product_posts_max_ask_lines: 1,
  ask_style: 'soft-honest',
};

const HERE = dirname(fileURLToPath(import.meta.url));

// loader.ts lives at <repo-root>/src/profile/loader.ts.
export const REPO_ROOT = resolve(HERE, '..', '..');

// The active profile is chosen by the app_settings.active_profile_id row (written by the
// console switcher). Resolution is per-call, never a module-load constant, so a switch takes
// effect on the next read without restarting the long-lived API. See design
// 2026-07-13-multi-profile-longform-lane/02-profile-switching-and-setup.
export function getActiveProfileId(): string {
  const rows = db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, 'active_profile_id'))
    .all();
  if (rows.length > 0) return rows[0].value;
  // Settings row not yet seeded (a DB migrated before init-default-profile ran): fall back
  // to the single migrated profile.
  const all = db.select().from(profiles).all();
  if (all.length === 0) {
    throw new Error('No profiles exist yet. Run the setup skill to create one.');
  }
  return all[0].id;
}

// Look the active id up in the profiles table and return the absolute profiles/<slug>/
// directory. Throws if the active id has no row.
export function resolveActiveProfileDir(): string {
  const id = getActiveProfileId();
  const rows = db.select().from(profiles).where(eq(profiles.id, id)).all();
  if (rows.length === 0) {
    throw new Error(`Active profile "${id}" has no row in the profiles table.`);
  }
  return resolve(REPO_ROOT, 'profiles', rows[0].slug);
}

// Absolute profiles/<slug>/ directory for a NAMED profile — the slug-parameterized sibling
// of resolveActiveProfileDir(). Callers that inspect non-active profiles (the /api/profiles
// completeness column) pass a slug; everything else omits it and gets the active profile.
export function profileDirBySlug(slug: string): string {
  return resolve(REPO_ROOT, 'profiles', slug);
}

// The three profile files, resolved per call — under the active profile's directory by
// default, or under profiles/<slug>/ when a slug is given. These replace the module-load
// PROFILE_DIR/IDENTITY_PATH/VOICE_CARD_PATH/INTERVIEW_PATH constants.
export function identityPath(slug?: string): string {
  return resolve(slug ? profileDirBySlug(slug) : resolveActiveProfileDir(), 'identity.yaml');
}
export function voiceCardPath(slug?: string): string {
  return resolve(slug ? profileDirBySlug(slug) : resolveActiveProfileDir(), 'voice-card.md');
}
export function interviewPath(slug?: string): string {
  return resolve(slug ? profileDirBySlug(slug) : resolveActiveProfileDir(), 'interview.md');
}

// True when the active profile's directory exists. Tolerant of an unresolvable active
// profile (a fresh clone with no profiles row) so guard callers see false, not an exception.
export function profileExists(): boolean {
  try {
    const dir = resolveActiveProfileDir();
    return existsSync(dir) && statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

export function fileExistsNonEmpty(path: string): boolean {
  if (!existsSync(path)) return false;
  const stat = statSync(path);
  if (!stat.isFile()) return false;
  return readFileSync(path, 'utf8').trim().length > 0;
}

export function readVoiceCard(): string {
  return readFileSync(voiceCardPath(), 'utf8');
}

// Overwrite the active profile's voice-card.md with new markdown. The voice card is freeform
// prose (unlike identity.yaml's structured writer), so this is a whole-file write — the
// console's manual editor and the `voice` skill both compose the full card and save it here.
// Empty content is rejected: an empty card is the one thing checkCompleteness() treats as
// "missing", and would silently break every drafter and reviewer that loads it. Trailing
// newline normalized so the file stays tidy.
export function writeVoiceCard(markdown: string): void {
  if (typeof markdown !== 'string' || markdown.trim().length === 0) {
    throw new Error('Voice card cannot be empty.');
  }
  writeFileSync(voiceCardPath(), markdown.replace(/\s*$/, '') + '\n', 'utf8');
}

export function readInterview(): string {
  return readFileSync(interviewPath(), 'utf8');
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function normalizePillars(raw: unknown): ProfilePillar[] {
  if (!Array.isArray(raw)) return [];
  const out: ProfilePillar[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    out.push({
      key: asString(rec.key),
      label: asString(rec.label),
      weight: typeof rec.weight === 'number' ? rec.weight : Number.NaN,
    });
  }
  return out;
}

function normalizeSources(raw: unknown): FeedSource[] {
  if (!Array.isArray(raw)) return [];
  const out: FeedSource[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    out.push({ name: asString(rec.name), url: asString(rec.url) });
  }
  return out;
}

function normalizeFeedGroups(raw: unknown): FeedGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: FeedGroup[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const tag: DefaultTag =
      rec.default_tag === 'ready-to-draft' ? 'ready-to-draft' : 'needs-your-take';
    out.push({
      name: asString(rec.name),
      pillar: asString(rec.pillar),
      sources: normalizeSources(rec.sources),
      keywords: asStringArray(rec.keywords),
      default_tag: tag,
    });
  }
  return out;
}

function normalizeCtaPolicy(raw: unknown): CtaPolicy {
  if (raw === null || typeof raw !== 'object') return { ...DEFAULT_CTA_POLICY };
  const rec = raw as Record<string, unknown>;
  return {
    personal_posts_carry_ask:
      typeof rec.personal_posts_carry_ask === 'boolean'
        ? rec.personal_posts_carry_ask
        : DEFAULT_CTA_POLICY.personal_posts_carry_ask,
    product_posts_max_ask_lines:
      typeof rec.product_posts_max_ask_lines === 'number'
        ? rec.product_posts_max_ask_lines
        : DEFAULT_CTA_POLICY.product_posts_max_ask_lines,
    ask_style:
      typeof rec.ask_style === 'string' && rec.ask_style.trim().length > 0
        ? rec.ask_style
        : DEFAULT_CTA_POLICY.ask_style,
  };
}

// lenses is optional; an entry missing name/url/pillar normalizes to empty
// strings rather than throwing, since a lens with a blank url is simply
// unusable at run time (the consuming lens script surfaces that itself).
function normalizeLenses(raw: unknown): Record<string, LensConfig> {
  if (raw === null || typeof raw !== 'object') return {};
  const rec = raw as Record<string, unknown>;
  const out: Record<string, LensConfig> = {};
  for (const [key, value] of Object.entries(rec)) {
    if (value === null || typeof value !== 'object') continue;
    const lens = value as Record<string, unknown>;
    out[key] = {
      name: asString(lens.name),
      url: asString(lens.url),
      pillar: asString(lens.pillar),
    };
  }
  return out;
}

// Tolerant parse of a platform's tones/themes list into PlatformToneSelection[].
// An entry missing a key is skipped; a missing note normalizes to ''.
function normalizeToneSelections(raw: unknown): PlatformToneSelection[] {
  if (!Array.isArray(raw)) return [];
  const out: PlatformToneSelection[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const key = asString(rec.key);
    if (!key) continue;
    out.push({ key, note: asString(rec.note) });
  }
  return out;
}

// Tolerant parse of a reddit platform's destinations list. An entry missing a
// subreddit is skipped; a missing label defaults to the bare subreddit name. Returns
// undefined when the block is absent (not [] — absent means "profile-only", which the
// resolver in the destinations endpoint treats identically). See design 03.
function normalizeDestinations(raw: unknown): RedditDestination[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: RedditDestination[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const subreddit = asString(rec.subreddit);
    if (!subreddit) continue;
    out.push({ subreddit, label: asString(rec.label) || subreddit });
  }
  return out;
}

// platforms is optional; an entry missing a key is skipped, active defaults to
// true, default to false. The read-time default resolution (first active wins
// when none is marked default; linkedin when the list is empty) lives with the
// consumers, not here. See design 01-register-axis.
function normalizePlatforms(raw: unknown): PlatformSelection[] {
  if (!Array.isArray(raw)) return [];
  const out: PlatformSelection[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const key = asString(rec.key);
    if (!key) continue;
    out.push({
      key,
      active: typeof rec.active === 'boolean' ? rec.active : true,
      default: typeof rec.default === 'boolean' ? rec.default : false,
      tones: normalizeToneSelections(rec.tones),
      themes: normalizeToneSelections(rec.themes),
      destinations: normalizeDestinations(rec.destinations),
    });
  }
  return out;
}

// Parse a raw identity.yaml string into a typed Identity with defaults applied.
// Throws if the text is not valid YAML (the completeness predicate catches it).
export function parseIdentity(yamlText: string): Identity {
  const raw = parse(yamlText) as Record<string, unknown> | null;
  const rec = raw ?? {};
  return {
    display_name: asString(rec.display_name),
    products: asStringArray(rec.products),
    protected_relationships: asStringArray(rec.protected_relationships),
    pillars: normalizePillars(rec.pillars),
    feed_groups: normalizeFeedGroups(rec.feed_groups),
    cta_policy: normalizeCtaPolicy(rec.cta_policy),
    enabled_lenses: asStringArray(rec.enabled_lenses),
    lenses: normalizeLenses(rec.lenses),
    platforms: normalizePlatforms(rec.platforms),
  };
}

// Read and parse the active profile's identity.yaml. Throws if the file is missing or the
// YAML is invalid; callers that need graceful handling use profileExists() and the
// completeness predicate first.
export function loadIdentity(): Identity {
  return parseIdentity(readFileSync(identityPath(), 'utf8'));
}

// loadIdentity for read paths that must survive a skeleton profile: null when
// identity.yaml doesn't exist yet (a just-created profile awaiting setup), so console
// GET routes render empty states instead of a raw ENOENT 500. Invalid YAML still
// throws — that's a real error, not an expected pre-setup state.
export function tryLoadIdentity(): Identity | null {
  if (!fileExistsNonEmpty(identityPath())) return null;
  return loadIdentity();
}

// readVoiceCard for the same tolerant read paths: '' when the card isn't written yet.
export function tryReadVoiceCard(): string {
  return fileExistsNonEmpty(voiceCardPath()) ? readVoiceCard() : '';
}
