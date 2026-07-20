import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';

export const profiles = sqliteTable(
  'profiles',
  {
    id: text('id').primaryKey().$defaultFn(() => nanoid()),
    // Stable short identifier. IS the on-disk directory name (profiles/<slug>/) and the
    // handle the console switcher and /api routes pass around. Lowercase kebab-case.
    slug: text('slug').notNull(),
    displayName: text('display_name').notNull(),
    // 'personal' | 'brand'. Drives the setup interview variant; nothing structural here.
    kind: text('kind').notNull().default('personal'),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  },
  (t) => ({
    slugUniq: uniqueIndex('profiles_slug_uniq').on(t.slug),
  }),
);

// App-wide key/value settings that are neither content nor per-profile. Today exactly one
// key: active_profile_id, the id of the active profile. Seeded by init-default-profile.
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const sources = sqliteTable('sources', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  profileId: text('profile_id')
    .notNull()
    .references(() => profiles.id)
    .default('default'),
  kind: text('kind').notNull(),
  name: text('name').notNull(),
  url: text('url'),
  pillar: text('pillar'),
  // Per-feed relevance keywords and seed tag — the metadata feed_groups used to carry at the
  // group level, now first-class on each source since the DB is the source of truth for feeds.
  keywords: text('keywords', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default([]),
  defaultTag: text('default_tag').notNull().default('needs-your-take'),
  config: text('config', { mode: 'json' })
    .$type<Record<string, unknown>>()
    .notNull()
    .$defaultFn(() => ({})),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const feedItems = sqliteTable(
  'feed_items',
  {
    id: text('id').primaryKey().$defaultFn(() => nanoid()),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id)
      .default('default'),
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    url: text('url'),
    summary: text('summary'),
    publishedAt: integer('published_at'),
    raw: text('raw', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull()
      .$defaultFn(() => ({})),
    fetchedAt: integer('fetched_at').notNull().$defaultFn(() => Date.now()),
    triageState: text('triage_state').notNull().default('inbox'),
    archivedAt: integer('archived_at'),
    promotedIdeaId: text('promoted_idea_id'),
    score: integer('score').notNull().default(0),
  },
  (t) => ({
    triageStateIdx: index('feed_items_triage_state_idx').on(t.triageState),
    sourceIdIdx: index('feed_items_source_id_idx').on(t.sourceId),
    publishedAtIdx: index('feed_items_published_at_idx').on(t.publishedAt),
    profileIdIdx: index('feed_items_profile_id_idx').on(t.profileId),
  }),
);

export const ideaQueueItems = sqliteTable(
  'idea_queue_items',
  {
    id: text('id').primaryKey().$defaultFn(() => nanoid()),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id)
      .default('default'),
    pillar: text('pillar').notNull(),
    // A post's intent (its job), orthogonal to `pillar` (its topic). Roster lives in
    // src/core/silos.ts. 'teach' names today's implicit default, so pre-existing rows and
    // any insert path that omits a silo still produce a valid row. See design
    // 2026-07-02-content-silos/01-silo-model.
    silo: text('silo').notNull().default('teach'),
    // A post's register — how it sounds and where it ships — orthogonal to pillar
    // (topic) and silo (intent). Both nullable: null means the spark did not pin a
    // register, so drafting falls back to the profile's default (identity.yaml
    // platforms, else linkedin). The shipped menu lives in src/core/registers.ts.
    // Set by spark; capture leaves them null. See design
    // 2026-07-03-content-spine-register-axis/01-register-axis.
    platform: text('platform'),
    tone: text('tone'),
    tag: text('tag').notNull(),
    sourceRef: text('source_ref'),
    proposedAngle: text('proposed_angle').notNull(),
    seed: text('seed'),
    // The developed take: 2-4 supporting points — the beats of the argument the owner
    // wants to make — that raise a queue item above a bare angle. Written by the `develop`
    // skill or by hand in the console; read by draft as the spine of the body. Empty
    // by default so every existing row and every capture/promote path stays valid.
    points: text('points', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default([]),
    score: integer('score').notNull().default(0),
    status: text('status').notNull().default('new'),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  },
  (t) => ({
    profileIdIdx: index('idea_queue_items_profile_id_idx').on(t.profileId),
  }),
);

export const drafts = sqliteTable('drafts', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  profileId: text('profile_id')
    .notNull()
    .references(() => profiles.id)
    .default('default'),
  ideaId: text('idea_id')
    .notNull()
    .references(() => ideaQueueItems.id),
  hookOptions: text('hook_options', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),
  body: text('body').notNull().default(''),
  close: text('close').notNull().default(''),
  mediaSuggestion: text('media_suggestion').notNull().default(''),
  reviewStatus: text('review_status').notNull().default('pending'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const scheduledPosts = sqliteTable('scheduled_posts', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  draftId: text('draft_id')
    .notNull()
    .references(() => drafts.id),
  plannedFor: integer('planned_for'),
  status: text('status').notNull().default('queued'),
});

export const publishedPosts = sqliteTable('published_posts', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  draftId: text('draft_id')
    .notNull()
    .references(() => drafts.id),
  permalink: text('permalink'),
  publishedAt: integer('published_at').notNull().$defaultFn(() => Date.now()),
  // Which channel this post went out on. Existing rows predate Reddit, so the
  // default keeps every historical row valid as a LinkedIn post.
  platform: text('platform').notNull().default('linkedin'),
  // The chosen Reddit destination in canonical string form: 'r/<sub>' for a
  // subreddit, 'u/<username>' for the owner's profile. Null for LinkedIn rows.
  destination: text('destination'),
  // The platform-native post id. For Reddit this is the fullname (e.g. 't3_abc'),
  // used by delete. Null for LinkedIn rows, which carry their id in linkedinUrn.
  platformPostId: text('platform_post_id'),
  // The LinkedIn-assigned post URN (e.g. urn:li:share:123...), captured from the
  // x-restli-id response header at publish time. Null for posts tracked manually
  // (not published through the LinkedIn API), which the delete/comment/like
  // routes use to refuse acting on them.
  linkedinUrn: text('linkedin_urn'),
});

// An image attached to a queue idea — produced by the imagery procedure (composed
// graphic, annotated screenshot, Unsplash pick) or uploaded by hand. The file itself
// lives under gitignored data/images/<profileId>/ (the `path` column is relative to
// data/images/); this row is the provenance the console surfaces: what it is (alt),
// where it came from (source + params), and which idea it rides with. Publish reads
// it: LinkedIn uploads the file via the assets flow, web export bundles it beside
// the markdown.
export const images = sqliteTable(
  'images',
  {
    id: text('id').primaryKey().$defaultFn(() => nanoid()),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id)
      .default('default'),
    ideaId: text('idea_id')
      .notNull()
      .references(() => ideaQueueItems.id),
    // How the image was produced: 'composed' | 'screenshot' | 'unsplash' | 'upload'.
    source: text('source').notNull(),
    // File path relative to data/images/ (e.g. "<profileId>/<imageId>.png").
    path: text('path').notNull(),
    // Alt text — required for quality: LinkedIn media description, markdown alt, SEO.
    alt: text('alt').notNull().default(''),
    width: integer('width').notNull().default(0),
    height: integer('height').notNull().default(0),
    // Source-specific provenance, shaped per `source`: compose template + inputs;
    // screenshot URL + viewport + annotations; unsplash photo id + author (attribution
    // requirement); upload original filename.
    params: text('params', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull()
      .$defaultFn(() => ({})),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  },
  (t) => ({
    ideaIdIdx: index('images_idea_id_idx').on(t.ideaId),
    profileIdIdx: index('images_profile_id_idx').on(t.profileId),
  }),
);

export const sparks = sqliteTable('sparks', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  profileId: text('profile_id')
    .notNull()
    .references(() => profiles.id)
    .default('default'),
  text: text('text').notNull(),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
});

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey().$defaultFn(() => nanoid()),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id)
      .default('default'),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    color: text('color'),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  },
  (t) => ({
    slugUniq: uniqueIndex('tags_slug_uniq').on(t.profileId, t.slug),
  }),
);

// Single-row table (local, single user): on a new LinkedIn connect, existing
// rows are deleted before inserting the fresh one. memberSub is the OpenID
// `sub` claim, used as-is to build the author URN urn:li:person:{sub}.
export const linkedinTokens = sqliteTable('linkedin_tokens', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  profileId: text('profile_id')
    .notNull()
    .references(() => profiles.id)
    .default('default'),
  memberSub: text('member_sub').notNull(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  headline: text('headline'),
  accessToken: text('access_token').notNull(),
  expiresAt: integer('expires_at'),
  scopes: text('scopes', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),
  connectedAt: integer('connected_at').notNull().$defaultFn(() => Date.now()),
});

export const feedItemTags = sqliteTable(
  'feed_item_tags',
  {
    feedItemId: text('feed_item_id')
      .notNull()
      .references(() => feedItems.id),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
  },
  (t) => ({
    uniq: uniqueIndex('feed_item_tags_uniq').on(t.feedItemId, t.tagId),
    tagIdIdx: index('feed_item_tags_tag_id_idx').on(t.tagId),
  }),
);

// One section of a long-form article: a stable id, its ## heading, the outline note (what the
// section must accomplish), and the written markdown body (empty until the draft stage fills it).
// The single `sections` column below carries outline and prose together, keyed by stable id, so
// reorders/inserts never drift two parallel arrays. See design 04-articles-artifact-and-pipeline.
export interface ArticleSection {
  id: string;
  heading: string;
  intent: string;
  body: string;
}

export const articles = sqliteTable(
  'articles',
  {
    id: text('id').primaryKey().$defaultFn(() => nanoid()),
    // Owning profile. Scoped exactly like the phase-1 content tables: NOT NULL with the
    // 'default' sentinel default so the generated ALTER stays valid; the real profile id is
    // threaded in by every writer/route. See design 01-profile-model.
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id)
      .default('default'),
    // The queue item this piece grew from — carries its pillar, silo (a web piece kind),
    // platform ('web'), and tone. The long-form lane reuses that classification.
    ideaId: text('idea_id')
      .notNull()
      .references(() => ideaQueueItems.id),
    title: text('title').notNull().default(''),
    // URL slug, unique per profile (see the composite index below). Nullable and unset until
    // the outline stage: SQLite treats NULLs as distinct in a UNIQUE index, so many not-yet-
    // slugged articles coexist in one profile without colliding.
    slug: text('slug'),
    targetKeyword: text('target_keyword').notNull().default(''),
    searchIntent: text('search_intent').notNull().default(''),
    metaDescription: text('meta_description').notNull().default(''),
    lengthTarget: integer('length_target').notNull().default(0),
    // Legacy structured representation (outline + prose per section). Superseded by `body`
    // as the editing surface; kept for backfill of pre-restructure rows. New writes leave
    // it empty.
    sections: text('sections', { mode: 'json' })
      .$type<ArticleSection[]>()
      .notNull()
      .$defaultFn(() => []),
    // The whole article as one markdown document (headings inline). The single editing
    // surface: the Queue workbench edits it, the AI writes it, export renders it.
    body: text('body').notNull().default(''),
    // Pipeline position: outlining | outlined | drafting | drafted | reviewed | exported.
    stage: text('stage').notNull().default('outlining'),
    // Mirrors drafts.reviewStatus: pending | passed | failed | edited | approved
    // ('approved' = the owner's manual "Mark reviewed" sign-off).
    reviewStatus: text('review_status').notNull().default('pending'),
    exportPath: text('export_path'),
    exportedAt: integer('exported_at'),
    createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at').notNull().$defaultFn(() => Date.now()),
  },
  (t) => ({
    profileSlugUniq: uniqueIndex('articles_profile_slug_uniq').on(t.profileId, t.slug),
    profileIdIdx: index('articles_profile_id_idx').on(t.profileId),
    ideaIdIdx: index('articles_idea_id_idx').on(t.ideaId),
  }),
);
