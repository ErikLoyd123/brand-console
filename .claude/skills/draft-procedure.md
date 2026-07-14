# Draft procedure (shared reference)

This is a shared, **non-invokable** procedure — the single written source for drafting one
idea-queue item into a post in the loaded profile's voice. It is referenced by the `queue` page
skill, not run directly as a button. The `queue` skill routes here when the request is to draft
an item.

Turn one idea-queue item into a draft in the loaded profile's voice. Input is an item id. Output is a saved draft with `reviewStatus` set to `pending`. This skill drafts. It never publishes and never reviews its own work; the review gate is a separate agent.

**Invoke with:** "draft post for item N", "draft this idea", or from the
Queue page's per-card **"Draft with AI"** button (which passes the item id in the first message
and says to use it — take that id directly, do not ask which item).

## Onboarding gate (run before anything)

Run this before loading the voice card or doing any work. This is the shared detect-and-offer gate (`.claude/skills/onboarding-gate.md`).

1. Check the active profile. Profiles are gitignored under `profiles/<slug>/`; a fresh clone ships only `profile.example/`. Run:

   ```bash
   npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
   ```

   `checkCompleteness()` (from `src/profile/completeness.ts`) returns `{ complete: boolean, missing: string[] }`; when `voice-card.md` is missing, empty, or lacking its anchors, `missing` names it.

2. This skill needs the active profile's `voice-card.md` present and complete. If it is, pass the gate and continue to Rule one. Otherwise stop and go to step 3.

3. Report plainly what is missing ("I don't see a voice card yet") and offer to run the `setup` skill's guided interview now. One clear question with a recommended path; name the alternative in step 5.

4. If the user accepts: hand off to `setup`, let it write the profile, then resume this draft against the now-complete profile.

5. If the user declines: stop gracefully. Write nothing. Report that it cannot draft in nobody's voice and that the setup interview is the unblock. `setup` is a separate skill; the gate only names and offers it.

## Rule one, load the voice card

Before writing a single word, load the voice card via the `voice-card` skill, which reads the active profile's `voice-card.md`. It is the source of truth for the loaded profile's voice: the em-dash ban, the AI-tells blocklist, show-don't-tell, the generous-not-corrective tone, the CTA rule, and the profile's protected-relationship guardrail(s). If it is not loaded, stop. Do not draft.

## Step 1, load the item

Read the item and its tag:

`npx tsx -e "import('./src/draft/draft-store.js').then(m => console.log(JSON.stringify(m.getIdeaForDraft(process.argv[1]), null, 2)))" <ITEM_ID>`

Note `silo`, `pillar`, `tag`, `proposedAngle`, `seed`, `points`, and the register columns
`platform` and `tone`. The `silo` (one of `conversation | teach | win | curate`) drives
Step 3's shaping. `platform`/`tone` are the register the item was shaped for (set by
`spark`; usually null for other paths) — Step 2b resolves them into concrete tone guidance.

`points` is the owner's **developed take** — an ordered list of the beats they want to make
(often drawn out by the develop procedure). When present, use it as the **spine of the body**:
work the beats in order, one movement each, in the loaded voice. It is the owner's argument,
so treat it like `seed` — expand and shape it, never contradict it, and never add a beat the
owner did not list. When `points` is empty, draft from `seed`/`proposedAngle` as before; a
developed idea simply gives you more to work with, it does not change the guardrail.

## Step 2, the take-origination guardrail

- If `tag` is `needs-your-take` and `seed` is empty or null: STOP. Do not draft and do not invent an opinion. Report: "Item N (needs-your-take) has no seed. It needs the profile owner's one-to-two-sentence take before it can be drafted." An agent does not get to decide what the profile owner thinks.
- If `tag` is `needs-your-take` and `seed` is present: draft the post around the seed as the spine. Expand and shape it in the loaded voice. Never contradict it, never add opinions it does not contain.
- If `tag` is `ready-to-draft`: draft from `proposedAngle`. This is factual or curation content (a tool worth surfacing, someone else's win, a clean fact). A template is fine because there is no opinion to fabricate.

## Step 2b, resolve the register (platform + tone)

Resolve the register the draft should be colored in. The item's `platform`/`tone` (Step 1)
may be null; `resolveRegister` folds them together with the profile's `platforms` selection
(`identity.yaml`) and the shipped menu (`src/core/registers.ts`), applying the fallback
chain (pinned → profile default → shipped `linkedin`). From the repo root:

```bash
npx tsx -e "import('./src/core/resolve-register.ts').then(m => console.log(JSON.stringify(m.resolveRegisterFromProfile(process.argv[1] || null, process.argv[2] || null), null, 2)))" "<item platform or empty>" "<item tone or empty>"
```

Note the returned `toneLabel`, `toneGuidance`, `toneNote` (the owner's personalization, if
any), and `format` (a soft length/threading hint). These **color** the draft in Step 3;
they are never hard rules. Register is guidance — the silo and the voice card still govern
shape and pass/fail.

## Step 3, write the draft, shaped by the item's silo, colored by the register

Branch on the item's `silo` (from Step 1). The silo, not the pillar, decides the shape,
the hook rule, the length rule, and whether there is an ask. A missing or unknown silo is
treated as `teach` (today's default). Read the silo off the row; never infer it from the
pillar, tag, or seed wording.

Within the silo's shape, **color** the writing with the resolved tone (Step 2b): the
`toneGuidance` and any `toneNote` shift the register of the language — punchier vs. measured,
warm vs. dry — and the `format` hint informs length and paragraphing softly. Tone never
overrides the silo's structure, the voice card, or the doctrine; if tone and silo ever pull
apart, silo wins. The tone colors *how* the silo-shaped post sounds, not *what* it is.

Produce four fields, all in the loaded profile's voice, all voice-card compliant:

- `hookOptions`: 3 to 5 first lines, each under 10 words, each a genuine hook (no
  clickbait, no em dashes). A **question** opening hook is banned for `teach`, `win`, and
  `curate`, but **allowed for `conversation`** (a conversation post opens a loop).
- `body`: shaped per silo (below). For any `needs-your-take` item the seed is the spine;
  never invent an opinion.
- `close`: shaped per silo (below).
- `mediaSuggestion`: one short suggestion (for example "screenshot of the thing you're
  describing" or "none").

**Per-silo shaping:**

- **teach** (today's behavior, unchanged). Body 1300 to 1900 characters; show, do not
  tell; lead with the useful, specific thing. Close is a soft, honest wrap. This is the
  **only** silo that may carry an ask, and only when the post genuinely touches a product:
  a tie-in may reference only a product named in the active profile's `identity.yaml` (`products`), and
  only if `cta_policy` allows it (`personal_posts_carry_ask` gates asks on non-product
  posts; `product_posts_max_ask_lines` caps product-adjacent asks; `ask_style` sets the
  tone). If the profile lists no products, or the policy forbids an ask here, the close
  carries none. No desperate call to action.
- **conversation.** Opens a loop instead of closing one: the body is the owner's thought
  or experience, built to pull replies, not to deliver a takeaway. The 1300-1900 floor is
  relaxed; shorter and tighter is good. The close is an invitation to reply and carries
  **no product ask, ever**. Keep the invitation in the owner's plain voice, never
  engagement bait ("agree? comment below" and "thoughts? comment below" are banned).
- **win.** A short, warm story. The hero is someone else, or, for a self-story, the owner
  is the one held accountable (never the aggressive hero). The 1300-1900 floor does not
  bind; brief is the target. No ask.
- **curate.** A generous pointer to someone else's tool, idea, or post; credit the source
  explicitly. Low-effort framing on purpose (the owner is a node passing something good
  along). Short; no length floor. No ask, no product tie-in; the only link is the credited
  source.

Self-check before saving: scan every field for em dashes and for AI-tells from the voice
card. Run the mechanical checks with the correct adjacency for the silo, from the repo
root (put the full draft text in `DRAFT`; only a `teach` post that genuinely touches a
product is adjacent):

```bash
DRAFT="$(cat path/to/draft.txt)" SILO=<silo> ADJACENT=<0|1> npx tsx -e "(async () => { const { loadIdentity } = await import('./src/profile/loader.ts'); const identity = loadIdentity(); const m = await import('./src/review/voice-checks.ts'); console.log(JSON.stringify(m.runVoiceChecks(process.env.DRAFT ?? '', { isProductAdjacent: process.env.ADJACENT === '1', silo: process.env.SILO, protectedRelationships: identity.protected_relationships ?? [], products: identity.products ?? [] }), null, 2)); })()"
```

For `conversation`, `win`, and `curate` the module forces adjacency to `false`, so any
stray ask fails here before it ships. Confirm `teach` body length is in range (the other
silos have no lower-length failure). Fix anything that fails. Re-read it aloud in the
loaded voice: bar-explaining-to-a-friend, not press release.

## Step 4, save via draft-store

Write the draft to a temp JSON file, then persist it with the draft-store CLI:

```bash
cat > .draft-payload.json <<'JSON'
{
  "ideaId": <ITEM_ID>,
  "hookOptions": ["...", "...", "..."],
  "body": "...",
  "close": "...",
  "mediaSuggestion": "..."
}
JSON
npx tsx src/draft/draft-store.ts .draft-payload.json
rm .draft-payload.json
```

The CLI prints `{"draftId":N,"ideaId":M,"status":"drafted"}`. Saving sets the draft's `reviewStatus` to `pending` and the item's status to `drafted`.

## Step 5, hand off

Report the new draft id **and the draft's silo, plus whether it is product-adjacent**
(only possibly true for `teach`; always false for the other three), **and the resolved
register (platform + tone)** from Step 2b. `content-reviewer` needs the silo to grade the
post by the right rules and the tone as soft context. The idea row's `silo` is authoritative either way. The
draft still has to pass `content-reviewer` and then the profile owner's edit-and-approve.
Nothing here publishes.

## Rules

- NEVER draft without loading the voice card first.
- NEVER invent an opinion for a needs-your-take item that has no seed. Surface it and stop.
- NEVER fabricate a specific real fact. If a draft needs a specific the profile owner has not provided (a number, which tool, what actually happened, a customer detail), leave a `[FILL: ...]` marker in place and surface it to the profile owner. Style can be generated; facts cannot.
- NEVER use an em dash. NEVER use an AI-tell from the blocklist.
- Shape by silo: only `teach` may carry an ask and holds the 1300-1900 body floor; `conversation` may open with a question and runs shorter; `win` and `curate` carry no ask and no length floor. 3 to 5 hooks, each under 10 words, for every silo.
- The register (platform + tone) is **soft coloring, never a hard rule**: it shifts the language's register and hints at length, but the silo, the voice card, and the doctrine govern. Tone never gates a draft and never enters the mechanical checks. If tone and silo conflict, silo wins.
- The output is a draft, never a published post.
