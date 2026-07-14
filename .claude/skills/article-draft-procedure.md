# Article draft procedure (shared reference)

This is a shared, **non-invokable** procedure — the single written source for writing a
long-form `web` article as **one markdown document** in one pass. It is referenced by the
`queue` page skill and by `spark`/`discovery` when they carry a web idea straight into the
full write; it is never run as its own button. It replaces the retired outline and
section-draft procedures: with the Queue as the review phase, a long-form piece goes from
take to full draft in a single sitting, and the owner reviews the whole document on its
queue card.

Input is a `web` queue idea (take + points + piece kind) and its `articles` row (created at
intake by `create-article`, carrying the SEO inputs). Output is the article's `body` — the
whole piece as markdown — plus its `metaDescription` and `slug`, saved with stage
`drafted`. It never publishes (the queue card's Publish/export is the owner's action) and
never reviews its own work (`content-reviewer` is the gate).

It **never invents the argument.** Take-origination (`.claude/skills/content-doctrine.md`)
binds: the owner's `seed` is the spine, their `points` are the beats, and any real fact
they have not supplied is a `[FILL: ...]` marker, never a plausible guess.

## Onboarding gate (run before writing)

```bash
npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
```

If the active profile's `voice-card.md` is missing/incomplete, say so and offer `setup`;
stop gracefully if declined. Do not write in a voice that does not exist.

## Rule one — load the voice card

Load the active profile's voice card via the `voice-card` skill before writing a word.
Headings and prose are shaped in the owner's voice and must respect the hard rules (the
em-dash ban, the AI-tells blocklist, show-don't-tell, the CTA rule, protected
relationships). If it will not load, stop.

## 1. Load the article and its idea

If the first message gives an article or idea id, use it directly — do not ask which.
Read the article row and the `web` queue idea it grew from:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {articles,ideaQueueItems}=await import('./src/db/schema.js');const {eq}=await import('drizzle-orm');const a=db.select().from(articles).where(eq(articles.id,process.argv[1])).get();const idea=a?db.select().from(ideaQueueItems).where(eq(ideaQueueItems.id,a.ideaId)).get():null;console.log(JSON.stringify({article:a,idea},null,2))})" "<articleId>"
```

(When you only have the idea id, look the article up by `ideaId` instead — `create-article`
is idempotent, so a missing article row means intake never finished; create it first.)

Note the article's `title`, `targetKeyword`, `searchIntent`, `lengthTarget`, and any
existing `body`; and the idea's `silo` (the piece kind), `seed` (the owner's take),
`points` (the beats), and `tone`. Read the piece kind's guidance:

```bash
npx tsx -e "import('./src/core/silos.ts').then(m => console.log(m.getSiloGuidance(process.argv[1])))" "<siloKey>"
```

## 2. The take-origination guardrail

If the idea is `needs-your-take` with no `seed`: STOP. Report that the piece needs the
owner's take before it can be written. An agent does not get to decide what the owner
argues. When a `seed` exists, it is the piece's spine — expand and shape it, never
contradict it, never add a position it does not contain.

## 3. Confirm the shape — one light ask

Sketch the structure internally from the take, the points, and the kind's guidance, then
confirm it with **one** question: the proposed section headings as a short list, one line
each ("I'd structure it: verdict first → what changed → the numbers → when gp2 still wins →
how to migrate. Good?"). The owner nods or redirects; incorporate and move on. One ask, not
a walk — the full-document review happens on the queue card afterward.

## 4. Write the whole piece

Write the article as **one markdown document**: `##` section headings inline (no top-level
`#` — the export prepends the title), prose in the owner's voice, ordered by the confirmed
structure with the owner's points worked in order. Calibrate length to the kind's guidance
and `lengthTarget` (guidance, not a gate). Work the `targetKeyword` into the lead heading
naturally. Real specifics the owner has not given are `[FILL: ...]` markers.

Also produce:

- `metaDescription` — 150-160 characters, carrying the target keyword, plain and honest.
- `slug` — kebab-case from the title, only if the article has none yet.
- `title` — only if the article's is empty; it should carry the target keyword.

## 5. Save

Write everything back through the shared CLI (a JSON payload file, so the multi-line body
never fights shell escaping), advancing the stage to `drafted`:

```bash
cat > .article-payload.json <<'JSON'
{
  "id": "<articleId>",
  "body": "<the full markdown document>",
  "metaDescription": "<150-160 chars>",
  "slug": "<kebab-slug, when newly set>",
  "stage": "drafted"
}
JSON
npx tsx src/articles/update-article.ts .article-payload.json
rm .article-payload.json
```

## 6. Self-check before reporting

Run the mechanical voice checks over the body (`SILO` is the piece kind; `ADJACENT=1` only
for a `how-to` that genuinely touches a profile product) and the SEO checks over the saved
fields — the same commands `content-reviewer` uses (`src/review/voice-checks.ts`,
`src/review/seo-checks.ts` with `{title, body, targetKeyword, metaDescription}`). Fix any
`fail` before reporting; `warn`s are judgment calls worth naming in the report.

## 7. Report and stop

Report the article id and idea id, that the full draft now sits on the idea's **Queue
card** (the review phase: read it there, edit by hand, or revise with AI), that
`content-reviewer` is the voice/SEO gate, and that **Publish on the card exports the
markdown file** — publish is the owner's call, never this procedure's.

## Rules

- NEVER write without the voice card loaded.
- NEVER invent the take, a beat, or a fact — seed is the spine; `[FILL: ...]` for missing
  specifics.
- One markdown document: `##` headings inline, no structured sections array — the `body`
  field is the piece.
- No em dashes, no AI-tells, and the CTA policy binds (only a genuinely product-adjacent
  `how-to` may carry one soft ask).
- Never publishes, never reviews its own work, never flips reviewStatus by hand.
