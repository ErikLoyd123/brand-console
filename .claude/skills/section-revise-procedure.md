# Section-revise procedure (shared reference)

Non-invokable shared procedure — the single written source for revising **named sections** of a
long-form `web` article, in the active profile's voice, preserving every other section. Referenced by
the `articles` page skill; the skill routes here when the request is to revise/sharpen a section. This
is the long-form analog of `revise-procedure.md` (which revises a whole short-form draft): here you
sharpen one or a few sections, never the whole piece by default.

It **never invents an opinion** and never contradicts the owner's take. The argument is theirs —
carried in the idea's `seed`/`points` and the section's `intent` — and the voice is fixed by the voice
card. This skill sharpens the expression of a named section, not the position, and it does not review
(the gate is `content-reviewer`) or export.

**Invoke with:** "revise the intro section of article N", "the comparison section buries the point",
"tighten the how-to steps section", or from the Articles page's per-section **"Revise with AI"** button
(which passes the article id and the section id/heading and says to use them — take them directly, do
not ask which).

## Onboarding gate (run before revising)

```bash
npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
```

If `voice-card.md` is missing/incomplete, say so and offer `setup`; stop gracefully if declined.

## Rule one — load the voice card

Load the active profile's voice card via the `voice-card` skill before touching a word: em-dash ban,
AI-tells, show-don't-tell, CTA rule, protected relationships. Every revision obeys it. If it will not
load, stop.

## 1. Pick the article and the section(s)

If the first message gives an article id and a section id/heading (the console button passes them),
**use them directly.** Otherwise resolve the article and read its sections so the owner can name which
to revise:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {articles,ideaQueueItems}=await import('./src/db/schema.js');const {eq}=await import('drizzle-orm');const a=db.select().from(articles).where(eq(articles.id,process.argv[1])).get();const idea=a?db.select().from(ideaQueueItems).where(eq(ideaQueueItems.id,a.ideaId)).get():null;console.log(JSON.stringify({article:a,idea},null,2))})" "<articleId>"
```

Note each section's `id`, `heading`, `intent`, and current `body`; and the idea's `seed`/`points` and
`silo` (the piece kind — never contradict the take). Resolve the owner's words ("the intro section",
"the comparison table section") to the specific section `id`(s). If ambiguous, show the headings and
ask which.

## 2. Refine only the named section(s) — never the rest

Interview lightly, or act on the directive the owner already gave. Common moves within a section:
tighten baggy prose, restructure around the section's `intent`, strengthen the specific/concrete
(show-don't-tell), scrub every AI-tell and em dash, fix a heading that undersells the section.

- Preserve every section the owner did not name. Do not touch their `body`, `heading`, or `intent`.
- Do not add a claim, an opinion, or a specific that is not in the take/points; an unprovided specific
  is a `[FILL: ...]` marker, surfaced.
- When you propose a rewrite, show it and confirm before writing — the owner's judgment governs.

## 3. Write it back

Patch only the named section(s) by their `id`. Use `sectionPatches` (not `sections` — `sections` is a
full-array replacement; `sectionPatches` merges by `id` and preserves every field you omit). Write the
payload to a temp file and pass its path:

```bash
cat > /tmp/revise-<articleId>.json <<'JSON'
{
  "id": "<articleId>",
  "sectionPatches": [
    { "id": "<named section id>", "heading": "<revised heading, if changed>", "body": "<revised body>" }
  ]
}
JSON
npx tsx src/articles/update-article.ts /tmp/revise-<articleId>.json
```

Include only the sections you revised and only the fields you changed within them; the writer patches
by `id` (via `sectionPatches`) and leaves every other section, and every field you omitted, untouched.
Any content write resets the article's `reviewStatus` to `pending` (a revised section is no longer
covered by a prior review) — this is the writer's built-in behavior, so do not set `reviewStatus`
yourself; `content-reviewer` remains the pass/fail authority. An unknown article id or section id is
surfaced verbatim — fix and retry.

## 4. Report

Report plainly which section(s) you changed and the gist of each revision, so the owner sees it at a
glance. This is the console's result card: one clear, human sentence per section touched.

## Rules

- **Only the named sections' fields** (`body`, `heading` — never `intent` unless asked). Read the idea
  and the voice card for context; never write the queue idea, the voice card, the rosters, or code.
- **Never invent or shift the opinion.** The take and the section intents are the owner's; you sharpen
  the expression, never the position. If a revision would change what a section argues, stop and ask.
- **Obey the voice card**, every rule — a revision that breaks one is worse than the original.
- **Preserve everything untouched**, one article per run, then report. Never review your own work and
  never export.
