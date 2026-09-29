# Interaction rules (shared reference)

How every content skill asks questions and seeks approval. This is **not an invokable
skill** (no `name:` frontmatter, so `GET /api/skills` never scans it into a console button).
`spark`, `discovery`, `queue` and the procedures it routes to (develop, draft, revise,
article-draft), and `comment` link here and restate only their own fill. Fix the wording here
once, not in seven places, the same way `content-doctrine.md` and `onboarding-gate.md` work.

## Rule 1 — "Just go": decide-for-me mode

**Trigger.** The owner says any of "just go", "decide for me", "use your recommendations",
"no questions", "you pick", "run it", or the console request carries such a phrase. Once said,
it holds for the rest of that run; the owner does not have to repeat it at each step.

**Behavior.** At every point where the skill would ask a choice question (pillar, silo,
platform and tone, length band, angle, hook option, section headings, revision scope), it
takes its own recommended pick, states it in one line as it goes ("filing this as teach,
medium, in FinOps Education"), and continues. No confirmation prompts, no "sound right?".

**The two stops that survive**, because they are the doctrine's hard gates, not preferences:

1. **No take to build on** (take-origination). A `needs-your-take` item with an empty seed, a
   spark with no thought behind it: stop and ask for the take. The skill never invents one.
2. **A required fact is missing and cannot be written around** (never-fabricate-a-fact). A
   `promote` post with no real specific, an article with no target keyword when the owner
   has one in mind: ask that one question, then continue.

Everything else is a recommendation the skill is allowed to take. Even in this mode the
finished piece is shown in full at the end (Rule 2); deciding for the owner never means
hiding what was decided.

**Default when not triggered.** One question per decision, the recommended pick named first
with its reason, never more than one question per turn, and never re-asking a choice the
owner already made in this run.

## Headless runs (the console's AI buttons)

A run started from a console button (Write / Revise / Develop with AI, the Spark and Pillars
surfaces) is headless: its only channels to the owner are one-sentence question cards and
the final result card. Two consequences, and they override the defaults below:

- **Questions are for missing input only** (a take, what to change, a fact that cannot be
  written around). Every choice the skill could recommend, it takes, as if "just go" had been
  said. Never more than the one question the procedure names.
- **No approval of text, ever.** A question card cannot carry a draft, so "save this?" would
  show nothing. The skill writes, then the result card shows what it wrote: the full new text,
  or the before and after of every changed field. Showing replaces asking.
- **Nothing after the write.** Once the piece is saved, the run ends with its report. No
  "anything else?", no menu of next steps: a question after the write leaves the run hanging
  on a card and the result never renders. The surface's own Refine again box is the next round.

## Rule 2 — Show before you ask for approval

**Never ask the owner to approve, confirm, save, or accept text they cannot see in the same
message.** "Approve the edits?" with nothing above it is a defect, not a prompt.

- **A new draft:** show the hook, the body, and the close in full, exactly as they will be
  saved, then ask in one line ("Save this?").
- **A revision:** show before and after for every changed field, in full, or the whole new
  text when most of it changed. Name the fields left untouched.
- **A seed, an angle, or the points:** show the exact text that will be written.
- **An article's structure:** show the heading list.

The report at the end of every run repeats the saved piece in full, so the owner never has
to open the card to know what landed. This holds in decide-for-me mode too: the run skips the
asking, never the showing.
