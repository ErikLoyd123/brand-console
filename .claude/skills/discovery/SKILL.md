---
name: discovery
description: Work up a discovered article into a queued take. Reads a Discovery inbox item and its source, infers the intent (silo) and confirms it, interviews you to draw out your take and the 2-4 points, then promotes it into the queue with those beats attached — and offers to carry straight on into the draft (or, for a web piece, the outline). The discovery-lane mirror of spark. Never invents an opinion.
type: skill
---

# discovery

Turn a discovered article into a **queued, developed take** before anything gets drafted.
`discovery` is the discovery-lane sibling of `spark`: where `spark` shapes a raw spark, `discovery`
shapes an inbox **feed item** — a piece someone else wrote that you reacted to. It reads the
item and its source, works out what *kind* of post your reaction wants to be, interviews you
at the depth that kind needs, draws out your take and the beats of your argument, and promotes
the item straight into the queue with those beats attached.

It sits one rung below `queue` on the ladder: **Discovery inbox → (discovery) → Queue with a
real take + beats → Draft.** The plain **Promote** button on the Discovery card is the
zero-shaping fast path (type a one-line take, land a bare seeded item, develop it later);
`discovery` is the deliberate sibling for when a discovered piece is worth shaping now.

`discovery` **never invents the opinion or the beats.** They come from you, grounded in the item,
its source, and the voice card. You decide; the skill files. It never drafts, reviews, or
publishes — `queue` turns the queued take into prose.

**Invoke with:** "work up this article", "work up item N", "help me shape my take on this",
or from the Discovery page's per-card **"Work up with AI"** button (which passes the feed-item
id in the first message and says to use it — take that id directly, do not ask which item).

## 1. Onboarding gate (run before anything)

Run this first. This is the shared detect-and-offer gate (`.claude/skills/onboarding-gate.md`).

1. Check the active profile. Profiles are gitignored under `profiles/<slug>/`; a fresh clone ships only
   `profile.example/`. Run:

   ```bash
   npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
   ```

   `checkCompleteness()` (from `src/profile/completeness.ts`) returns
   `{ complete: boolean, missing: string[] }`.

2. `discovery` needs `identity.yaml` present (to resolve the platform and silo roster) and reads
   the active profile's `voice-card.md` to ground the take in your voice. If `identity.yaml` is present,
   pass the gate and continue. Otherwise go to step 3.

3. Report plainly that the profile is not set up yet and offer to run the `setup` skill now.
   One clear question with a recommended path; name the alternative in step 5.

4. If the user accepts: hand off to `setup`, let it write the profile, then resume.

5. If the user declines: stop gracefully. `setup` is a separate skill; the gate only names and
   offers it.

## 2. The doctrine (read first)

`discovery` obeys the shared content doctrine (`.claude/skills/content-doctrine.md`) — the single
source for **take-origination** (never invent an opinion), **never-fabricate-a-fact**
(`[FILL: ...]` markers, never a plausible guess), and **depth-calibration** (depth is a
function of silo × register). The **seed** is the unit that must stay your own thought; any
`[FILL: ...]` goes in the seed or a beat. The doctrine binds every step below.

## 3. Pick the feed item

If the first message already gives a feed-item id (the console's "Work up with AI" button
passes one and says not to ask), **use that id directly — skip listing and skip the question.**
Likewise if the user named one in words ("item N", "the AWS piece"), resolve and use it. Only
when no item is identified: list the inbox best-first (highest score first) and ask which to
work up:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {feedItems,sources}=await import('./src/db/schema.js');const {desc,eq,inArray}=await import('drizzle-orm');const rows=db.select().from(feedItems).where(inArray(feedItems.triageState,['inbox','saved'])).orderBy(desc(feedItems.score)).all();const srcs=new Map(db.select().from(sources).all().map(s=>[s.id,s]));console.log(JSON.stringify(rows.map(r=>({id:r.id,title:r.title,source:srcs.get(r.sourceId)?.name,pillar:srcs.get(r.sourceId)?.pillar,score:r.score,state:r.triageState})),null,2))})"
```

Resolve the user's words to one `id`. If ambiguous, show the candidates and ask.

## 4. Read the item and its source

Load the full feed item and its source so the take engages the actual piece, never a guess:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {feedItems,sources}=await import('./src/db/schema.js');const {eq}=await import('drizzle-orm');const item=db.select().from(feedItems).where(eq(feedItems.id,process.argv[1])).get();const src=item?db.select().from(sources).where(eq(sources.id,item.sourceId)).get():null;console.log(JSON.stringify({item,source:src},null,2))})" "<feedItemId>"
```

- Note the `title`, `summary`, `url`, the source `name` and `pillar`, and `score`. If
  `promotedIdeaId` is already set, the item is promoted — stop and say so rather than
  double-promote.
- **If `url` is present**, read the source so your take engages what the piece actually says —
  fetch it if you can; otherwise work from the title/summary and ask what in it caught you.
- Read **the active profile's `voice-card.md`** for your rules, patterns, and hook formulas so the take and
  beats sound like you and respect the hard rules (no invented opinions, show-don't-tell, etc).

## 5. Infer-and-confirm the silo

Read the item and your reaction and propose **the single most likely silo in one line, with
brief reasoning** — "this reads like a curate (passing a good piece along), not a hot take,
right?" It is a **proposal, not an assertion**; you nod or redirect. No up-front taxonomy quiz.

Feed items are LinkedIn candidates by default, so propose from the LinkedIn roster in
`src/core/silos.ts` (`conversation | teach | win | curate`). A reaction that adds a genuine argument
is often `conversation` or `teach`; a generous "you should read this" is `curate`. Propose exactly
one; move on the moment it is confirmed. The confirmed silo sets the interview depth (Step 6).

If the owner wants to work the piece up as a **long-form `web` article** instead of a LinkedIn post,
propose from the `web` roster's piece kinds (`how-to | explainer | comparison | thought-piece |
whitepaper`). A `web` reaction is the long-form lane: it takes the same take-and-beats interview
below, plus the two SEO inputs in Step 6, and Step 7 side-writes an `articles` row.

## 6. Draw out the take and the beats — never supply them

Interview at the **depth the confirmed silo demands** (deep for `conversation` — 1-3 sharp
questions mining the cross-domain friction; light for `teach`/`win`/`curate` — usually one
well-aimed question). One question per turn, in the interview style of `spark` and `setup`;
never a wall of questions.

- **The take (`seed`).** Draw out the one thing you actually believe in reaction to this piece —
  one or two sentences, your words. This is required: a queued item with no take is a bare
  angle, which is what the plain Promote button already makes.
- **The points (2-4 beats).** Ask what you would actually say, in order — the tension only you
  see, the concrete example, the turn, what it means for the reader. Propose candidate beats
  **drawn from your take and the source**, then have you confirm or rewrite each. Do not invent
  a position; if you cannot supply the substance, stop rather than fill it in.
- Keep it to 2-4 beats. Any specific real detail you have not provided (a number, which tool,
  what actually happened) is a `[FILL: ...]` marker, surfaced — never a guess.

**Web only — capture the two SEO inputs.** When the confirmed silo is a `web` piece kind, also draw
out, one plain question each, the **target keyword** (the single phrase the piece targets) and the
**search intent** (who is searching and why, in the owner's words). These are the owner's, never
invented; an unknown keyword is a `[FILL: ...]` marker. They ride onto the `articles` row in Step 7.

## 7. Promote it into the queue

Write the developed take and beats onto a new queue idea and flip the feed item to promoted, in
one step, via the shared promote CLI. From the repo root:

```bash
npx tsx src/ingest/promote-item.ts "<feedItemId>" '{
  "seed": "<your one-to-two-sentence take>",
  "silo": "<conversation|teach|win|curate|how-to|explainer|comparison|thought-piece|whitepaper>",
  "points": ["<beat 1>", "<beat 2>", "<beat 3>"]
}'
```

The CLI creates a seeded `idea_queue_items` row (pillar inherited from the source, tag
`ready-to-draft`, status `seeded`) with your seed and points, and sets the feed item to
`promoted`. It prints the new idea id. An already-promoted or unknown feed item exits non-zero
with the reason on stderr — surface it verbatim, do not retry blindly.

**Web only — side-write the article row.** When the promoted idea is a `web` piece kind, take the
`<ideaId>` the CLI printed in backticks and side-write the long-form `articles` row carrying the SEO
inputs from Step 6, via the shared create CLI:

```bash
npx tsx src/articles/create-article.ts "<ideaId>" '{
  "title": "<a working title from your take>",
  "targetKeyword": "<the target keyword, or a [FILL: ...] marker>",
  "searchIntent": "<the search intent in your words>"
}'
```

`create-article` is idempotent per `ideaId` (a re-run never double-creates) and prints the new article
id in backticks. The article lands at stage `outlining`; the `articles` skill's outline procedure is
the next step. `promoteFeedItem` does not store a platform column, but the `web` piece-kind silo key
is globally unique, so downstream reads the platform as `web` from the silo. For a LinkedIn reaction
there is no article row and this step is skipped. When it applies, report the article id alongside the
idea id.

## 8. Keep going — offer to draft it now

The promoted idea (and, for web, the article row) is saved and safe whatever happens next. The
owner just gave you their take and beats — do not make them re-run the pipeline to see it
written. Ask **one light closing question** — "It's promoted to the queue. Want me to draft it
now, or leave it there?" — with drafting as the recommended option.

If the owner says draft:

- **LinkedIn** — follow the shared draft procedure (`.claude/skills/draft-procedure.md`) with
  the just-created idea id. The take and beats are already on the row, so it drafts straight
  from what this interview produced. Report the draft id and that it awaits review.
- **web** — follow the shared outline procedure (`.claude/skills/outline-procedure.md`) with
  the just-created article id to draw the sections with the owner; when the outline lands,
  confirm there and continue into the section bodies via
  `.claude/skills/section-draft-procedure.md`. Stopping after the outline is a fine answer.

If the owner declines, stop as before. Either way, everything the interview drew out was
persisted **before** any drafting started.

## 9. Report

Report plainly what landed: the idea it became, your take in one line, and the beats saved
(quoted), so you see exactly what the queue now carries. **Report the created idea id in
backticks, labeled — `promoted to idea \`<ideaId>\``** — so the console's result card can deep-link
to it in the Queue (name the article or draft too when Step 8 went further, so the card lands on
the right screen). This is the surface's result card: one clear human sentence plus the beats.

## Hand off

Report what exists when the run ends — the idea id always; the article id for web; the draft id
when Step 8 drafted. The rest of the pipeline is unchanged: `queue` can add or refine beats on a
queued item and turns a developed take into prose silo-aware, and `content-reviewer` judges
every draft by its silo's rules. `discovery` never reviews or publishes.

## Rules

- Obey the doctrine (`.claude/skills/content-doctrine.md`): never invent an opinion, never
  fabricate a fact, calibrate depth by silo. The silo proposal (Step 5) is a proposal.
- **Never invent the opinion or the beats.** They are yours, drawn out and confirmed. If you
  cannot supply the substance, stop — a promoted idea with a fabricated argument is worse than a
  bare angle the plain Promote button would have made.
- **2-4 beats, in order, in your voice**, consistent with the confirmed silo and the voice
  card's hard rules. Respect show-don't-tell and the AI-tells list.
- **Only promotes one feed item per run**, then reports. Writes through
  `src/ingest/promote-item.ts` (the seeded idea + the promoted flag) and, for a `web` piece kind,
  `src/articles/create-article.ts` (the linked article row); never the voice card, pillars,
  register, feeds, or code, and never a different item.
- Never review or publish. Drafting happens only via the shared procedures, only after the
  promoted idea is saved, and only when the owner says yes in Step 8 — declining leaves the
  classic promote-and-stop behavior untouched.
