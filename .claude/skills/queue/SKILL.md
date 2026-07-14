---
name: queue
description: The Queue page's assistant — the review phase's workbench. Moves one idea forward — develop its points (the 2-4 beats), write the full piece (a post, or a long-form web article as one markdown document), revise what's written, or run the review gate (the content-reviewer spec) on it — all in the loaded profile's voice. Reads the item, its source, and your voice card. Never invents an opinion, never publishes; the take and the Publish button are yours.
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
| review / "run the gate" / "is this good to publish" | `.claude/agents/content-reviewer.md` — follow it exactly as a procedure | Judge the written piece against the voice card (and, for web, the SEO checks), write the verdict, report pass or the fix list |

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
   - **"Review with AI"** passes a queue-item id and asks to review its written content →
     follow **`.claude/agents/content-reviewer.md`** exactly, as a procedure: the short-form
     path for a post's draft, the long-form path (voice + kind judgment + SEO checks) for a
     web idea's article. It writes the verdict (`reviewStatus`, and the article stage on a
     pass) exactly as that file specifies, reports PASS or the fix list, and **never rewrites
     the content** — the owner decides what to change.
   In words: "develop item N" / "what are the points" → develop; "write this" / "draft the
   full post/article" → write; "revise/sharpen/tighten it" → revise; "review it" / "run the
   gate" → review. If the ask is ambiguous, ask once which you mean.

2. **Load the matching procedure file and do exactly what it says.** Each procedure carries its
   own onboarding gate, its own read/interview/write steps, and its own CLI (`develop-idea.ts`,
   `draft-store.ts`, `update-draft.ts`, `update-article.ts`). Do not re-derive them here — the
   procedure file is the single source. Obey the shared doctrine
   (`.claude/skills/content-doctrine.md`) throughout.

3. **Report as that procedure specifies.** One item per run — but the session stays open.

## Orient first, converse after

The console's buttons drop the owner straight into a session with no preamble, so the session
must supply the context a person would want:

- **Review** opens with a short plain-words orientation *before* the verdict — what the piece
  is, what it is trying to do (its silo intent and platform), in 2-4 sentences. Then the gate
  runs and the verdict lands as the spec prescribes. After reporting, stay available: answer
  questions about the verdict, a specific finding, or the piece itself. Answering never turns
  into rewriting — an explicit "revise it" ask is a new revise run.
- **Revise** opens by telling the owner where the piece stands — what it currently says, its
  review status, any standing check findings — in a few sentences, then asks what to change.
  After writing the revision back, stay for follow-up tweaks in the same session; each write
  still goes through the procedure's CLI.
- **Develop / Write** already interview by design; the same principle binds them: lead with
  what you read from the item, never open with a bare question the owner has no context for.

## Rules

- One branch, one item, per run. Never silently do two. Follow-up questions and tweaks on
  the same item in the same session are fine; a different branch or item is a new run.
- Never invent the opinion, the beats, or a fact — the procedures spell this out; it binds here too.
- Only ever writes through the procedures' CLIs (`develop-idea.ts` / `draft-store.ts` /
  `update-draft.ts` / `update-article.ts`) — plus, in the review branch only, the verdict
  writes the content-reviewer spec itself prescribes (`reviewStatus`, article stage). Never
  the voice card, pillars, register, feeds, or code, and never the content in a review.
- Never publish. Writing saves content onto the idea's queue card; the owner's Publish
  click is separate and unchanged.
