---
name: articles
description: The Articles page's assistant. Moves one long-form web piece forward — outline its sections, draft the section bodies, or revise a section — all in the active profile's voice. Reads the article, the queue idea it grew from, the piece kind's guidance, and your voice card. Never invents an opinion; the take and structure are yours.
type: skill
---

# articles

The assistant for the **Articles** page. You are working one long-form `web` piece — an `articles`
row grown from a `web` queue idea — and this skill moves it forward one step. It does three things,
and it routes to the shared procedure for whichever one you ask for. It never invents your opinion or
your argument; the take and the structure are always yours.

| Ask | Procedure it runs | What it does |
|-----|-------------------|--------------|
| outline / "build the outline" / "what are the sections" | `.claude/skills/outline-procedure.md` | Draw the argument's shape into headings + intents (empty bodies), set the slug and a length target |
| draft sections / "write the sections" / "write the body" | `.claude/skills/section-draft-procedure.md` | Write each section's body one at a time in your voice, fill the meta description |
| revise / "sharpen the intro section" / "rewrite section N" | `.claude/skills/section-revise-procedure.md` | Refine named sections only, in your voice, preserving the rest |

The Articles page can do all three because they are the forward motion of a long-form piece: outline
it, write it section by section, then sharpen any one section. This mirrors the `queue` skill one rung
up in size — a whole article of ordered sections rather than a single short draft.

## Route first, then follow that procedure exactly

1. **Read the request and pick the branch.** The console's per-article buttons name it explicitly:
   - **"Outline with AI"** passes an article id and asks to outline it → follow
     **`outline-procedure.md`**.
   - **"Draft sections with AI"** passes an article id and asks to draft its sections → follow
     **`section-draft-procedure.md`**.
   - A request to **revise/sharpen a named section** (by article id + section heading, or "revise the
     intro section of article N") → follow **`section-revise-procedure.md`**.
   In words: "outline article N" / "what are the sections" → outline; "write the sections" / "draft
   the body" → section draft; "revise/sharpen/rewrite the <named> section" → section revise. If the
   ask is ambiguous, ask once which of the three you mean (an outlined article with empty bodies can
   only be section-drafted; a drafted one can be revised).

2. **Load the voice card first, then the matching procedure.** Load the active profile's voice card
   via the `voice-card` skill (`.claude/skills/voice-card/SKILL.md`) before any long-form work — every
   heading, body, and revision is shaped in that profile's voice. Then load the matching procedure file
   and do exactly what it says. Each procedure carries its own onboarding gate, its own
   read/interview/write steps, and the shared article CLI (`src/articles/update-article.ts`). Do not
   re-derive them here — the procedure file is the single source. Obey the shared doctrine
   (`.claude/skills/content-doctrine.md`) throughout.

3. **Report as that procedure specifies**, then stop. One article, one branch, per run.

## Rules

- One branch, one article, per run. Never silently do two.
- Never invent the opinion, the argument, or a fact — take-origination and never-fabricate
  (`.claude/skills/content-doctrine.md`) bind here exactly as on the short-form lane. The structure,
  the take, and every specific are the owner's; a specific they did not supply is a `[FILL: ...]`
  marker, never a guess.
- Only ever writes through the procedures' article CLI (`src/articles/update-article.ts`). Never the
  voice card, the rosters, pillars, feeds, or code, and never the queue idea the article grew from.
- Never publishes. Outlining and drafting fill the article row; the review gate (`content-reviewer`)
  and the markdown export are separate steps, and export is the owner's action.
