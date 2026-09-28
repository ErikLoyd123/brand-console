---
name: spark
description: Shape a raw spark into a finished piece on the queue. Reads the spark, infers its intent (silo) from the target platform's roster and confirms with you, interviews you at the depth that kind needs, offers a few tone-colored angles and a length band to pick from — then writes the full piece (a post, or a long-form web article as one markdown document) and lands it on the Queue card for your review. Invoked with nothing in hand, it proposes three sparks from your own interview material (your words, never invented) and you pick one. Never invents an opinion, never publishes.
type: skill
---

# spark

Turn a half-formed thought into a sharp, queued post before anything gets drafted. `spark`
is the deliberate front-end for **every** silo, on either platform: it reads a spark, works
out what *kind* of post it wants to be, and interviews you at the depth that kind actually
needs — deep for a conversation (LinkedIn's `conversation`, Reddit's `discuss`), light for a
teach/help, win/share, or curate. `spark` finds and shapes the thought — and once the
seed is safely saved, it carries straight on into writing the full piece, following the
same shared procedures the `queue` skill uses, so a spark run ends with a finished draft
sitting on its Queue card for review instead of an idea parked to be picked up again. It
never reviews or publishes, and it never invents an opinion.

The Spark screen's plain "Save spark" button is the zero-shaping fast path (it stores the
spark verbatim and drops a seeded needs-your-take idea, via the same `src/ingest/capture.ts`
this skill uses). `spark` is the slower, deliberate sibling for when a spark is worth shaping.

**Invoke with:** "spark on this", "spark:", "help me shape this thought", "turn this into a
post". With nothing in hand: "spark", "I've got nothing, give me options", or the Spark
screen's button with an empty box, and Step 2c proposes three from your own material.

## Onboarding gate (run before sparking)

Run this first. This is the shared detect-and-offer gate (`.claude/skills/onboarding-gate.md`).

1. Check the active profile. Profiles are gitignored under `profiles/<slug>/`; a fresh clone ships only
   `profile.example/`. Run:

   ```bash
   npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
   ```

   `checkCompleteness()` (from `src/profile/completeness.ts`) returns
   `{ complete: boolean, missing: string[] }`; `missing` names the pillars requirement
   when `identity.yaml` declares none.

2. `spark` needs `identity.yaml` with at least one pillar to route the resulting item.
   Platforms are optional config with a shipped default (Step 4), so they never block the
   gate. If a pillar is present, pass the gate and continue. Otherwise go to step 3.

3. Report plainly that pillars are not configured yet and offer to run the `setup` skill's
   knob-walk now. One clear question with a recommended path; name the alternative in step 5.

4. If the user accepts: hand off to `setup`, let it write `identity.yaml`, then resume.

5. If the user declines: stop gracefully. `spark` cannot file a thought with no pillar
   vocabulary to route it. `setup` is a separate skill; the gate only names and offers it.

## The doctrine (read first)

`spark` obeys the shared content doctrine (`.claude/skills/content-doctrine.md`) — the single
source for **take-origination** (never invent an opinion), **never-fabricate-a-fact**
(ask before writing, else write around the gap; never a guess and never a placeholder),
**depth-calibration** (depth is a function of silo × register, not every post must be profound), and **voice-rules-everywhere**
(every string you save — the seed, the angle, the points, not just the piece — follows the
voice card's hard mechanical rules: no em dashes, no AI-tells). Riff's fill on that doctrine:
the **seed** is the unit that must stay the owner's own thought, a missing specific is asked
for in the interview or left out of the seed (never a placeholder), and depth is set by the
silo inferred in Step 3 *before* the interview runs. The
doctrine binds every step below; this file does not restate it.

`spark` also obeys the shared interaction rules (`.claude/skills/interaction-rules.md`).
"Just go" (or "decide for me", "no questions") switches the run to decide-for-me mode: Steps
2c, 3, 4, 5b, and 6 take their own recommended pick and say so in one line instead of asking;
only a missing take or a fact that cannot be written around still stops. And nothing is ever
put up for approval, the finished piece in Step 9 included, without its full text shown first.

## The flow

`spark` runs these steps in order. Steps 1-2 are setup and doctrine; steps 3-4 resolve the
two axes that calibrate everything; steps 5-7 are the interview, the angle menu, and the
write, all bent to what 3-4 resolved; step 9 carries the saved seed straight into the full
written piece. It converges on exactly one thought.

**The destination directives.** The Spark screen sends directive lines ahead of the spark
text. They are the owner's explicit calls — honor them, don't re-ask:

- `[platform: linkedin|reddit|web]` (always sent) resolves Step 4's platform outright.
  `web` routes to the long-form pipeline; `linkedin`/`reddit` behave as Step 4 describes
  for that platform. Skip platform inference entirely; still resolve and lightly confirm
  the tone.
- `[kind: how-to|explainer|comparison|thought-piece|whitepaper]` (optional, web only)
  pre-picks the silo. When present, skip Step 3's proposal — the piece kind is decided —
  and go straight to the interview at that kind's depth. When absent on a web run, propose
  among the five piece kinds as Step 3 describes.

With no directives (a terminal invocation, an older client), infer as Steps 3-4 describe.
Directive lines are UI plumbing, not content: strip them before reading the spark, and
never include them in the raw spark text persisted in Step 7.

### 1. Onboarding gate

Above. Needs at least one pillar; platforms are optional.

### 2. Doctrine

Above. Take-origination, never-fabricate, depth-calibration — from
`.claude/skills/content-doctrine.md`.

### 2b. Read the pillars and their notes

Before proposing anything, read every pillar's key, label, note, and default intent for the
profile's default platform. The note is the owner's own description of what posts in that
lane cover and how they read; the default intent is what a spark in that lane usually is.
From the repo root:

```bash
npx tsx -e "(async () => { const p = await import('./src/core/pillars'); console.log(JSON.stringify(p.getPillars().map((k) => ({ key: k, label: p.getPillarLabel(k), note: p.getPillarNote(k), default_silo: p.getPillarDefaultSilo(k) })), null, 2)); process.exit(0); })();"
```

This read feeds Step 3: the pillar is proposed from the notes, and its default intent is the
first silo candidate.

### 2c. No spark in hand? Propose three from the owner's own material

When the invocation carries no thought (a bare "spark", "I've got nothing", an empty box),
do not ask the owner to produce one cold and do not invent one. Their takes already exist in
writing: the active profile's `interview.md` (the raw voice interview, with its seed lists,
stories, and opinions) and the verbatim samples in the voice card. Resolve the file from the
repo root, then read it in full:

```bash
npx tsx -e "import('./src/profile/loader.ts').then(m => console.log(m.interviewPath()))"
```

Then read what has already been used, so a proposal is never a repeat. Every queued or
published idea on the active profile, with its seed and angle:

```bash
npx tsx -e "(async () => { const {db} = await import('./src/db/client'); const {ideaQueueItems} = await import('./src/db/schema'); const {eq} = await import('drizzle-orm'); const {getActiveProfileId} = await import('./src/profile/loader'); const r = await db.select({ status: ideaQueueItems.status, pillar: ideaQueueItems.pillar, silo: ideaQueueItems.silo, angle: ideaQueueItems.proposedAngle, seed: ideaQueueItems.seed }).from(ideaQueueItems).where(eq(ideaQueueItems.profileId, getActiveProfileId())); console.log(JSON.stringify(r, null, 2)); process.exit(0); })();"
```

Propose **exactly three** candidates, one line each, in this shape: the take in the owner's
own words (quote the interview line or stay within a close paraphrase of it), the pillar it
sits in (from the notes in Step 2b), and the intent that pillar defaults to. Prefer takes no
existing item has used, spread the three across pillars, and lean to the pillars the
coverage numbers say are quiet. Then one question: which one, or none. That is the whole
step: one round of three, no second round unless the owner asks for one, no drafting on
speculation. If they pick none and ask for more, offer three different ones; if the
interview holds nothing unused, say so plainly and ask for a thought instead.

The pick becomes the spark. Its raw text is the interview line itself (that is what Step 7
records verbatim in the `sparks` row), and the flow continues at Step 3 exactly as if the
owner had typed it. Take-origination holds throughout: every candidate must trace to a line
the owner actually said. A take that is "probably how they'd see it" is an invention, and
this step never produces one.

### 3. Infer-and-confirm the silo

Read the spark against the pillar notes from Step 2b and propose, **in one line, the pillar
and the silo together**, with the note's reason: "this sits in FinOps Education, which is
normally a teach; sound right?" The pillar's `default_silo` is the first candidate. When the
spark plainly reads as a different intent than the pillar's default (a raw question in a
teach-default lane), propose that intent instead and say why. The owner nods or redirects.
No up-front taxonomy quiz, no silent classification. It is a **proposal, not an assertion**:
the same take-origination principle applied to the pillar and silo choice, so `spark` never
decides *for* the owner what lane or kind of post this is.

The silo roster is platform-keyed in `src/core/silos.ts`: LinkedIn ships
`conversation | teach | win | curate | promote`, Reddit ships `discuss | help | share | ask | curate`, and
**`web` (long-form) ships the piece kinds** `how-to | explainer | comparison | thought-piece | whitepaper`.
Propose from whichever platform the spark is headed for — the profile's default platform
(Step 4 confirms it) unless the spark plainly names the other one. Propose exactly one;
move on the moment the owner confirms or corrects. The confirmed silo sets the interview
depth (Step 5) and the angle menu (Step 6).

### 4. Resolve platform + tone

Resolve the **platform** from the active profile's `identity.yaml`'s `platforms` list: the entry marked
`default: true` and active; else the first active entry; else `linkedin`. Read that
platform's tone menu from `src/core/registers.ts` (the register axis). Pick the tone the
spark and the owner's leaned tones best fit, and confirm it **lightly** — a one-line check
("I'll aim this in your plain-professional tone — good?"), not a menu walk. Register is soft
guidance and the default is usually right. The chosen tone colors the interview framing and
the angle wording; it never becomes a hard rule.

### 5. Silo-appropriate interview

Interview at the **depth the confirmed silo demands** (table below). One question per turn,
in the interview style of `setup` and `/c-brainstorm` — never a wall of questions. Stop the
moment the thought is sharp enough for its silo; the question counts are ceilings, not
quotas.

| Silo | Depth | Question budget | What spark mines |
|------|-------|-----------------|-----------------|
| `conversation` | Deepest | 1-3 sharp questions | Cross-domain friction — the "seam" where the owner's roles, domains, and eras disagree |
| `teach` | Light | Usually one question | The single useful takeaway + the concrete example that proves it |
| `win` | Light | One question | Whose win / what happened and why it mattered; keep the owner accountable, never the aggressive hero |
| `curate` | Minimal | One question | What the owner adds by passing this along, and who gets credit |
| `promote` | Minimal | One or two questions | What is the one thing to show, and what is the ask; then stop |
| `discuss` (Reddit) | Deepest | 1-3 sharp questions | Cross-domain friction — the Reddit analog of `conversation` |
| `help` (Reddit) | Light | Usually one question | The concrete problem and the concrete answer — the teach-analog |
| `share` (Reddit) | Light | One question | What happened and why it mattered, told plainly — the win-analog, no hero framing |
| `ask` (Reddit-only) | Minimal | One question | What exactly the owner wants the community's read on |

**The conversation branch (deepest).** Keep the seam-mining. The richest questions press on
the owner's cross-domain friction — the places where the different selves in the voice card
disagree: "You said those people get this wrong. Which side of you is saying that, and would
the other side push back?" A conversation post lives in that seam; the interview finds which
seam this spark sits on. Three questions is a ceiling. Reddit's `discuss` gets the identical
deepest treatment — it is the same seam-mining, just headed for a subreddit instead of the feed.

**The lighter branches.** `teach`/`win`/`curate`/`promote` and their Reddit counterparts `help`/`share`,
plus the Reddit-only `ask`, do **not** get seam-mining — that would over-shape a post the
drafter keeps short and purpose-fit. Each is essentially one well-aimed question surfacing the
one thing its downstream shape needs.

**The web branch (long-form).** When the resolved platform (Step 4) is `web`, the confirmed silo is
one of the five piece kinds and the interview additionally captures the two SEO inputs the article
needs, one plain question each: the **target keyword** (the single phrase the piece targets) and the
**search intent** (who is searching and why, in the owner's own words, e.g. "compare tools before
buying"). These are the owner's, never invented; if the owner does not know the keyword yet, leave the
field empty and say so in the hand-off; never a placeholder. Depth still follows the piece
kind, not these two questions.

### 5b. Recommend the length band

How long the post runs is its own axis (bands in `src/core/lengths.ts`: short 300 to 600,
medium 700 to 1100, long 1300 to 1900 body characters). Recommend one, **in one line with the
reason, and ask**. Start from the silo's default (`teach`/`help` lean medium; every other
post intent leans short) and move it by what the interview actually produced: one gap or one
claim is short; a mechanism is medium; a mechanism plus the mistake people make plus the fix
is long. "You gave me one gap and one number, so short; sound right?" The owner nods or
picks another. The band is a target the drafter writes to, not a floor. Skip this step for
`web` (the article carries its own length target).

### 6. Angle-finder, calibrated by silo and colored by tone

Offer one-line candidate angles — options, not drafts — with the **count and shapes scaled
to the silo** and the wording **colored by the tone** from Step 4. Every angle is a
reshaping of the owner's own spark, never an invented take.

- **conversation** (LinkedIn) **/ `discuss`** (Reddit) — **4-5 divergent angles**: contrarian
  take, confession, "am I the only one who…", reframed-as-a-question. Show the owner the full
  range so the choice is deliberate.
- **teach** (LinkedIn) **/ `help`** (Reddit) — **1-2 angles** around the takeaway: the plain
  "here's the useful thing" open, or the "here's the mistake this avoids" open. No
  contrarian/confession theatrics.
- **win** (LinkedIn) **/ `share`** (Reddit) — **1-2 angles** around the story open:
  whose-moment-this-was, or what-I-learned-watching-it. Never the aggressive-hero frame.
- **curate** (shared by both platforms) — **1 angle**, the generous pointer, phrased so the
  credited source is the subject. Minimal by design.
- **promote** (LinkedIn-only) — **1 angle**, the plain statement of what it does and for whom,
  phrased in the resolved tone. No contrarian frame, no story.
- **ask** (Reddit-only, no LinkedIn counterpart) — **1-2 angles** around framing the question:
  bare and direct, or with a sentence of context first.

Whatever the silo's angles, phrase each **in the resolved tone**. Tone is soft guidance — it
shifts the register of the one-liners (punchier vs. measured, warm vs. dry), never the number
of angles and never the doctrine.

### 7. Converge to one thought, write the seed

The owner picks **one** angle. Form the converged, refined thought (a sentence or two). This
refined thought, not the raw spark, becomes the seed. Persist it with the **detected** silo
plus the resolved platform and tone. From the repo root:

```bash
npx tsx src/ingest/capture.ts "RAW SPARK TEXT" [pillar] \
  --seed "REFINED CONVERGED THOUGHT" \
  --silo <conversation|teach|win|curate|promote|discuss|help|share|ask|how-to|explainer|comparison|thought-piece|whitepaper> \
  --platform <platform-key> \
  --tone <tone-key> \
  --length <short|medium|long>
```

- The first positional is the owner's original raw spark (recorded verbatim in the `sparks`
  row). For a spark chosen in Step 2c it is the interview line the owner picked.
- `pillar` is the pillar key the owner confirmed in Step 3. Always pass it; capture's
  first-pillar default is for bare captures, not for a spark that was walked.
- `--seed` carries the refined thought the owner converged on.
- `--silo` sets the detected silo, validated against `src/core/silos.ts`'s roster for the
  resolved `--platform` (LinkedIn's five, Reddit's five, or `web`'s five piece kinds), instead of
  capture's `conversation` default.
- `--platform` and `--tone` persist the register the spark was shaped for, so `queue`
  and `content-reviewer` can read it downstream.
- `--length` persists the band the owner confirmed in Step 5b, so the drafter writes to it
  and the card shows it. Omit it only for `web`.

The item lands with `status = seeded`, `tag = needs-your-take`, `silo = <detected>`, the
platform/tone pinned, and the length band set. Report the new spark id and idea id and confirm what it landed as
(silo, platform, tone).

### 8. Web only — side-write the article row

When the resolved platform is `web`, the same `capture.ts` call above still writes the seeded queue
item (pass `--platform web` and `--silo <piece kind>`; the piece kinds validate against
`getSilos('web')`). It prints `... -> idea <ideaId> (needs-your-take, seeded)`. Take that `<ideaId>`
and side-write the long-form `articles` row that carries the SEO inputs, via the shared create CLI
(mirroring how `discovery` promotes then side-writes):

```bash
npx tsx src/articles/create-article.ts "<ideaId>" '{
  "title": "<a working title from the chosen angle>",
  "targetKeyword": "<the target keyword, or empty if the owner has none yet>",
  "searchIntent": "<the search intent in the owner's words>"
}'
```

`create-article` is idempotent per `ideaId` (a re-run never double-creates) and prints the new
article id in backticks (`article ` + "`<id>`"). Report both the idea id and the article id. For any
other platform (LinkedIn, Reddit) there is no article row and this step is skipped.

### 9. Keep going — write the full piece

The seed (and, for web, the article row) is saved and safe whatever happens next. **Do not
stop and do not ask** — a spark run ends with the full piece written and sitting on the
idea's queue card, ready for review. The owner just spent an interview shaping this thought;
the queue is where they review the result, not where they restart the pipeline.

- **LinkedIn / Reddit** — follow the shared draft procedure
  (`.claude/skills/draft-procedure.md`) with the just-created idea id. It runs its own
  voice-card gate; the item's seed, silo, platform, and tone are already on the row from
  Step 7, so it drafts straight from what this interview produced.
- **web** — follow the article draft procedure
  (`.claude/skills/article-draft-procedure.md`) with the just-created article id: one light
  structure confirm, then the whole piece written as a single markdown document, with the
  meta description and slug filled.

Everything the interview drew out was persisted **before** the writing started, so an
abandoned or failed write never loses the shaped seed — rerunning picks up from the saved
idea.

## Hand off

Report what exists when the run ends — the idea id always; the article id for web; the draft
id for a post — and that the full piece is on its **Queue card**, the review phase: the owner
reads it there, edits by hand or revises with AI, and clicks Publish when it's good to go
(LinkedIn via the gated API modal, Reddit by copy-paste, web as the exported markdown file).
Every piece — whoever wrote it — lands `pending` and is judged by `content-reviewer` against
its silo's rules. `spark` never reviews or publishes.

After the piece lands, offer once: an image for the card — a composed brand graphic, an
annotated screenshot, or an Unsplash pick. If the owner wants one, follow
`.claude/skills/imagery-procedure.md` for the same idea; if not, move on without pushing.

## Rules

- Obey the doctrine (`.claude/skills/content-doctrine.md`): never invent an opinion, never
  fabricate a fact, calibrate depth by silo × register. The silo proposal (Step 3) is a
  proposal, not an assertion.
- The owner's spark is the spine. The interview sharpens and the angle-finder reframes, but
  the converged seed must still be recognizably the owner's thought.
- Any specific real detail the owner has not provided (a number, which tool, what actually
  happened, a customer) is asked for in the interview; if the owner does not have it, the
  seed drops the claim. Never a guess, never a placeholder in saved text.
- One converged thought per invocation. A second post means a second spark.
- With nothing in hand, propose only from the owner's own written material (`interview.md`,
  the voice card's samples): three candidates, one round, every one traceable to a line they
  said. Never manufacture a take to fill the gap, and never draft one nobody picked.
- `spark` never reviews or publishes. It writes only via the shared procedures, and only
  after the seed is saved — the write can always be abandoned and rerun without losing the
  shaped thought. Review and Publish belong to the owner, on the Queue card.
