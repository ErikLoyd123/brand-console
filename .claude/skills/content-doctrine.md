# Content doctrine (shared reference)

This is the canonical source for the content engine's three cross-cutting principles.
It is **not an invokable skill** (no `name:` frontmatter, so `GET /api/skills` never
scans it into a console button). It is the single written source that content skills
link and restate at their choke point, the same way `.claude/skills/onboarding-gate.md`
is the canonical detect-and-offer block that `voice-card` and `queue`
embed. Fix the wording here once, not in five places.

The doctrine is committed structure: it is identical for every user (integrity and
depth, not a taste setting), so it lives in committed code and never in a gitignored
profile folder. See design `2026-07-03-content-spine-register-axis/02-doctrine-fragment`.

## Principle 1 — take-origination

**Never invent an opinion.** The owner's take is the spine of any post that carries one.
An agent does not get to decide what the profile owner thinks.

- **In drafting/shaping** (`queue`, `spark`): a `needs-your-take` item with a present
  `seed` is expanded around that seed and never contradicted. A `needs-your-take` item
  whose `seed` is empty or null is a **hard stop** — surface the item and do not draft.
- **In distillation** (`setup`): name the patterns the person actually showed in the
  interview; never manufacture a voice, a stance, or a persona the answers did not
  contain. Distilling is observation, not invention.

## Principle 2 — never-fabricate-a-fact

**Style can be generated; facts cannot.** A specific real detail the owner did not
provide — a number, a named tool, a customer, what actually happened — must never be
invented. When a draft or a seed needs such a detail, leave a `[FILL: ...]` marker in
place and surface it to the owner rather than filling it with a plausible guess. An
unmarked invented specific is a failure.

## Principle 3 — depth-calibration

**A post's depth is a function of silo × register, never a constant.** Not every post
needs to be profound; demanding depth a post's purpose does not want deforms it.

- **Silo** (intent — the platform-keyed roster in `src/core/silos.ts`) sets the *floor and
  shape* of depth. `conversation` (LinkedIn) and its Reddit analog `discuss` are the deepest
  silos: they live in the owner's cross-domain seam and earn seam-mining. Every other silo —
  `teach`/`win`/`curate` on LinkedIn, `help`/`share`/`ask`/`curate` on Reddit — is lighter and
  purpose-fit: a teach (or its Reddit analog, `help`) delivers one useful thing, a win (or
  `share`) is a short plain story, a curate is a generous pointer shared by both platforms,
  and an ask (Reddit-only) puts one real question to the community. None of them demands a
  profound thought.
- **Register** (tone/platform — the menu in `src/core/registers.ts`, selected per user in
  `identity.yaml`) *colors* that depth — how the calibrated thought sounds on the chosen
  platform — but never overrides the silo's shape.

Read depth off the axes; do not apply it uniformly.

## Principle 4 — voice-rules-everywhere

**Everything an agent writes into the pipeline is written under the voice card's mechanical
rules — not just the piece that publishes.** Takes and angles, seeds, points, titles, meta
descriptions: all of it sits on the owner's screens in the owner's voice, and the console's
live checks scan it. An em dash or an AI-tell in a take reads exactly as badly as one in a
post, and makes the checks look broken besides. Follow the voice card's hard mechanical
rules (no em dashes, no AI-tells, plain language) in every string you save, at every stage.

## How skills link this fragment

Each consuming skill restates the doctrine at its choke point and links back here as the
source, filling only its own row below — it never paraphrases the doctrine freehand. This
mirrors `onboarding-gate.md`'s `REQUIRED`/`DEGRADATION` fill table.

| Skill | Where it embeds | Per-skill fill (what varies) |
|-------|-----------------|------------------------------|
| `spark` | Rules section, before writing the seed | The **seed** is the unit that must stay the owner's own thought; `[FILL: ...]` goes in the seed; depth is set by the inferred silo before the interview runs. **Adopted now.** |
| `queue` | Step 2 guardrail + Rules | `[FILL: ...]` goes in the draft body; unseeded `needs-your-take` is a hard stop; depth read off `idea_queue_items.silo` drives Step 3 shaping. *Follow-on.* |
| `setup` | Distillation stage | Take-origination applied to persona-building: name patterns shown, never manufacture a voice. *Follow-on.* |
| `content-reviewer` | Soft-rule checks | Enforces, not authors: "No fabricated specifics" (unmarked invented fact fails) and silo-appropriate depth (no teach-takeaway demand on a `conversation`/`discuss` post). *Follow-on.* |

> Only the `spark` row is adopted today. The other four skills keep their current (correct
> but duplicated) inline wording; retrofitting them to link this fragment is follow-on
> work, recorded in the design's `99-out-of-scope`.
