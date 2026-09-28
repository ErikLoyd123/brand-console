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
  `teach`/`win`/`curate`/`promote` on LinkedIn, `help`/`share`/`ask`/`curate` on Reddit — is
  lighter and purpose-fit: a teach (or its Reddit analog, `help`) delivers one useful thing, a
  win (or `share`) is a short plain story, a curate is a generous pointer shared by both
  platforms, an ask (Reddit-only) puts one real question to the community, and a promote
  (LinkedIn-only, the lightest) states one thing the product does and one real specific, then
  asks once. No thought-leadership, no lesson. None of them demands a profound thought.
- **Register** (tone/platform — the menu in `src/core/registers.ts`, selected per user in
  `identity.yaml`) *colors* that depth — how the calibrated thought sounds on the chosen
  platform — but never overrides the silo's shape.
- **Length** (the band roster in `src/core/lengths.ts`, chosen per post) sets how much room
  the depth gets. The silo only defaults it (`teach`/`help` lean medium, the rest lean short);
  the material decides it: one gap or one claim is short, a mechanism is medium, a mechanism
  plus the mistake plus the fix is long. A teach post is as long as its mechanism, never as
  long as a floor.

Read depth off the axes; do not apply it uniformly.

## Principle 4 — voice-rules-everywhere

**Everything an agent writes into the pipeline is written under the voice card's mechanical
rules — not just the piece that publishes.** Takes and angles, seeds, points, titles, meta
descriptions: all of it sits on the owner's screens in the owner's voice, and the console's
live checks scan it. An em dash or an AI-tell in a take reads exactly as badly as one in a
post, and makes the checks look broken besides. Follow the voice card's hard mechanical
rules (no em dashes, no AI-tells, plain language) in every string you save, at every stage.

## Principle 5 — specifics-are-load-bearing

**Every specific the owner gave is carried by name, the close lands on one, and a teach
post explains rather than enumerates.** Style can be generated; the concrete things cannot,
and they are also what makes a post read as a person's. Three rules follow.

- **Carry the specifics.** A tool name, a number, a proper noun, a named mechanism in the
  seed or the points appears in the body by name. Generalizing it away ("the right packages"
  for "Polars and Arrow") is a failure, mechanically caught by `seed-retention` in
  `src/review/voice-checks.ts` (severity `fail`).
- **Close on something.** The last line restates one concrete thing from the body, or, for a
  conversation-shaped post, asks one real question. It is never a moral, an encouragement, or
  a summary of the genre ("stay curious", "worth a second look"). Mechanically flagged by
  `aphorism-close` (severity `warn`); the reviewer decides.
- **Prose over scaffolding in teach.** A teach post explains one mechanism in paragraphs.
  First/Second/Third, "three things", and numbered lines appear only when the owner's own
  points are a list, and even then prose is preferred. Mechanically flagged by `list-cadence`
  (severity `warn`); the reviewer decides. The reflexive three-item sentence is the same tell
  in miniature; break it or cut one. It is a judgment call, not a mechanical one.

See design `2026-09-28-strategy-pillars-anti-slop/03-anti-slop-checks`.

## How skills link this fragment

Each consuming skill restates the doctrine at its choke point and links back here as the
source, filling only its own row below — it never paraphrases the doctrine freehand. This
mirrors `onboarding-gate.md`'s `REQUIRED`/`DEGRADATION` fill table.

| Skill | Where it embeds | Per-skill fill (what varies) |
|-------|-----------------|------------------------------|
| `spark` | Rules section, before writing the seed | The **seed** is the unit that must stay the owner's own thought; `[FILL: ...]` goes in the seed; depth is set by the inferred silo before the interview runs. **Adopted now.** |
| `queue` | Step 2 guardrail + Rules | `[FILL: ...]` goes in the draft body; unseeded `needs-your-take` is a hard stop; depth read off `idea_queue_items.silo` drives Step 3 shaping. *Follow-on.* |
| `setup` | Distillation stage | Take-origination applied to persona-building: name patterns shown, never manufacture a voice. *Follow-on.* |
| `content-reviewer` | Soft-rule checks | Enforces, not authors: "No fabricated specifics" (unmarked invented fact fails) and silo-appropriate depth (no teach-takeaway demand on a `conversation`/`discuss` post). *Follow-on.* Principle 5: reads the three findings and applies judgment (specifics carried, close lands, prose over scaffolding). **Adopted now.** |
| `draft` (via `draft-procedure.md`) | The "Produce four fields" block and the per-silo teach block | Principle 5 only: carry every specific from `seed`/`points`; the close lands on one; teach is prose. **Adopted now.** |
| `develop` (via `develop-procedure.md`) | The take-and-beats interview | Principle 5 only: when a beat is a category, ask for the name, because the seed is where specifics must live. **Adopted now.** |

> The `spark` row is adopted for Principles 1 to 4; the `draft`, `develop`, and
> `content-reviewer` rows are adopted for Principle 5 (design
> `2026-09-28-strategy-pillars-anti-slop`). Retrofitting `queue`, `setup`, and
> `content-reviewer` to link Principles 1 to 4 remains follow-on work, recorded in the
> register-axis design's `99-out-of-scope`.
