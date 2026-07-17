// Typed fetch client for the local Express API. All calls are same-origin and
// proxied by Vite from /api to http://localhost:5174/api during dev.

// Pillar keys are user-defined in profile/identity.yaml, so the console cannot
// know them at compile time. Kept as a documented string alias (phase 02 widened
// the server-side Pillar type the same way).
export type Pillar = string
export interface PillarInfo {
  key: string
  label: string
}
export type QueueTag = 'needs-your-take' | 'ready-to-draft'
export type QueueStatus = 'new' | 'seeded' | 'drafting' | 'drafted' | 'published' | 'archived'
export type ReviewStatus = 'pending' | 'passed' | 'failed' | 'edited'
// A post's intent (its job), orthogonal to its pillar (its topic). Platform-keyed
// roster, server-side source of truth in src/core/silos.ts. LinkedIn: conversation,
// teach, win, curate. Reddit: discuss, help, share, ask, curate. Web (long-form): the
// five piece kinds. `curate` is shared by LinkedIn and Reddit; every other key belongs
// to exactly one platform.
export type Silo =
  | 'conversation' | 'teach' | 'win' // LinkedIn-only
  | 'discuss' | 'help' | 'share' | 'ask' // Reddit-only
  | 'curate' // shared (LinkedIn + Reddit)
  | 'how-to' | 'explainer' | 'comparison' | 'thought-piece' | 'whitepaper' // web-only

// A content platform — the register axis's key set (src/core/registers.ts). Distinct
// from PlatformKey below, which is the Connections screen's account roster.
export type ContentPlatform = 'linkedin' | 'reddit' | 'web'

// IDs are opaque nanoid strings across every table (phase 01 canonical).
// A web idea's article, as the queue GET attaches it: the SEO fields plus the whole
// piece as one markdown `body` (the server flattens legacy structured sections into it).
export interface QueueArticle {
  id: string
  title: string
  slug: string | null
  targetKeyword: string
  searchIntent: string
  metaDescription: string
  lengthTarget: number
  body: string
  stage: string
  reviewStatus: ReviewStatus
  exportPath: string | null
}

export interface IdeaQueueItem {
  id: string
  pillar: Pillar
  silo: Silo
  tag: QueueTag
  sourceRef: string | null
  proposedAngle: string
  seed: string | null
  // The developed take: 2-4 supporting points (beats of the argument). Empty until
  // the develop skill or the hand editor fills them; draft uses them as the spine.
  points: string[]
  score: number
  status: QueueStatus
  createdAt: number
  // The register the idea was shaped for (set by spark/discovery; null for older rows).
  platform?: ContentPlatform | null
  tone?: string | null
  // The written content riding with the idea (queue GET join): the latest draft for a
  // post idea, the article for a web idea. The queue is the review phase — a card shows,
  // edits, and publishes this content directly.
  draft?: Draft | null
  article?: QueueArticle | null
}

export interface Source {
  id: string
  kind: string
  name: string
  url: string | null
  enabled: boolean
  pillar: Pillar | null
  keywords: string[]
  defaultTag: string
  config: Record<string, unknown>
}

export interface NewSource {
  kind: string
  name: string
  url: string
  pillar: Pillar | null
  keywords: string[]
  default_tag: string
  curated: boolean
  enabled: boolean
}

// One feed's outcome from a discovery run (mirrors src/ingest/discover-rss FeedRunResult).
export interface FeedRunResult {
  sourceId: string
  name: string
  parsed: number
  added: number
  error?: string
}

export interface FeedRunSummary {
  perFeed: FeedRunResult[]
  totalAdded: number
}

export interface Draft {
  id: string
  ideaId: string
  hookOptions: string[]
  body: string
  close: string
  mediaSuggestion: string
  reviewStatus: ReviewStatus
  createdAt: number
  // Resolved server-side from idea_queue_items.platform via ideaId — NOT a column
  // on the drafts table. Optional because the current drafts route returns the raw
  // row without it; the editor treats any non-'reddit' value (including undefined)
  // as the LinkedIn path.
  platform?: PlatformKey
}

export interface PublishedPost {
  id: string
  // Null for web rows (an exported article has no draft; `id` is the article id).
  draftId: string | null
  permalink: string | null
  publishedAt: number
  // Resolved server-side (post -> draft -> idea). Null when the chain is broken.
  // Optional because the PATCH response returns the raw row without it.
  pillar?: string | null
  // Set only for posts published through the API (server returns linkedin_urn).
  // Null for manually-tracked posts — gates whether delete/comment/like apply.
  linkedinUrn?: string | null
  // The channel the piece went to. 'web' rows are exported long-form articles (the
  // exported file is the web lane's shipped artifact). Optional so legacy/raw rows
  // without it read as LinkedIn.
  platform?: PlatformKey | 'web'
  // For Reddit rows, the stored destination the post went to (r/<sub> or u/<owner>).
  destination?: string | null
  // Web rows only: the article's title and the exported file's local path. Null for
  // post-lane rows.
  title?: string | null
  exportPath?: string | null
}

// A planned-post slot from the scheduled_posts table (GET /api/scheduled).
export interface ScheduledPost {
  id: string
  draftId: string
  plannedFor: number | null
  status: string
  pillar: string | null
  title: string | null
}

export type TriageState = 'inbox' | 'saved' | 'promoted' | 'archived'

export interface Tag {
  id: string
  name: string
  slug: string
  color?: string | null
  // Present only on GET /api/tags (how many feed items carry the tag); the discovery
  // inbox join returns tags without it, hence optional.
  usageCount?: number
}

// A feed_item plus its joined tags, as returned by GET /api/discovery/inbox.
export interface InboxItem {
  id: string
  sourceId: string
  externalId: string
  title: string
  url: string | null
  summary: string | null
  publishedAt: number | null
  fetchedAt: number
  triageState: TriageState
  archivedAt: number | null
  promotedIdeaId: string | null
  score: number | null
  tags: Tag[]
}

const BASE = '/api'

// Start LinkedIn OAuth by navigating the browser here (window.open/location, NOT
// fetch) — the server redirects to LinkedIn's consent screen and the callback
// page closes itself. Status afterward comes from GET /api/connections.
export const LINKEDIN_CONNECT_PATH = '/api/auth/linkedin'

// Dashboard aggregate shapes, computed server-side from the real DB and returned
// by /overview and /pillars/stats. Declared here so the views share one source of
// truth for their shape.
export interface PillarStat {
  pillar: string
  label: string
  posts: number
  queue: number
}
export interface FunnelStage {
  key: string
  label: string
  count: number
}
export interface OverviewData {
  funnel: FunnelStage[]
  reviewPassRate: number
  cadencePerWeek: number
  needsTake: IdeaQueueItem[]
  recent: PublishedPost[]
}

// Database browser (read-only introspection of the local SQLite file).
export interface DbTableInfo {
  name: string
  label: string
  category: string
  description: string
  rowCount: number
}
export interface DbColumn {
  name: string
  type: string
  notnull: boolean
  pk: boolean
}
export interface DbTableData {
  name: string
  label: string
  category: string
  description: string
  columns: DbColumn[]
  rowCount: number
  filteredCount: number
  rows: Record<string, unknown>[]
  limit: number
  offset: number
}
export interface DbQueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  truncated: boolean
  error?: string
}

export interface DbTableQuery {
  limit?: number
  offset?: number
  sort?: string
  dir?: 'asc' | 'desc'
  filters?: Record<string, string>
}

// Platform connection status (GET /api/connections). Identity/status only —
// there is deliberately no token field, so a secret can never travel on this
// contract. Access tokens and client secrets stay server-side (root .env).
export type PlatformKey = 'linkedin' | 'reddit' | 'x' | 'newsletter'
export interface Connection {
  platform: PlatformKey
  connected: boolean
  displayName: string | null
  avatarUrl: string | null
  headline: string | null
  connectedAt: number | null
  scopes: string[]
}

// A profile in the multi-profile registry (GET /api/profiles). name is the display name;
// kind drives the setup interview variant; active marks the current selection; complete is
// the profile's completeness result. Profiles live in profiles/<slug>/ and are authored via
// the setup skill, never invented in the console.
export interface Profile {
  id: string
  name: string
  kind: 'personal' | 'brand'
  active: boolean
  complete: boolean
  // What setup still has to fill, in the completeness check's own words. Empty when
  // complete. The Voice page's setup surface renders this as the checklist.
  missing: string[]
  // Whether interview.md holds any saved answers yet (setup appends after every
  // question). Lets the setup surface say "resume" instead of "this profile is empty"
  // after an interrupted interview.
  interviewStarted: boolean
}
export interface NewProfile {
  name: string
  kind: 'personal' | 'brand'
}

// Extended profile payload (GET /api/profile) consumed by the Voice page: the
// voice-card markdown text plus the structured pillars/CTA/feed context.
export interface ProfileData {
  name: string
  pillars: PillarInfo[]
  voiceCard: string
  ctaPolicy: string
  feedSources: string[]
}

// Inline anti-slop findings (POST /api/review). rule/severity/message/matches
// mirror the Finding shape in src/review/voice-checks.ts 1:1; spans is
// additive, giving char offsets into the reviewed text so the editor can
// highlight offending runs.
export type FindingSeverity = 'fail' | 'warn'
export interface ReviewFinding {
  rule: string
  severity: FindingSeverity
  message: string
  matches: string[]
  spans?: { start: number; end: number }[]
}

// Generic JSON client: perform the fetch, throw on any non-ok status (including
// 404), return undefined on 204, otherwise parse JSON. A missing route or a down
// server now surfaces as a thrown error the caller renders as its error state.
async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${method} ${path} failed: ${res.status} ${detail}`)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// http() for plain-text responses (a brand document's raw contents).
async function httpText(path: string): Promise<string> {
  const res = await fetch(BASE + path)
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`GET ${path} failed: ${res.status} ${detail}`)
  }
  return res.text()
}

export interface Skill {
  name: string
  description: string
  kind: 'skill' | 'agent'
  invocation: string
}

// Editable pillar config (key/label/weight) read from and written to identity.yaml.
export interface PillarConfig {
  key: string
  label: string
  weight: number
}

// The register axis. The menu is committed structure (src/core/registers.ts), read-only;
// the selection is per-user config in identity.yaml, editable.
export interface RegisterTone {
  key: string
  label: string
  guidance: string
}
export interface RegisterPlatformMenu {
  key: string
  label: string
  format: string
  tones: RegisterTone[]
  themes: RegisterTone[]
}
export interface RegisterToneSelection {
  key: string
  note: string
}
export interface RegisterPlatformSelection {
  key: string
  active: boolean
  default: boolean
  tones: RegisterToneSelection[]
  themes: RegisterToneSelection[]
}
export interface RegisterConfig {
  menu: RegisterPlatformMenu[]
  selection: RegisterPlatformSelection[]
}

// The long-form pipeline position (articles.stage). Advances mostly via skills
// (outline→outlined, section draft→drafted, reviewer→reviewed, export→exported); the
// console's Advance / Move-back control can also set it by hand. Lives on the article.
export type ArticleStage =
  | 'outlining' | 'outlined' | 'drafting' | 'drafted' | 'reviewed' | 'exported'

// One ordered section: the outline note (heading + intent) and the written prose (body).
// `id` is a stable per-section id (server nanoid; the console mints one with
// crypto.randomUUID() for a hand-added section). Outline stage sets heading/intent with
// body empty; the draft stage fills body. Design 04's single-array decision.
export interface ArticleSection {
  id: string
  heading: string
  intent: string
  body: string
}

// Light list row (GET /api/articles): no section bodies. `silo` and `pillar` are joined
// server-side from the linked idea_queue_items row (platform=web) — NOT columns on the
// article — mirroring how Draft.platform is resolved via ideaId.
export interface ArticleSummary {
  id: string
  ideaId: string
  title: string
  targetKeyword: string
  stage: ArticleStage
  reviewStatus: ReviewStatus
  exportPath: string | null
  exportedAt: number | null
  createdAt: number
  updatedAt: number
  silo: Silo
  pillar: Pillar
}

// Full article (GET /api/articles/:id): the summary plus the SEO fields and sections.
export interface Article extends ArticleSummary {
  slug: string
  searchIntent: string
  metaDescription: string
  lengthTarget: number
  sections: ArticleSection[]
}

// PATCH body for /api/articles/:id. Every field optional; a content write (sections /
// title / body-bearing field) resets reviewStatus to pending server-side, exactly like
// the drafts path. `stage` is the non-content Advance / Move-back write.
export interface ArticlePatch {
  title?: string
  slug?: string
  targetKeyword?: string
  searchIntent?: string
  metaDescription?: string
  lengthTarget?: number
  /** The whole article as one markdown document — the editing surface. */
  body?: string
  sections?: ArticleSection[]
  stage?: ArticleStage
}

// An image attached to a queue idea (the images table). Produced by the imagery
// skill (generated image / composed graphic / annotated screenshot / Unsplash pick)
// or uploaded here;
// the file itself lives under gitignored data/images/ and is served by
// GET /api/images/:id/file. `source` + `params` are the provenance the card shows.
export type ImageSource = 'composed' | 'screenshot' | 'unsplash' | 'upload' | 'generated'
export interface ImageAttachment {
  id: string
  ideaId: string
  source: ImageSource
  path: string
  alt: string
  width: number
  height: number
  params: Record<string, unknown>
  createdAt: number
}

// Preview URL for an attached image — same-origin, proxied like every API call.
export function imageFileUrl(id: string): string {
  return `/api/images/${id}/file`
}

// A transient candidate the imagery skill has generated but not attached yet — a
// file under data/images/previews/<ideaId>/, no DB row. The Images strip polls
// these while an imagery session runs so candidates appear as they finish; the
// skill removes them once a pick is attached.
export interface ImagePreview {
  name: string
  mtimeMs: number
}

export function imagePreviewUrl(ideaId: string, name: string): string {
  return `/api/images/previews/${encodeURIComponent(ideaId)}/${encodeURIComponent(name)}`
}

// The active profile's brand look (GET /api/brand) — the gitignored
// profiles/<slug>/brand/ folder the imagery pipeline reads before producing any
// image. Edited on the Brand page (or by the `brand` skill / by hand).
export interface BrandState {
  brandDir: string
  // Whether ANY brand material exists (brand.yaml or uploaded logos/refs/docs).
  exists: boolean
  // Whether a look is saved (brand.yaml on disk) — false means the colors/fonts
  // shown are the neutral fallback, even if material is uploaded.
  lookSaved: boolean
  colors: { primary: string; accent: string; background: string; foreground: string; muted: string }
  fonts: { heading: string; body: string }
  // The card default (brand/-relative path, one of `logos`), or null for no logo.
  logo: string | null
  // Every logo variant on disk under brand/logos/ (brand/-relative paths).
  logos: string[]
  styleNotes: string
  refs: string[]
  docs: string[]
}

// Bytes of any image inside the brand folder (logo thumbnails etc.).
export function brandAssetUrl(relPath: string): string {
  return `/api/brand/asset?path=${encodeURIComponent(relPath)}`
}

// Local image generation status. `backend`/`configured` describe the config's
// DEFAULT model (what Image with AI uses); `models` is the whole named roster from
// image-generation.config.json with per-model availability (mflux command installed
// / Draw Things API reachable). Generation is local and key-free, so this is just
// capability status, not a secret.
export interface GeneratorModelStatus {
  name: string
  backend: 'mflux' | 'drawthings' | 'gemini' | string
  model: string | null
  available: boolean
  // Owner intent, distinct from `available`: false = switched off in the config
  // (`"enabled": false`), so don't offer it at all. Absent = an older API without
  // the field, which means on.
  enabled?: boolean
  // Whether the model's weights are already downloaded. false = usable but the
  // first generation pays a one-time multi-GB download; null = the backend
  // manages its own models (Draw Things) or has none (Gemini runs in the cloud);
  // absent = an older API without the check.
  weightsCached?: boolean | null
  default: boolean
}
export interface GeneratorStatus {
  backend: 'mflux' | 'drawthings' | string
  configured: boolean
  defaultModel?: string
  models?: GeneratorModelStatus[]
}

export const api = {
  // Queue: server returns items sorted by score desc.
  getQueue: () => http<IdeaQueueItem[]>('/queue'),

  // Images attached to a queue idea (see ImageAttachment above).
  getImages: (ideaId: string) => http<ImageAttachment[]>(`/images?ideaId=${encodeURIComponent(ideaId)}`),
  // Unattached candidates from a running imagery session (see ImagePreview above).
  getImagePreviews: (ideaId: string) =>
    http<ImagePreview[]>(`/images/previews?ideaId=${encodeURIComponent(ideaId)}`),
  // Promote a candidate into a real attachment (alt required); removes the preview.
  attachImagePreview: (ideaId: string, name: string, alt: string) =>
    http<ImageAttachment>('/images/previews/attach', {
      method: 'POST',
      body: JSON.stringify({ ideaId, name, alt }),
    }),
  // Discard one candidate, or all of an idea's candidates.
  deleteImagePreview: (ideaId: string, name: string) =>
    http<void>(
      `/images/previews/${encodeURIComponent(ideaId)}/${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    ),
  clearImagePreviews: (ideaId: string) =>
    http<void>(`/images/previews?ideaId=${encodeURIComponent(ideaId)}`, { method: 'DELETE' }),
  // Is local image generation set up? (backend + reachable/installed)
  getGeneratorStatus: () => http<GeneratorStatus>('/images/generator-status'),
  uploadImage: (ideaId: string, dataBase64: string, mimeType: string, alt: string) =>
    http<ImageAttachment>('/images/upload', {
      method: 'POST',
      body: JSON.stringify({ ideaId, dataBase64, mimeType, alt }),
    }),
  updateImageAlt: (id: string, alt: string) =>
    http<ImageAttachment>(`/images/${id}`, { method: 'PATCH', body: JSON.stringify({ alt }) }),
  deleteImage: (id: string) => http<void>(`/images/${id}`, { method: 'DELETE' }),

  // An image pasted/dropped into the terminal drawer. Unlike uploadImage these
  // attach to nothing — the returned path is typed into the pty for claude to read.
  uploadTerminalImage: (dataBase64: string, mimeType: string) =>
    http<{ path: string; name: string }>('/terminal/images', {
      method: 'POST',
      body: JSON.stringify({ dataBase64, mimeType }),
    }),

  // The active profile's brand look (the Brand page; see BrandState above).
  getBrand: () => http<BrandState>('/brand'),
  saveBrand: (patch: {
    colors?: Partial<BrandState['colors']>
    fonts?: Partial<BrandState['fonts']>
    styleNotes?: string
  }) => http<{ ok: boolean }>('/brand', { method: 'PUT', body: JSON.stringify(patch) }),
  uploadBrandLogo: (filename: string, dataBase64: string) =>
    http<{ ok: boolean; name: string }>('/brand/logos', {
      method: 'POST',
      body: JSON.stringify({ filename, dataBase64 }),
    }),
  deleteBrandLogoFile: (relPath: string) =>
    http<void>(`/brand/logos?path=${encodeURIComponent(relPath)}`, { method: 'DELETE' }),
  setDefaultBrandLogo: (relPath: string | null) =>
    http<{ ok: boolean; logo: string | null }>('/brand/default-logo', {
      method: 'PUT',
      body: JSON.stringify({ path: relPath }),
    }),
  uploadBrandRef: (filename: string, dataBase64: string) =>
    http<{ ok: boolean; name: string }>('/brand/refs', {
      method: 'POST',
      body: JSON.stringify({ filename, dataBase64 }),
    }),
  deleteBrandRef: (name: string) =>
    http<void>(`/brand/refs/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  uploadBrandDoc: (filename: string, content: string) =>
    http<{ ok: boolean; name: string }>('/brand/docs', {
      method: 'POST',
      body: JSON.stringify({ filename, content }),
    }),
  getBrandDoc: (name: string) => httpText(`/brand/docs/${encodeURIComponent(name)}`),
  deleteBrandDoc: (name: string) =>
    http<void>(`/brand/docs/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  // Seeding an item records the user's take (may be empty) and advances it toward drafting.
  seedQueueItem: (id: string, seed: string) =>
    http<IdeaQueueItem>(`/queue/${id}/seed`, {
      method: 'POST',
      body: JSON.stringify({ seed }),
    }),

  // The queue's approve action: ship the idea's content and move it to Published.
  // web = export the markdown (export IS publish); reddit / manually-posted linkedin =
  // record the publish (permalink optional). API-backed LinkedIn publishing stays on
  // publishLinkedin (the type-PUBLISH-gated modal).
  publishQueueItem: (id: string, permalink?: string) =>
    http<{ ok: boolean; exportPath?: string }>(`/queue/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(permalink ? { permalink } : {}),
    }),

  // Set the developed points (the 2-4 beats) on a queue item — the console's hand editor.
  setQueuePoints: (id: string, points: string[]) =>
    http<IdeaQueueItem>(`/queue/${id}/points`, {
      method: 'POST',
      body: JSON.stringify({ points }),
    }),

  // Pillars come from the active profile (GET /api/pillars) so badges label correctly.
  getPillars: () => http<PillarInfo[]>('/pillars'),

  // Platform connections (GET /api/connections). Reports honest not-linked status
  // derived from the profile identity — no OAuth, no token on the wire.
  getConnections: () => http<Connection[]>('/connections'),

  // Profiles registry + the active-profile switch (GET /api/profiles, PUT /api/active-profile,
  // POST /api/profiles). setActiveProfile writes the pointer server-side; the switcher hard-
  // reloads afterward so every profile-scoped view refetches. createProfile makes an empty
  // profile and switches to it — the onboarding gate then offers setup.
  getProfiles: () => http<Profile[]>('/profiles'),
  setActiveProfile: (profileId: string) =>
    http<Profile>('/active-profile', { method: 'PUT', body: JSON.stringify({ profileId }) }),
  createProfile: (input: NewProfile) =>
    http<Profile>('/profiles', { method: 'POST', body: JSON.stringify(input) }),
  // Deletes a NON-ACTIVE profile: all its content rows, the profiles row, and its
  // profiles/<slug>/ dir on disk. The server 400s on the active profile.
  deleteProfile: (profileId: string) =>
    http<void>(`/profiles/${profileId}`, { method: 'DELETE' }),

  // Ends the LinkedIn session server-side (POST /api/auth/linkedin/disconnect) —
  // clears the stored token, 204 on success. Caller should reload getConnections().
  disconnectLinkedin: () => http<void>('/auth/linkedin/disconnect', { method: 'POST' }),

  // Publishes a draft to LinkedIn for real (POST /api/publish/linkedin). Throws on
  // 503 (not configured) / 409 (not connected) / 401 (expired) / 404 / 502 (LinkedIn
  // rejected it) — caller renders the thrown message. Media precedence server-side
  // is images/image > linkUrl > text. Each image entry is either inline bytes
  // (dataBase64+mimeType) or an attached card image by imageId (the server reads the
  // file itself); two or more entries make a LinkedIn multi-photo post.
  publishLinkedin: (
    draftId: string,
    visibility: 'PUBLIC' | 'CONNECTIONS',
    opts?: {
      linkUrl?: string
      image?: { dataBase64?: string; mimeType?: string; alt?: string; imageId?: string }
      images?: { dataBase64?: string; mimeType?: string; alt?: string; imageId?: string }[]
    },
  ) =>
    http<PublishedPost>('/publish/linkedin', {
      method: 'POST',
      body: JSON.stringify({ draftId, visibility, ...opts }),
    }),

  // Removes an API-published post from LinkedIn itself (DELETE .../:postId). 400s
  // if the post has no linkedinUrn (never published through the API).
  deleteLinkedinPost: (postId: string) => http<void>(`/publish/linkedin/${postId}`, { method: 'DELETE' }),
  // Adds a comment to an API-published post — e.g. the "link in the first comment" pattern.
  commentLinkedinPost: (postId: string, text: string) =>
    http<unknown>(`/publish/linkedin/${postId}/comment`, { method: 'POST', body: JSON.stringify({ text }) }),
  // Likes an API-published post. Server soft-handles an already-liked post as success.
  likeLinkedinPost: (postId: string) =>
    http<{ ok: boolean }>(`/publish/linkedin/${postId}/like`, { method: 'POST' }),

  // Reddit has no API methods: it's a manual copy-paste channel. A Reddit draft
  // is authored and previewed in the console, then sent out with "Copy to publish"
  // (api.publishDraft), which copies the text and archives the row — no OAuth,
  // no direct submit, no delete.

  // Extended profile (GET /api/profile): name, pillars, voice card, CTA policy,
  // and feed sources, all returned by the real route.
  getProfile: () => http<ProfileData>('/profile'),

  // Editable pillar config (key/label/weight), read from and written to identity.yaml.
  // savePillars replaces the whole list; the server validates and preserves file comments.
  getPillarsConfig: () => http<{ pillars: PillarConfig[] }>('/config/pillars'),
  savePillars: (pillars: PillarConfig[]) =>
    http<{ pillars: PillarConfig[] }>('/config/pillars', {
      method: 'PUT',
      body: JSON.stringify({ pillars }),
    }),

  // Register axis: the shipped menu (read-only) plus the user's selection, and a writer
  // for the selection only. saveRegister replaces the platforms list in identity.yaml.
  getRegisterConfig: () => http<RegisterConfig>('/config/register'),
  saveRegister: (platforms: RegisterPlatformSelection[]) =>
    http<{ platforms: RegisterPlatformSelection[] }>('/config/register', {
      method: 'PUT',
      body: JSON.stringify({ platforms }),
    }),

  // Voice card: read the raw markdown and overwrite it. The card is authored by the
  // setup interview and refined by the voice skill; saveVoiceCard is the
  // console's manual editor floor. The server rejects an empty card (400).
  getVoiceCard: () => http<{ voiceCard: string }>('/config/voice-card'),
  saveVoiceCard: (voiceCard: string) =>
    http<{ voiceCard: string }>('/config/voice-card', {
      method: 'PUT',
      body: JSON.stringify({ voiceCard }),
    }),

  // Run the mechanical voice checks over draft text (POST /api/review). POST so
  // draft content never lands in a URL/query string. Empty array means clean.
  // isProductAdjacent drives the cta-rule severity (fail for personal posts,
  // warn for product-adjacent posts carrying more than one ask).
  postReview: (text: string, isProductAdjacent: boolean, silo?: Silo) =>
    http<ReviewFinding[]>('/review', {
      method: 'POST',
      body: JSON.stringify({ text, isProductAdjacent, silo }),
    }),

  // Frontend-only health probe. Uses a RAW fetch (NOT http()) against /api/profiles —
  // the one endpoint that succeeds even with zero profiles — so the badge measures
  // "is the server up", not "does a profile exist". Drives the topbar badge.
  checkHealth: async (): Promise<'live' | 'offline'> => {
    try {
      const res = await fetch('/api/profiles', { method: 'GET' })
      return res.ok ? 'live' : 'offline'
    } catch {
      return 'offline'
    }
  },

  getSources: () => http<Source[]>('/sources'),
  addSource: (input: NewSource) =>
    http<Source>('/sources', { method: 'POST', body: JSON.stringify(input) }),
  runAllFeeds: () => http<FeedRunSummary>('/sources/run', { method: 'POST' }),
  runFeed: (id: string) => http<FeedRunResult>(`/sources/${id}/run`, { method: 'POST' }),
  updateSource: (id: string, input: Partial<NewSource>) =>
    http<Source>(`/sources/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteSource: (id: string) =>
    http<{ ok: true; deletedItems: number }>(`/sources/${id}`, { method: 'DELETE' }),

  getDrafts: () => http<Draft[]>('/drafts'),
  getDraft: (id: string) => http<Draft>(`/drafts/${id}`),
  updateDraft: (id: string, patch: Partial<Draft>) =>
    http<Draft>(`/drafts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  publishDraft: (id: string, permalink?: string) =>
    http<PublishedPost>(`/drafts/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(permalink ? { permalink } : {}),
    }),

  // Long-form list (GET /api/articles), newest/in-progress first, joined to each idea
  // for silo + pillar. Light payload — no section bodies; the detail load carries those.
  getArticles: () => http<ArticleSummary[]>('/articles'),
  // One article in full, sections included — the detail editor's load.
  getArticle: (id: string) => http<Article>(`/articles/${id}`),
  // Save edits through the same shared writer the skill CLI uses (PATCH /api/articles/:id).
  // Returns the updated article row — the route (03) queries `articles` directly with no
  // idea join, so silo/pillar are absent; every call site here discards the return value and
  // calls onChanged() to refetch the joined detail instead.
  updateArticle: (id: string, patch: ArticlePatch) =>
    http<Omit<Article, 'silo' | 'pillar'>>(`/articles/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  // Save the whole ordered sections array back (the outline pane's plain floor). Same
  // route/writer as updateArticle; a dedicated name keeps the call site self-describing.
  setArticleSections: (id: string, sections: ArticleSection[]) =>
    http<Omit<Article, 'silo' | 'pillar'>>(`/articles/${id}`, { method: 'PATCH', body: JSON.stringify({ sections }) }),
  // Write the Markdown file to data/exports/<profileId>/<slug>.md. The route (03) returns the
  // updated article row (same unjoined shape as PATCH) plus exportPath at top level — the
  // button surfaces res.exportPath. NOT a browser download; the server writes the file.
  exportArticle: (id: string) =>
    http<Omit<Article, 'silo' | 'pillar'>>(`/articles/${id}/export`, { method: 'POST' }),
  // Delete the article row and (when no draft references it) the queue idea it grew
  // from; the raw spark capture stays in the sparks log. `ideaDeleted` reports which.
  deleteArticle: (id: string) =>
    http<{ ok: boolean; ideaDeleted: boolean }>(`/articles/${id}`, { method: 'DELETE' }),
  // Delete a draft (409 if it was published — the archive references it). Its calendar
  // plan goes with it; the idea stays and flips back to seeded when this was its only draft.
  deleteDraft: (id: string) =>
    http<{ ok: boolean; ideaReseeded: boolean }>(`/drafts/${id}`, { method: 'DELETE' }),
  // Delete a queue idea and everything downstream: its drafts (and their calendar plans)
  // and, for a web idea, its article row. 409 if any of its drafts was published.
  deleteQueueItem: (id: string) =>
    http<{ ok: boolean; draftsDeleted: number; articleDeleted: boolean }>(`/queue/${id}`, {
      method: 'DELETE',
    }),

  // Update a published post's permalink after the fact (PATCH /api/posts/:id).
  updatePost: (id: string, patch: { permalink?: string | null }) =>
    http<PublishedPost>(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  addSpark: (text: string) =>
    http<{ id: string }>('/sparks', { method: 'POST', body: JSON.stringify({ text }) }),

  // Published archive (GET /api/posts), newest first. An empty array is honest —
  // it means nothing has been published yet.
  getPosts: () => http<PublishedPost[]>('/posts'),

  // Planned-post slots (GET /api/scheduled), soonest first. Backs the Calendar's
  // "planned" markers with the real scheduled_posts table; empty until scheduled.
  getScheduled: () => http<ScheduledPost[]>('/scheduled'),

  // Discovery inbox: server-filtered by state/tags/search, returned with joined tags.
  getInbox: (opts?: { group?: string; tags?: string[]; q?: string; state?: string }) => {
    const params = new URLSearchParams()
    if (opts?.group) params.set('group', opts.group)
    if (opts?.tags && opts.tags.length) params.set('tags', opts.tags.join(','))
    if (opts?.q) params.set('q', opts.q)
    if (opts?.state) params.set('state', opts.state)
    const qs = params.toString()
    return http<InboxItem[]>(`/discovery/inbox${qs ? `?${qs}` : ''}`)
  },
  archiveItem: (id: string) => http<InboxItem>(`/discovery/${id}/archive`, { method: 'POST' }),
  unarchiveItem: (id: string) => http<InboxItem>(`/discovery/${id}/unarchive`, { method: 'POST' }),
  // Save-for-later: the pre-queue shortlist. saveItem moves an inbox item to 'saved';
  // unsaveItem returns it to the inbox. No take required — that's what promote asks for.
  saveItem: (id: string) => http<InboxItem>(`/discovery/${id}/save`, { method: 'POST' }),
  unsaveItem: (id: string) => http<InboxItem>(`/discovery/${id}/unsave`, { method: 'POST' }),
  promoteItem: (id: string, comment: string, silo: Silo = 'teach') =>
    http<{ id: string }>(`/discovery/${id}/promote`, {
      method: 'POST',
      body: JSON.stringify({ comment, silo }),
    }),

  // Dashboard aggregates, computed server-side from the real DB.
  getOverview: () => http<OverviewData>('/overview'),
  // Per-pillar pipeline coverage (posts + queue depth) — powers the Pillars page.
  getPillarStats: () => http<PillarStat[]>('/pillars/stats'),

  // Database browser.
  getDbTables: () => http<{ tables: DbTableInfo[]; categoryOrder: string[] }>('/database/tables'),
  getDbTable: (name: string, q?: DbTableQuery) => {
    const params = new URLSearchParams()
    if (q?.limit != null) params.set('limit', String(q.limit))
    if (q?.offset != null) params.set('offset', String(q.offset))
    if (q?.sort) params.set('sort', q.sort)
    if (q?.dir) params.set('dir', q.dir)
    for (const [col, val] of Object.entries(q?.filters ?? {})) {
      if (val) params.set(`f.${col}`, val)
    }
    const qs = params.toString()
    return http<DbTableData>(`/database/tables/${name}${qs ? `?${qs}` : ''}`)
  },
  runDbQuery: (sql: string) =>
    http<DbQueryResult>('/database/query', { method: 'POST', body: JSON.stringify({ sql }) }),

  getTags: () => http<Tag[]>('/tags'),
  createTag: (name: string) =>
    http<Tag>('/tags', { method: 'POST', body: JSON.stringify({ name }) }),
  // Rename and/or recolor a tag. Slug is frozen server-side; color: null clears it.
  updateTag: (id: string, patch: { name?: string; color?: string | null }) =>
    http<Tag>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  // Delete a tag; server cascades the feed_item_tags join rows in one transaction.
  deleteTag: (id: string) => http<void>(`/tags/${id}`, { method: 'DELETE' }),
  attachTag: (id: string, tagId: string) =>
    http<{ feedItemId: string; tagId: string }>(`/discovery/${id}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagId }),
    }),
  detachTag: (id: string, tagId: string) =>
    http<void>(`/discovery/${id}/tags/${tagId}`, { method: 'DELETE' }),

  // Repo-local skills + agents discovered by the server (GET /api/skills). Drives
  // the terminal drawer's quick-command chips; adding a skill surfaces a chip.
  getSkills: () => http<Skill[]>('/skills'),

  // Capability probe for skill surfaces (GET /api/skill-surface/health). Reports
  // whether a headless Claude session *could* start — never whether one is
  // running. Raw fetch so a down server reports unavailable rather than throwing.
  checkSkillSurface: async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/skill-surface/health', { method: 'GET' })
      if (!res.ok) return false
      const body = (await res.json()) as { available?: boolean }
      return Boolean(body.available)
    } catch {
      return false
    }
  },
}
