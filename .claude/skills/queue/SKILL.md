---
name: queue
description: The Queue page's assistant — the review phase's workbench. Moves one idea forward — develop its points (the 2-4 beats), write the full piece (a post, or a long-form web article as one markdown document), or revise what's written — all in the loaded profile's voice. Reads the item, its source, and your voice card. Never invents an opinion, never publishes; the take, the review, and the Publish button are yours.
type: skill
---

# queue

The assistant for the **Queue** page — the review phase, where every idea sits with its full
written piece. This skill moves one idea forward one step. It does three things, and it routes
to the shared procedure for whichever one you ask for — it never invents your opinion, and it
never publishes (the card's Publish button is your action, gated in the console).

| Ask | Procedure it runs | What it does |
|-----|-------------------|--------------|
| develop / flesh out / "what are the points" | `.claude/skills/develop-procedure.md` | Draw out your take + 2-4 points on a queue item |
| write / draft / "write the full post/article" | post idea → `.claude/skills/draft-procedure.md` · web idea → `.claude/skills/article-draft-procedure.md` | Write the full piece from your take + points and save it onto the idea's card |
| revise / sharpen / "rewrite the intro" | `.claude/skills/revise-procedure.md` (its web variant for a web idea) | Refine the written piece in your voice, write it back |

**Lane detection:** read the item first. `platform = 'web'` (equivalently, a piece-kind
`silo` — how-to / explainer / comparison / thought-piece / whitepaper) is the long-form lane:
its content is the linked article's single markdown `body`. Anything else is a post whose
content is a draft row (hook/body/close). Route to the matching procedure; never post-draft a
web idea or article-draft a post.

## Route first, then follow that procedure exactly

1. **Read the request and pick the branch.** The console's per-card buttons name it explicitly:
   - **"Develop with AI"** passes a queue-item id and asks to develop it → **develop-procedure**.
   - **"Write with AI"** passes a queue-item id: when nothing is written yet it asks to write
     the full piece → **draft-procedure** or **article-draft-procedure** by lane; when content
     already exists it asks to revise → **revise-procedure**.
   In words: "develop item N" / "what are the points" → develop; "write this" / "draft the
   full post/article" → write; "revise/sharpen/tighten it" → revise. If the ask is ambiguous,
   ask once which you mean.

2. **Load the matching procedure file and do exactly what it says.** Each procedure carries its
   own onboarding gate, its own read/interview/write steps, and its own CLI (`develop-idea.ts`,
   `draft-store.ts`, `update-draft.ts`, `update-article.ts`). Do not re-derive them here — the
   procedure file is the single source. Obey the shared doctrine
   (`.claude/skills/content-doctrine.md`) throughout.

3. **Report as that procedure specifies**, then stop. One item per run.

## Rules

- One branch, one item, per run. Never silently do two.
- Never invent the opinion, the beats, or a fact — the procedures spell this out; it binds here too.
- Only ever writes through the procedures' CLIs (`develop-idea.ts` / `draft-store.ts` /
  `update-draft.ts` / `update-article.ts`). Never the voice card, pillars, register, feeds, or code.
- Never publish. Writing saves content onto the idea's queue card; the review gate
  (`content-reviewer`) and the owner's Publish click are separate and unchanged.
