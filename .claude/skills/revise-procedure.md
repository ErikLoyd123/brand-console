# Revise procedure (shared reference)

This is a shared, **non-invokable** procedure — the single written source for revising an
existing draft in the loaded profile's voice. It is referenced by **both** the `queue` and
`drafts` page skills (each can revise a draft), not run directly as a button. The page skill
routes here when the request is to revise/sharpen a draft.

Work a **draft** into shape with the owner — the hook options, the body, the close, the media
suggestion — in the loaded profile's voice, and write the changes back. This is the AI surface
on the Drafts screen: the draft already exists (a first pass from the draft procedure, or hand-typed),
and this skill helps make it *good* — punch up a weak hook, tighten a baggy body, fix a close
that fizzles, restructure around the owner's points. It refines; it does not review (the voice
gate is `content-reviewer`) and it does not publish.

It **never invents an opinion** and never contradicts the owner's take. The argument is theirs —
carried in the idea's `seed` and `points` — and the voice is fixed by the voice card. This skill
sharpens the expression, not the position.

**Invoke with:** "revise this draft", "punch up the hook", "the body buries the lede", "tighten
this", "the close is weak", or from the Drafts page's **"Revise with AI"** button (which passes
the draft id in the first message and says to use it — take that id directly, do not ask which).

## Onboarding gate (run before revising)

A draft is written in the owner's voice, so the voice card must exist:

```bash
npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
```

If the active profile's `voice-card.md` is missing/incomplete, say so and offer `setup`; stop gracefully if
declined. Do not revise in a voice that does not exist.

## Rule one — load the voice card

Load the voice card (via the `voice-card` skill / read the active profile's `voice-card.md`) before touching
a word. It is the source of truth: the em-dash ban, the AI-tells blocklist, show-don't-tell, the
generous tone, the CTA rule, the hook formulas and banned hooks, and the protected-relationship
guardrail. Every revision must obey it. If it will not load, stop.

## 1. Pick the draft

If the first message gives a draft id (the console's "Revise with AI" button passes one and says
not to ask), **use it directly.** Otherwise resolve the draft the user means, or list recent
drafts and ask.

## 2. Read the draft and its idea

Load the draft and the idea it came from so the revision stays true to the owner's argument:

```bash
# The draft itself (hook options, body, close, media, reviewStatus).
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {drafts}=await import('./src/db/schema.js');const {eq}=await import('drizzle-orm');console.log(JSON.stringify(db.select().from(drafts).where(eq(drafts.id, process.argv[1])).get(),null,2))})" "<draftId>"
# The originating idea — the owner's take and the beats the body should carry.
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {drafts,ideaQueueItems}=await import('./src/db/schema.js');const {eq}=await import('drizzle-orm');const d=db.select().from(drafts).where(eq(drafts.id, process.argv[1])).get();console.log(JSON.stringify(d?db.select().from(ideaQueueItems).where(eq(ideaQueueItems.id,d.ideaId)).get():null,null,2))})" "<draftId>"
```

Note the idea's `seed` (the take — never contradict it), `points` (the beats the body should
work in order), `silo` (the intent — it governs shape and the hook rule), and `platform`/`tone`
(the register to color it). The draft's current `body`/`hookOptions`/`close` are what you edit.

## 3. Refine what the owner asked — and only that

Interview lightly, or act on the directive they already gave. Common moves:

- **Hook** — offer 2-3 fresh options that fit the voice card's hook formulas (and avoid the
  banned hooks: no question hooks except a `conversation`/`discuss` post, no engagement bait).
- **Body** — tighten, cut filler, restructure around the `points` in order, strengthen the
  specific/concrete (show-don't-tell), scrub every AI-tell and em-dash.
- **Close** — make it land without an engagement-bait ask; honor the CTA rule (most posts carry
  no ask).

Preserve everything the owner did not ask you to change. Do not add a beat, an opinion, or a
claim that is not in the take/points. When you propose a rewrite, show it and confirm before
writing — the owner's judgment governs.

## 4. Write it back

Write the refined fields to the draft. Because a body can be long and multi-line, write the
payload to a temp file and pass its path (never a shell arg), exactly like the draft procedure does:

```bash
cat > /tmp/revise-<draftId>.json <<'JSON'
{ "id": "<draftId>",
  "hookOptions": ["<strongest>", "<alt>"],
  "body": "<the revised body>",
  "close": "<the revised close>" }
JSON
npx tsx src/draft/update-draft.ts /tmp/revise-<draftId>.json
```

Include only the fields you changed. Writing any of hook/body/close resets the draft's
`reviewStatus` to `pending` (a revised draft is no longer covered by a prior review) — the
console re-runs the mechanical checks and the `content-reviewer` gate is still the pass/fail
authority. An unknown id is surfaced verbatim — fix and retry.

## 5. Report

Report plainly what you changed — which parts, and the gist of the revision — so the owner sees
it at a glance. This is the console's result card: one clear, human sentence.

## Rules

- **Only the drafts table** (`body`, `hookOptions`, `close`, `mediaSuggestion`). Read the idea
  and the voice card for context; never write them, the queue, or code.
- **Never invent or shift the opinion.** The take and points are the owner's; you sharpen the
  expression, never the position. If a revision would change what the post argues, stop and ask.
- **Obey the voice card**, every rule — em-dash ban, AI-tells, show-don't-tell, hook formulas,
  CTA rule, protected relationships. A revision that breaks one is worse than the original.
- **Confirm before writing**, preserve everything untouched, one draft per run, then report.
  Never review your own work (that is `content-reviewer`) and never publish.
