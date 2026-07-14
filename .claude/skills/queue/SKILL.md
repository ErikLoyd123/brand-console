---
name: queue
description: The Queue page's assistant. Moves one idea forward — develop its points (the 2-4 beats), draft the post from your take + points, or revise an existing draft — all in the loaded profile's voice. Reads the item, its source, and your voice card. Never invents an opinion; the take and beats are yours.
type: skill
---

# queue

The assistant for the **Queue** page. You are working an idea in the queue, and this skill moves
it forward one step. It does three things, and it routes to the shared procedure for whichever
one you ask for — it never invents your opinion; the take and beats are always yours.

| Ask | Procedure it runs | What it does |
|-----|-------------------|--------------|
| develop / flesh out / "what are the points" | `.claude/skills/develop-procedure.md` | Draw out your take + 2-4 points on a queue item |
| draft / write the post | `.claude/skills/draft-procedure.md` | Write hook/body/close from your take + points, save a draft |
| revise / sharpen the draft | `.claude/skills/revise-procedure.md` | Refine an existing draft in your voice, write it back |

The Queue page can do all three because they are the forward motion from an idea: shape it
(develop), write it (draft), then sharpen it (revise). Revise lives here **and** on the Drafts
page — both the `queue` and `drafts` skills reference the same `revise-procedure.md`, so there is
one source of truth for how a revision is done.

## Route first, then follow that procedure exactly

1. **Read the request and pick the branch.** The console's per-card buttons name it explicitly:
   - **"Develop with AI"** passes a queue-item id and asks to develop it → follow
     **`develop-procedure.md`**.
   - **"Draft with AI"** passes a queue-item id and asks to draft it → follow
     **`draft-procedure.md`**.
   - A request to **revise/sharpen a draft** (by draft id, or "revise the draft for item N") →
     follow **`revise-procedure.md`**.
   In words: "develop item N" / "what are the points" → develop; "draft this" / "write the post"
   → draft; "revise/sharpen/tighten the draft" → revise. If the ask is ambiguous, ask once which
   of the three you mean (a queue idea with no draft yet can only be developed or drafted).

2. **Load the matching procedure file and do exactly what it says.** Each procedure carries its
   own onboarding gate, its own read/interview/write steps, and its own CLI (`develop-idea.ts`,
   `draft-store.ts`, `update-draft.ts`). Do not re-derive them here — the procedure file is the
   single source. Obey the shared doctrine (`.claude/skills/content-doctrine.md`) throughout.

3. **Report as that procedure specifies**, then stop. One item/draft per run.

## Rules

- One branch, one item, per run. Never silently do two.
- Never invent the opinion, the beats, or a fact — the procedures spell this out; it binds here too.
- Only ever writes through the procedures' CLIs (`develop-idea.ts` / `draft-store.ts` /
  `update-draft.ts`). Never the voice card, pillars, register, feeds, or code.
- Never publish. Drafting saves a draft; revising rewrites one; the review gate and the owner's
  approval are separate and unchanged.
