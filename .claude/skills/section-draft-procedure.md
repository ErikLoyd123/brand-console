# Section-draft procedure (shared reference)

Non-invokable shared procedure — the single written source for drafting the section bodies of a
long-form `web` article, one section at a time, in the active profile's voice. Referenced by the
`articles` page skill; the skill routes here when the request is to draft/write the sections.

Turn an **outlined** article (ordered sections with headings and intents, empty bodies) into a
**drafted** one: each section's `body` written in the owner's voice, respecting that section's
`intent`, plus the `metaDescription` filled. Bodies are written **one section at a time** so a
2,000-word piece never has to land in a single generation. This drafts prose; it never reviews its own
work (the gate is `content-reviewer`) and never exports.

It **never invents the opinion or a fact.** The argument is the owner's — carried in the queue idea's
`seed`/`points` and the section `intent`s — and every specific the owner did not provide is a
`[FILL: ...]` marker, never a guess (`.claude/skills/content-doctrine.md`).

**Invoke with:** "draft the sections for article N", "write the body", or from the Articles page's
**"Draft sections with AI"** button (which passes the article id and says to use it — take it
directly).

## Onboarding gate (run before drafting)

```bash
npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
```

If `voice-card.md` is missing/incomplete, say so and offer `setup`; stop gracefully if declined. Do
not draft in a voice that does not exist.

## Rule one — load the voice card

Load the active profile's voice card via the `voice-card` skill before writing a word: the em-dash
ban, the AI-tells blocklist, show-don't-tell, the CTA rule, and the profile's guardrails. Every
section obeys it. If it will not load, stop.

## 1. Pick the article

If the first message gives an article id (the console button passes one), **use it directly.**
Otherwise list articles at the `outlined` stage and ask:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {articles}=await import('./src/db/schema.js');const {desc,inArray}=await import('drizzle-orm');const rows=db.select().from(articles).where(inArray(articles.stage,['outlined','drafting'])).orderBy(desc(articles.updatedAt)).all();console.log(JSON.stringify(rows.map(r=>({id:r.id,title:r.title,stage:r.stage,sections:r.sections.map(s=>({id:s.id,heading:s.heading,hasBody:Boolean(s.body)}))})),null,2))})"
```

## 2. Read the article, its idea, and the register

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {articles,ideaQueueItems}=await import('./src/db/schema.js');const {eq}=await import('drizzle-orm');const a=db.select().from(articles).where(eq(articles.id,process.argv[1])).get();const idea=a?db.select().from(ideaQueueItems).where(eq(ideaQueueItems.id,a.ideaId)).get():null;console.log(JSON.stringify({article:a,idea},null,2))})" "<articleId>"
```

Note each section's `id`, `heading`, and `intent`; the idea's `seed`/`points` (the argument the bodies
carry) and `silo` (the piece kind). Read the piece kind's guidance so each section serves the kind:

```bash
npx tsx -e "import('./src/core/silos.ts').then(m => console.log(m.getSiloGuidance(process.argv[1])))" "<siloKey>"
```

Resolve the register (tone) that colors the prose. A `web` article's platform is `web` (the piece
kind's silo key implies it, so pass `web` regardless of the idea's stored platform), and its tone is
the idea's `tone` (may be null — the profile's default `web` tone is then used):

```bash
npx tsx -e "import('./src/core/resolve-register.ts').then(m => console.log(JSON.stringify(m.resolveRegisterFromProfile('web', process.argv[1] || null), null, 2)))" "<idea tone or empty>"
```

Note `toneLabel`, `toneGuidance`, `toneNote`, and `format`. These **color** the prose; the piece
kind's guidance and the voice card still govern shape and pass/fail. Tone is never a hard rule.

## 3. Draft each section body — one at a time, in the owner's voice

Work the `sections` in order. For each section, write its `body` as markdown prose that fulfils its
`intent`, carries the relevant beat(s) from the idea's `points`, and reads in the owner's voice colored
by the resolved tone. Long-form voice rules from the card apply exactly as short-form: show-don't-tell,
no em dashes, no AI-tells, generous not corrective. Use `###` subheadings within a section only when it
genuinely needs them; never restate the section's own `##` heading inside its body.

- Never contradict the idea's take, and never add an argument the outline's intents do not carry.
- Any specific real detail the owner has not provided (a number, a named tool, a customer, a benchmark)
  is a `[FILL: ...]` marker, surfaced — never a plausible guess.
- Draft and confirm section by section rather than dumping the whole piece; the owner approves each.

## 4. Write the meta description

Write a `metaDescription`: a single sentence, 150-160 characters, that includes the `targetKeyword`,
in the owner's plain voice. It is the `<meta name="description">` copy; the review gate's SEO check
flags an empty meta, a missing keyword, and a length outside 150-160.

## 5. Write it back

Patch the section bodies by their `id`, set the meta description, and advance the stage to `drafted`.
Use `sectionPatches` (not `sections` — `sections` is a full-array replacement; `sectionPatches` merges
by `id` and preserves each section's `heading`/`intent`). Write the payload to a temp file (bodies are
long and multi-line) and pass its path:

```bash
cat > /tmp/sections-<articleId>.json <<'JSON'
{
  "id": "<articleId>",
  "metaDescription": "<150-160 char meta including the target keyword>",
  "stage": "drafted",
  "sectionPatches": [
    { "id": "<section 1 id>", "body": "<section 1 markdown body>" },
    { "id": "<section 2 id>", "body": "<section 2 markdown body>" }
  ]
}
JSON
npx tsx src/articles/update-article.ts /tmp/sections-<articleId>.json
```

`update-article` patches only the sections named by `id` in `sectionPatches` (their `heading`/`intent`
are preserved) and, as on the drafts path, resets `reviewStatus` to `pending` on any content write — a
freshly drafted article is not yet covered by a review. It bumps `updatedAt`. An unknown id is surfaced
verbatim.

## 6. Self-check before handing off

Concatenate the section bodies into one text file and run the mechanical voice checks with the piece
kind's adjacency — only a `how-to` may be product-adjacent (`siloMayBeProductAdjacent`); the other four
kinds are never adjacent. From the repo root, first write the concatenated bodies to a temp file:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {articles}=await import('./src/db/schema.js');const {eq}=await import('drizzle-orm');const a=db.select().from(articles).where(eq(articles.id,process.argv[1])).get();const {writeFileSync}=await import('node:fs');writeFileSync(process.argv[2], a.sections.map(s=>s.body).join('\n\n'), 'utf8')})" "<articleId>" "/tmp/article-<articleId>.txt"
```

Then run the checks with the full article text in `DRAFT`:

```bash
DRAFT="$(cat /tmp/article-<articleId>.txt)" SILO=<siloKey> ADJACENT=<0|1> npx tsx -e "(async () => { const { loadIdentity } = await import('./src/profile/loader.ts'); const identity = loadIdentity(); const m = await import('./src/review/voice-checks.ts'); console.log(JSON.stringify(m.runVoiceChecks(process.env.DRAFT ?? '', { isProductAdjacent: process.env.ADJACENT === '1', silo: process.env.SILO, protectedRelationships: identity.protected_relationships ?? [], products: identity.products ?? [] }), null, 2)); })()"
```

Fix anything that fails before handing off. This is a self-check, not the gate — `content-reviewer` is
the pass/fail authority and also runs the SEO checks.

## 7. Report / hand off

Report the article id, that its sections are drafted, and the meta description, plus the resolved
register (platform `web` + tone) so the reviewer has the soft context. The article still has to pass
`content-reviewer` (voice + per-kind guidance + SEO checks) and then the owner's edit-and-approve, and
finally export. To sharpen any one section, loop through `section-revise-procedure.md`. Nothing here
publishes.

## Rules

- NEVER draft without loading the voice card first.
- NEVER invent an opinion or a fact — the idea's take/points and the section intents are the spine; an
  unprovided specific is a `[FILL: ...]` marker, surfaced.
- NEVER use an em dash or an AI-tell from the blocklist. Only a `how-to` may be product-adjacent, and
  then only per `identity.yaml`'s products + CTA policy; the other four kinds carry no ask.
- Draft **section by section**; write bodies by section `id`, preserving headings and intents. Fill the
  meta description (150-160 chars, includes the target keyword).
- One article per run. Never review your own work (that is `content-reviewer`) and never export.
