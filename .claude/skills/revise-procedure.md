# Revise procedure (shared reference)

This is a shared, **non-invokable** procedure — the single written source for revising an
existing piece in the loaded profile's voice. It is referenced by the `queue` page skill
(the Queue is the review phase, so revision lives there), not run directly as a button. The
page skill routes here when the request is to revise/sharpen written content.

Work a **draft** into shape — the first line, the body, the close — in the loaded profile's
voice, and write the change back to the row the card shows. The piece already exists (a first
pass from a draft procedure, or hand-typed); this procedure makes it *better*: punch up a weak
opener, tighten a baggy body, fix a close that fizzles, cut what the owner asks to cut. It
refines; it does not review (the voice gate is `content-reviewer`) and it does not publish.

It **never invents an opinion** and never contradicts the owner's take. The argument is theirs,
carried in the idea's `seed` and `points`; the voice is fixed by the voice card. This procedure
sharpens the expression, not the position.

**Invoke with:** "revise this", "punch up the hook", "tighten this", "the close is weak", "cut
the last paragraph", or from a Queue card's **Revise with AI** button, whose first message
names the item and the draft to use and says what to change (or that it will say next).

## 1. Load everything in one call

One command gives you the draft the card shows, its idea, the register, the identity bits the
checks need, and the whole voice card. Pass the queue-item id from the message (a draft id
works too). From the repo root:

```bash
npx tsx src/draft/revise-context.ts "<itemId>"
```

Read the JSON: `draft` (`id`, `hookOptions`, `body`, `close`; **`draft.id` is the row you will
write**, the newest for the idea, resolved here so a revision never lands on an older row),
`idea` (`seed` and `points`, the take never to contradict; `silo`, which governs shape and the
hook rule; `length`, the band the body should sit in), `register` (tone guidance, soft
coloring), `identity`, and `voiceCard`. Read the voice card in full before touching a word:
the em-dash ban, the AI-tells blocklist, show-don't-tell, the generous tone, the CTA rule,
the hook formulas and banned hooks, the protected-relationship guardrail. A non-zero exit
means there is no draft yet (that is a write, not a revise) or no voice card (offer `setup`);
say so and stop. There is no separate onboarding gate: the loader is the gate.

Do not query the drafts table yourself, and do not run the other lookups the draft procedure
uses; this one call is the whole read.

## 2. Know what to change

If the message already says what to change, act on it. If it does not, ask **exactly one**
free-text question: what do you want changed? That is the only question a revision asks.

When the instruction is vague ("make it better", "tighten it", "it feels flat"), run the
intent's checklist against the draft and fix every item that fails, then say which ones in
the report:

- **teach / help:** the mechanism is named (a place, a setting, a number, a command, a
  before-and-after) and the reader could act on it; the close has an address, not a bare
  instruction; no idea is stated twice; the strongest line is the first line; the hook is not
  a voice card example sentence. If there is no mechanism in the draft or in `idea.points`,
  the fix is not wording: report that the post is below its floor and recommend filing it as
  `conversation` or asking the owner for the mechanism.
- **conversation / discuss:** the close is a question the owner cannot answer; the experience
  that raised it is told; no takeaway is smuggled in; the opening is the experience or the
  question, not a lesson.
- **win / share:** the hero is named and is not the owner (or the owner's own mistake is the
  story); one specific about the outcome; the owner's role inferred, never claimed.
- **curate:** the source is credited by name; the one reason it earned the share is in the
  owner's words; no bare link.
- **promote:** one plain sentence of what it does and for whom; one real specific; exactly one
  ask, in the close; under 900 characters.

**The band.** Read `idea.length` from the loader. When the requested change grows the post
past its band (adding the step, the trap, the "because"), do not cram: say so in the report,
recommend the next band, and in a console run take it, setting it with
`curl -s -X POST http://localhost:5174/api/queue/<idea.id>/length -H 'Content-Type: application/json' -d '{"length":"medium"}'`
before you write. When the change shrinks the post below its band, leave the band alone and
say the body now runs short of it; the owner may want it that way.
Never ask which item or which draft (the loader decided), never ask the owner to pick among
options you could recommend, and never ask them to confirm the text before you write it
(`.claude/skills/interaction-rules.md`): the console's question cards cannot carry a draft,
so the confirmation would show nothing, and the report at the end shows everything.

## 3. Make the change, and only that

Common moves, each obeying the voice card:

- **First line (hook).** Mine it from the body, as the draft procedure does: promote the line a
  stranger would stop on; no question hooks except a `conversation`/`discuss` post, no
  engagement bait. `hookOptions[0]` is what publishes (on Reddit, the title).
- **Body.** Tighten, cut filler, keep the `points` in order, strengthen the specific (every
  specific in the seed stays by name), scrub every AI-tell and em dash, stay in the band.
- **Close.** Land on one concrete thing from the body, or a real question for a conversation
  post; never a moral, never an ask the CTA rule forbids.

Preserve everything the owner did not ask you to change, byte for byte. Do not add a beat, an
opinion, or a claim that is not in the take or points; if the requested change would shift
what the post argues, say so in the report and make the smaller change that keeps the
argument. Never a `[FILL: ...]` placeholder: a fact you do not have is written around.

Self-check once before writing, with the changed fields:

```bash
DRAFT="<revised body>" CLOSE="<revised close>" SEED="<idea.seed>" POINTS='<idea.points as JSON>' SILO=<idea.silo> LENGTH=<idea.length> ADJACENT=<0|1> npx tsx -e "(async () => { const { loadIdentity } = await import('./src/profile/loader.ts'); const identity = loadIdentity(); const m = await import('./src/review/voice-checks.ts'); const points = process.env.POINTS ? JSON.parse(process.env.POINTS) : []; console.log(JSON.stringify(m.runVoiceChecks(process.env.DRAFT ?? '', { isProductAdjacent: process.env.ADJACENT === '1', silo: process.env.SILO, seed: process.env.SEED || undefined, points, close: process.env.CLOSE || undefined, length: process.env.LENGTH || undefined, protectedRelationships: identity.protected_relationships ?? [], products: identity.products ?? [] }), null, 2)); })()"
```

Fix any `fail` before writing. A `warn` is reported, not blocking.

## 4. Write it back

Write the changed fields to **`draft.id` from Step 1**, through a temp file so a multi-line
body never has to survive shell escaping:

```bash
cat > /tmp/revise-<draftId>.json <<'JSON'
{ "id": "<draft.id>",
  "hookOptions": ["<first line>", "<alt>"],
  "body": "<the revised body>",
  "close": "<the revised close>" }
JSON
npx tsx src/draft/update-draft.ts /tmp/revise-<draftId>.json
```

Include only the fields you changed. The CLI prints `Updated draft <id>: <fields>.`; anything
else is a failure to surface verbatim, not to paper over. Writing hook, body, or close resets
the draft's `reviewStatus` to `pending`. One write per run: a follow-up change in the same
session is another `update-draft` on the same id, never a `draft-store.ts` save (that would
add a second row and the card would show whichever landed last).

## 5. Report: the before and after, in full

The final message is the console's result card, and it is the only place the owner sees what
you did. It carries, for every field you changed, the text before and the text after, in
full, then one line on why. Fields you did not touch are named as untouched. End with the CLI's
`Updated draft ...` line so the write is on record. No summary in place of the text.

## Web (long-form) variant

When the idea under revision is a **web piece** (its `silo` is a piece kind / `platform` is
`web`), there is no draft row — the content is the article's `body`, one markdown document.
The same discipline applies, with these substitutions:

- **Read** the article and its idea (the lookup in
  `.claude/skills/article-draft-procedure.md` step 1) instead of the loader above.
- **Refine only what the owner asked** — a named section (a `##` block of the body), the
  opening, the close, the meta description — and preserve every untouched part of the
  document byte-for-byte.
- **Write back** through `npx tsx src/articles/update-article.ts <payload.json>` with
  `{ "id": "<articleId>", "body": "<the full revised document>" }` (plus
  `metaDescription`/`slug`/`title` only if asked). A body write resets the article's
  `reviewStatus` to `pending`, exactly like a draft revision.
- **Report** the changed section before and after, the same way. Publish/export remains the
  owner's action.

## Rules

- **One read, one write.** `revise-context.ts` in, `update-draft.ts` out, on the draft id the
  loader returned. Never query drafts yourself; never `draft-store.ts`.
- **One question at most**, and only "what do you want changed?" when the message did not say.
  Never a confirmation of text; the report shows it.
- **Only the drafts table** (`body`, `hookOptions`, `close`, `mediaSuggestion`) — or, for the
  web variant, only the articles row. Never the voice card, pillars, register, feeds, or code.
- **Never invent or shift the opinion.** The take and points are the owner's; you sharpen the
  expression, never the position. Never a placeholder.
- **Obey the voice card**, every rule. A revision that breaks one is worse than the original.
- **Report before and after in full.** Never review your own work (that is `content-reviewer`)
  and never publish.
