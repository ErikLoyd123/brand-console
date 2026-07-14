# Develop procedure (shared reference)

This is a shared, **non-invokable** procedure — the single written source for developing a
queue idea (drawing out the owner's take and the 2-4 points). It is referenced by the `queue`
page skill, not run directly as a button. The `queue` skill routes here when the request is to
develop/flesh out a queue item.

Take one **queue idea** from a bare angle to a **developed take** — the shape between
"I should write about this" and a finished draft. A developed idea carries the owner's take
(`seed`) plus 2-4 **points**: the beats of the argument they'd actually make, in order. That is
what the draft procedure then uses as the spine of the body. This skill draws those beats out and
saves them; it never drafts, reviews, or publishes.

It is the substance step of the ladder: **Discovery inbox → saved → (develop) → Queue with real
insight → Draft.** A spark arrives with a take but usually no beats; a promoted article arrives
with your one-line take and the source. Either way, the develop procedure turns it into something with meat.

It **never invents the opinion or the beats.** They come from the owner, grounded in the item,
its source, and the voice card. The owner decides; the skill files.

**Invoke with:** "develop this idea", "flesh out item N", "what are the points here", "help me
develop my queue", or from the Queue page's AI mode.

## Onboarding gate (run before developing)

There must be a profile and a queue to work on. Profiles are gitignored under `profiles/<slug>/`:

```bash
npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
```

If `identity.yaml` is missing entirely, say so and offer `setup`; stop gracefully if declined.

## 1. Pick the item

If the first message already gives an item id (the console's per-card "Develop with AI" button
passes one and says not to ask), **use that id directly — skip listing and skip the question.**
Likewise if the user named one in words ("item N", "the AWS savings one"), resolve and use it.
Only when no item is identified: list the queue best-first and ask which to develop (prefer ones
that are thin — a bare angle, no points yet):

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {ideaQueueItems}=await import('./src/db/schema.js');const {desc}=await import('drizzle-orm');const rows=db.select().from(ideaQueueItems).orderBy(desc(ideaQueueItems.score)).all();console.log(JSON.stringify(rows.map(r=>({id:r.id,angle:r.proposedAngle,silo:r.silo,pillar:r.pillar,hasSeed:Boolean(r.seed),points:r.points.length,sourceRef:r.sourceRef})),null,2))})"
```

Resolve the user's words to one `id`. If ambiguous, show the candidates and ask.

## 2. Read the item and its context

Load the full item and the material to ground the beats in — never generic:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {ideaQueueItems}=await import('./src/db/schema.js');const {eq}=await import('drizzle-orm');console.log(JSON.stringify(db.select().from(ideaQueueItems).where(eq(ideaQueueItems.id, process.argv[1])).get(),null,2))})" "<id>"
```

- Note the `seed` (the current take), `points` (any beats so far), `silo` (the intent — it
  shapes what "a good beat" is: a `teach` post's beats are steps; a `conversation` post's beats
  open a loop), `pillar`, and `sourceRef`.
- **If `sourceRef` is a URL** (a promoted article), read the source so the beats engage the
  actual piece, not a guess — fetch it if you can, otherwise work from the title/summary and
  ask the owner what in it caught them.
- Load the active profile's voice card via the **`voice-card` skill** (the same loader every
  drafter uses) for the owner's rules, patterns, and hook formulas so the beats sound like them
  and respect the hard rules (no invented opinions, show-don't-tell, etc).

## 3. Draw out the take and the beats — never supply them

Interview at the depth the idea needs. The substance is the owner's:

- **The take (`seed`).** If it's thin or missing, draw out the one thing they actually believe
  here — one or two sentences, their words. For a `needs-your-take` item this is required before
  the idea can draft; for a promoted article it sharpens the one-liner into a real position.
- **The points (2-4 beats).** Ask what they'd actually say, in order — the tension only they
  see, the concrete example, the turn, what it means for the reader. Propose candidate beats
  **drawn from their take and the source**, then have them confirm or rewrite each. Do not invent
  a position; if they can't supply the substance, stop rather than fill it in.
- Keep it to 2-4 beats. More than that is a draft, not a developed idea. Fewer than two is still
  a bare angle — push gently for at least two unless the piece is genuinely a single move.

## 4. Write it

Save the developed take and beats onto the item. Only the fields you drew out are written (a
points-only or take-and-points develop are both fine):

```bash
npx tsx src/ingest/develop-idea.ts "<id>" '{
  "seed": "<the owner's one-to-two-sentence take, if you sharpened it>",
  "points": ["<beat 1>", "<beat 2>", "<beat 3>"]
}'
```

Writing a `seed` advances the item to `seeded` so it reads as handled. An unknown id is
surfaced verbatim — fix and retry, do not guess.

## 5. Report

Report plainly what landed: the item, its take in one line, and the beats you saved (quoted), so
the owner sees exactly what the idea now carries. This is the console's result card — one clear,
human sentence plus the beats.

## Rules

- **Only the queue item's `seed` and `points`.** Read the source, the item, and the voice card
  for context; never write the voice card, pillars, register, feeds, or code, and never touch a
  different item.
- **Never invent the opinion or the beats.** They are the owner's, drawn out and confirmed. If
  the owner won't supply the substance, stop — a developed idea with a fabricated argument is
  worse than a bare angle.
- **2-4 beats, in order, in their voice**, consistent with the item's silo and the voice card's
  hard rules. Respect show-don't-tell and the AI-tells list. The mechanical rules bind every
  string this procedure saves — the seed and each beat carry no em dashes and no AI-tells
  (doctrine Principle 4, voice-rules-everywhere), not just the eventual piece.
- **One item per run**, then report. Never draft, review, or publish — the draft procedure turns the
  developed idea into prose; this skill only gives it meat.
