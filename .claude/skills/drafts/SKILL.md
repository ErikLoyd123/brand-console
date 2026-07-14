---
name: drafts
description: The Drafts page's assistant. Revise an existing draft with you — sharpen the hook, tighten or restructure the body, land the close — in the loaded profile's voice, writing the changes back to the draft. Reads the draft, the idea it came from, and your voice card. Refines what you ask and preserves the rest; never invents an opinion or contradicts your take.
type: skill
---

# drafts

The assistant for the **Drafts** page. You are working an existing draft, and this skill revises
it with you — sharpening the hook, tightening or restructuring the body, landing the close — in
the loaded profile's voice, then writing the changes back.

It does one thing, and the how-to lives in the shared procedure so it stays identical to the
revise the Queue page also offers:

**To revise a draft, follow `.claude/skills/revise-procedure.md` exactly.** That procedure carries
the onboarding gate, loads the draft + its originating idea + your voice card, interviews you on
what to sharpen, and writes the result back via `update-draft.ts`. This skill does not re-derive
those steps — the procedure file is the single source, shared with the `queue` skill.

The console's per-card **"Revise with AI"** button passes the draft id in the first message and
says to use it — take that id directly, do not ask which draft.

## Rules

- One draft per run, then report. Never draft a new post here — creating a draft from a queue
  idea is the `queue` skill's job; this page sharpens drafts that already exist.
- Never invent an opinion or contradict the owner's take — the procedure spells this out; it binds
  here too. Refine what the owner asks and preserve the rest.
- Only ever writes through `update-draft.ts` (the revise procedure's CLI). Never publishes.
