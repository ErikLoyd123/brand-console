# Outline procedure (shared reference)

This is a shared, **non-invokable** procedure — the single written source for outlining a long-form
`web` article (drawing the argument's shape into ordered sections). It is referenced by the `articles`
page skill, not run directly as a button. The `articles` skill routes here when the request is to
outline / build the sections of an article.

Take one **article** from an intake stub (a `web` queue idea plus an empty `articles` row) to a
**structured outline**: an ordered `sections` array where each entry has a `heading` and an `intent`
(what that section must accomplish) and an empty `body`. It also sets the `slug` and may propose a
`lengthTarget`. This is the long-form analog of developing a queue idea's beats — it draws the
structure out and saves it; it never writes prose, reviews, or exports.

It **never invents the argument.** The structure comes from the owner, grounded in the queue idea's
take, its source, the piece kind's guidance, and the voice card. Take-origination
(`.claude/skills/content-doctrine.md`) binds: the owner decides what the piece argues and in what
order; the skill draws it out and files it.

**Invoke with:** "outline this article", "build the outline for article N", "what are the sections",
or from the Articles page's **"Outline with AI"** button (which passes the article id in the first
message and says to use it — take that id directly, do not ask which).

## Onboarding gate (run before outlining)

There must be a populated active profile to work in. Profiles are gitignored under `profiles/<slug>/`:

```bash
npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
```

If `identity.yaml` or `voice-card.md` is missing/incomplete, say so and offer `setup`; stop
gracefully if declined. Do not outline a piece for a profile that does not exist.

## Rule one — load the voice card

Load the active profile's voice card via the `voice-card` skill (it reads the active profile's `voice-card.md`)
before drawing the outline. Headings and section intents are shaped in the owner's voice and must
respect the hard rules. If it will not load, stop.

## 1. Pick the article

If the first message gives an article id (the console button passes one and says not to ask), **use it
directly.** Otherwise resolve the article the user means, or list articles still at the outlining stage
and ask:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {articles}=await import('./src/db/schema.js');const {desc,inArray}=await import('drizzle-orm');const rows=db.select().from(articles).where(inArray(articles.stage,['outlining','outlined'])).orderBy(desc(articles.updatedAt)).all();console.log(JSON.stringify(rows.map(r=>({id:r.id,title:r.title,slug:r.slug,stage:r.stage,sections:r.sections.length})),null,2))})"
```

## 2. Read the article and its queue idea

Load the article row and the `web` queue idea it grew from — its silo (the piece kind), pillar, take
(`seed`), and points — so the outline engages the real material, never a guess:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {articles,ideaQueueItems}=await import('./src/db/schema.js');const {eq}=await import('drizzle-orm');const a=db.select().from(articles).where(eq(articles.id,process.argv[1])).get();const idea=a?db.select().from(ideaQueueItems).where(eq(ideaQueueItems.id,a.ideaId)).get():null;console.log(JSON.stringify({article:a,idea},null,2))})" "<articleId>"
```

Note the article's `title`, `targetKeyword`, `searchIntent`, and any existing `sections`; and the
idea's `silo` (the piece kind — how-to, explainer, comparison, thought-piece, whitepaper), `pillar`,
`seed`, `points`, and `sourceRef`. If `sourceRef` is a URL, read the source so the structure engages
what the piece actually says.

## 3. Read the piece kind's guidance

The silo here is a `web` piece kind, and its guidance shapes what a good outline is (a comparison must
actually compare; a how-to must leave the reader able to do the thing). Read it from the committed
roster:

```bash
npx tsx -e "import('./src/core/silos.ts').then(m => console.log(m.getSiloGuidance(process.argv[1])))" "<siloKey>"
```

Let that guidance shape the outline — the sections a piece of this kind needs.

## 4. Draw out the argument's shape — never supply it

Interview the owner for the structure at the depth the piece needs, one question per turn (the
interview style of `spark` and `setup`, never a wall of questions):

- **The through-line.** What is the one thing this piece establishes, start to finish? Ground it in
  the idea's `seed`/`points`; sharpen, never replace.
- **The sections, in order.** Propose candidate `## headings` **drawn from the take, the source, and
  the kind's guidance**, each with a one-line `intent` (what that section must accomplish). Have the
  owner confirm, reorder, or rewrite each. Do not invent an argument the owner does not hold; if they
  cannot supply the substance, stop rather than fill it in.
- **Length target.** Propose a `lengthTarget` word count from the kind's typical range (the `web`
  register's `format` note in `src/core/registers.ts` gives soft ranges); the owner overrides. It is
  guidance, not a gate.

Keep the outline to the sections the piece actually needs — typically 3-7 for most kinds, more for a
whitepaper. Each section is one movement of the argument.

## 5. Write the outline

Derive a URL `slug` from the title (lowercase, hyphenated, no stopword noise). Write the sections
array — each entry `{ id, heading, intent, body: "" }` with an empty body — plus the slug, the length
target, and advance the stage to `outlined`. `update-article` does not mint section ids itself (its
`sections` field is a full-array replacement, written verbatim); mint a short stable id per section
yourself, in order — `s1`, `s2`, `s3`, ... — so the draft and revise procedures can patch each one
by `id` later. Because sections can be many and multi-line, write the payload to a temp file and pass
its path (never a shell arg), exactly like the draft procedures do:

```bash
cat > /tmp/outline-<articleId>.json <<'JSON'
{
  "id": "<articleId>",
  "slug": "<url-slug>",
  "lengthTarget": 1200,
  "stage": "outlined",
  "sections": [
    { "id": "s1", "heading": "<section 1 heading>", "intent": "<what section 1 must accomplish>", "body": "" },
    { "id": "s2", "heading": "<section 2 heading>", "intent": "<what section 2 must accomplish>", "body": "" }
  ]
}
JSON
npx tsx src/articles/update-article.ts /tmp/outline-<articleId>.json
```

This is a full-array write (the `sections` field), so include every section, each with its own `id`,
in one call. It bumps `updatedAt`. An unknown article id is surfaced verbatim — fix and retry, do not
guess.

## 6. Report

Report plainly what landed: the article, its slug, the length target, and the ordered headings with
their one-line intents, so the owner sees the shape before any prose is written. This is the console's
result card. The next step is `section-draft-procedure.md` (write the section bodies); the owner
approves the outline first.

## Rules

- **Only the article's `sections` (heading/intent, empty body), `slug`, `lengthTarget`, and
  `stage`.** Read the idea, the source, the kind's guidance, and the voice card for context; never
  write the queue idea, the voice card, the rosters, or code.
- **Never invent the argument or its structure.** The through-line and the sections are the owner's,
  drawn out and confirmed. If the owner will not supply the substance, stop — an outline with a
  fabricated argument is worse than none.
- **Empty bodies only.** The outline stage sets `heading` and `intent`; `body` stays empty until the
  section-draft stage. Never write prose here.
- **One article per run**, then report. Never draft section bodies, review, or export.
