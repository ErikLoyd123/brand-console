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

Note `silo`, `pillar`, `tag`, `proposedAngle`, `seed`, `points`, `length`, and the register
columns `platform` and `tone`. The `silo` (a platform-keyed intent from `src/core/silos.ts`) drives
Step 3's shaping. `platform`/`tone` are the register the item was shaped for (set by
`spark`; usually null for other paths) — Step 2b resolves them into concrete tone guidance.

**Web guard:** if the `silo` is one of the web piece kinds (`how-to | explainer | comparison |
thought-piece | whitepaper`), this item is a **long-form article**, not a post — do not draft
it here. Stop and route to the long-form lane instead: the linked `articles` row (created by
`spark`/`discovery`) is written as one markdown document via
`.claude/skills/article-draft-procedure.md`. Without this guard the "unknown silo → teach"
default in Step 3 would silently draft a LinkedIn-shaped post from an article idea.

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

## Step 2c, settle the length band

How long the post runs is its own axis (bands in `src/core/lengths.ts`: short 300 to 600,
medium 700 to 1100, long 1300 to 1900 body characters). Read `length` off the row. When it is
set, draft to it. When it is null, **recommend one and ask, one question** (in decide-for-me
mode, take the recommendation and say so in a line; `.claude/skills/interaction-rules.md`):
start from the silo's default (`teach`/`help` lean medium; everything else leans short), then move it by the
material in `seed` and `points`. One gap or one claim is short. A mechanism is medium. A
mechanism plus the mistake people make plus the fix is long. Say which and why in one line
("this is one gap, so short; sound right?"), take the answer, and write it back so the card
shows it:

```bash
curl -s -X POST http://localhost:5174/api/queue/<ITEM_ID>/length -H 'Content-Type: application/json' -d '{"length":"medium"}'
```

The band is a target, not a floor: a few characters either side is fine, and no silo carries
a character floor any more; the floor is the intent's concrete thing (Step 3). When the
item's band cannot hold that thing (a short `teach` whose points carry the mechanism, the
trap, and the check), say so in one line, recommend the next band, and in decide-for-me mode
take it: set it with the same `POST /api/queue/<ITEM_ID>/length` call and write to it. Never
compress the floor to fit a band. The console's `length-band` check warns when the body lands
outside it.

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

Produce four fields, all in the loaded profile's voice, all voice-card compliant, **in this
order**: the body, then the close, then the hooks mined from them, then the media suggestion.
The hook is written last on purpose. The best first line already exists once the argument is
on the page; a hook composed before the body is the one the body never pays off.

- `body`: shaped per silo (below) and sized to the item's band (Step 2c). For any
  `needs-your-take` item the seed is the spine; never invent an opinion. On Reddit the body
  and close publish as the **markdown self-post body** under the title; plain markdown
  (paragraphs, a list if it earns it) is fine there. Every specific in `seed` and `points`
  appears in the body by name (doctrine Principle 5, `.claude/skills/content-doctrine.md`).
  Do not generalize a named tool, number, or mechanism into a category; the `seed-retention`
  check fails the draft when one goes missing.
- `close`: shaped per silo (below). It lands on one concrete thing from the body, or for
  `conversation` a real question. Never an aphorism, an encouragement, or a summary of the
  genre ("stay curious", "worth a second look"); the `aphorism-close` check flags those.
- `hookOptions`: **mined, not composed.** Read the finished body and close for the sentence a
  stranger scrolling would stop on, and promote it to line one; cut it from where it sat
  unless it reads as a callback. Offer 3 to 5 such lines, each under 10 words, each a genuine
  hook (no clickbait, no em dashes). LinkedIn shows about three lines before "see more", so
  the hook plus the body's first line must carry the claim. A **question** opening hook is
  banned for `teach`, `win`, and `curate` on LinkedIn and `help`, `share`, `ask`, and `curate`
  on Reddit, but **allowed for `conversation` and `discuss`** (their job is to open a loop).
  On Reddit the hooks double as **title candidates**: the first hook becomes the self-post
  title (hard cap 300 characters; the console shows the count), written plain, no bait.
- `mediaSuggestion`: one short suggestion (for example "screenshot of the thing you're
  describing" or "none").

**Per-silo shaping — LinkedIn** (plus the shared `curate`):

- **teach.** Body sized to the item's band (medium by default; long only when the mechanism,
  the mistake, and the fix all belong in one post); show, do not tell; lead with the useful,
  specific thing, then explain the one mechanism behind it in prose. The floor: the body names
  the mechanism from `points` (a place, a setting, a number, a command, a before-and-after) so
  the reader could act on it; a body that only asserts a gap exists is not a teach, stop and
  say so. The close carries an address (where to look), never a bare instruction. No First/Second/Third, no "three
  things", no numbered list unless the owner's points are themselves a list of three or more,
  and prose is still preferred then (the `list-cadence` check flags the scaffolding). Close is
  a soft, honest wrap that restates the specific, never a moral. Apart from `promote`, this
  is the **only** silo that may carry an ask, and only when the post genuinely touches a product:
  a tie-in may reference only a product named in the active profile's `identity.yaml` (`products`), and
  only if `cta_policy` allows it (`personal_posts_carry_ask` gates asks on non-product
  posts; `product_posts_max_ask_lines` caps product-adjacent asks; `ask_style` sets the
  tone). If the profile lists no products, or the policy forbids an ask here, the close
  carries none. No desperate call to action.
- **conversation.** Opens a loop instead of closing one: the body is the owner's thought
  or experience, built to pull replies, not to deliver a takeaway. The floor: the experience
  that raised the question is told, and the close is a question the owner genuinely cannot
  answer; a takeaway smuggled into the close makes it a teach. Short band by default;
  shorter and tighter is good. The close is an invitation to reply and carries
  **no product ask, ever**. Keep the invitation in the owner's plain voice, never
  engagement bait ("agree? comment below" and "thoughts? comment below" are banned).
- **win.** A short, warm story. The hero is someone else, or, for a self-story, the owner
  is the one held accountable (never the aggressive hero). The floor: the hero is named (or
  the owner's own mistake is), what they did is told, and one specific about the outcome is
  in the body; the owner's role is inferred, never claimed. Short band by default; brief is
  the target. No ask.
- **curate** (shared by LinkedIn and Reddit). A generous pointer to someone else's tool,
  idea, or post; credit the source explicitly. The floor: the source by name and the one
  reason it earned the share, in the owner's words; without the reason it is a bare pointer,
  stop and say so. Low-effort framing on purpose (the owner is
  a node passing something good along) — but never a **bare link-drop**: at least a line
  of the owner's own framing around the link (Reddit treats bare links as spam, and the
  mechanical check flags it on both platforms). Short; no length floor. No ask, no product
  tie-in; the only link is the credited source.
- **promote.** The direct-promotion post, and the only silo whose close *is* the ask. Body
  400 to 900 characters: one plain paragraph on what the product does and for whom, in the
  owner's words, plus one real specific (a finding, a number, a screenshot the owner names).
  Where the owner has not supplied the specific, ask for it before writing; a promote cannot
  ship without one, and a placeholder is not one. No stacked benefit list, no hype. Close is the single ask, worded per
  `cta_policy.ask_style`, and nothing else; it references only a product named in the active
  profile's `identity.yaml` (`products`). `mediaSuggestion` leans to a screenshot or a short
  recording: product proof is shown, not told.

**Per-silo shaping — Reddit** (the register from Step 2b is a subreddit-plain voice; every
shape below reads as a community member talking, never marketing):

- **discuss** — the conversation-analog. Opens a genuine discussion instead of closing
  one: the body is the owner's real question or half-resolved thought, framed to invite
  disagreement. No packaged takeaway required; shorter and tighter is good, no length
  floor. The close invites replies plainly (never "thoughts? comment below" bait). A
  question opening is allowed — it is the silo's job. **No product ask, ever.**
- **help** — the teach-analog. Lead with the concrete answer to the concrete problem;
  show, don't tell. Substantial like a `teach` body (medium band by default; long when the
  answer needs it) — a thin answer reads as karma-farming. This is the **only Reddit silo that may
  be product-adjacent**, gated by the same `cta_policy` rules as `teach`, and Reddit's
  norms bind harder: at most one soft, honest line, with the owner's affiliation stated
  plainly ("I work on X"). If the policy forbids it or no product genuinely applies, no
  ask. No question opening.
- **share** — the win-analog with the brag stripped out. A first-person experience or
  result told plainly; no hero framing, no humble-brag, no lesson-packaging required.
  Brief is the target; no length floor. No ask, no question opening.
- **ask** — solicits the community's input. A sentence or two of honest context, then the
  question the owner actually wants answered, stated exactly. The post **ends on the
  question** — the close is the question (or a one-line thanks after it), and carries no
  ask beyond it. Short; no length floor. No question *opening* (the question is the
  destination, not the hook).

Self-check before saving: scan every field for em dashes and for AI-tells from the voice
card. Run the mechanical checks with the correct adjacency for the silo, from the repo
root (put the full draft text in `DRAFT`; only a `teach` or `help` post that genuinely
touches a product is adjacent):

```bash
DRAFT="$(cat path/to/body.txt)" CLOSE="$(cat path/to/close.txt)" SEED="<seed>" POINTS='["<beat 1>","<beat 2>"]' SILO=<silo> LENGTH=<short|medium|long> ADJACENT=<0|1> npx tsx -e "(async () => { const { loadIdentity } = await import('./src/profile/loader.ts'); const identity = loadIdentity(); const m = await import('./src/review/voice-checks.ts'); const points = process.env.POINTS ? JSON.parse(process.env.POINTS) : []; console.log(JSON.stringify(m.runVoiceChecks(process.env.DRAFT ?? '', { isProductAdjacent: process.env.ADJACENT === '1', silo: process.env.SILO, seed: process.env.SEED || undefined, points, close: process.env.CLOSE || undefined, length: process.env.LENGTH || undefined, protectedRelationships: identity.protected_relationships ?? [], products: identity.products ?? [] }), null, 2)); })()"
```

For every silo except the teach-shaped one of each platform (`teach` on LinkedIn, `help`
on Reddit) the module forces adjacency to `false`, so any stray ask fails here before it
ships. Confirm the body sits in its band (the `length-band` warn names the gap) and that
the seed's specifics survived. Fix anything that fails. Re-read it aloud in the loaded voice:
bar-explaining-to-a-friend, not press release.

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

Report the new draft id **and the draft's silo and length band, plus whether it is product-adjacent**
(only possibly true for the teach-shaped silo — `teach` on LinkedIn, `help` on Reddit —
and for LinkedIn's `promote`, and always false for every other silo), **and the resolved
register (platform + tone)** from Step 2b. `content-reviewer` needs the silo to grade the
post by the right rules and the tone as soft context. The idea row's `silo` is authoritative either way. The
draft still has to pass `content-reviewer` and then the profile owner's edit-and-approve.
Nothing here publishes.

## Rules

- NEVER draft without loading the voice card first.
- NEVER invent an opinion for a needs-your-take item that has no seed. Surface it and stop.
- NEVER fabricate a specific real fact, and NEVER leave a placeholder for one. If a draft needs a specific the profile owner has not provided (a number, which tool, what actually happened, a customer detail), ask for it before writing; if they do not have it, write around the gap and say so in the hand-off. A `[FILL: ...]` marker in saved text fails the `no-fill-markers` check. Style can be generated; facts cannot.
- NEVER use an em dash. NEVER use an AI-tell from the blocklist.
- NEVER drop a specific from the seed or points; carry it by name (Principle 5).
- NEVER close on an aphorism; the close lands on a specific from the body or, for a conversation post, a real question.
- NEVER scaffold a teach post as a list unless the owner's points are a list; explain the mechanism in prose.
- Shape by silo, on either platform: only the teach-shaped silo and LinkedIn's `promote` may carry an ask; only the conversation-shaped silo may open with a question (`conversation`, `discuss`); every other silo carries no ask. Length is the item's band, never a silo floor: short 300-600, medium 700-1100, long 1300-1900 body characters (`src/core/lengths.ts`); `teach`/`help` default to medium, everything else to short, and `promote` runs 400-900. 3 to 5 hooks, each under 10 words, mined from the finished body, for every silo; on Reddit the first hook is the self-post title (300-char hard cap).
- NEVER write the hook first. Write the body and the close, then promote the line a stranger would stop on. A hook the body never pays off is a tell.
- NEVER lift a hook from the voice card's own example sentences; they are shapes to learn from, not lines to reuse.
- NEVER write a post below its intent's floor (doctrine Principle 3; the mechanism, the real question, the named hero, the credited reason, the one specific). If the item's `points` do not carry it, stop and say what is missing and which kind the item actually is.
- Obey the shared interaction rules (`.claude/skills/interaction-rules.md`): the hand-off shows the saved hook, body, and close in full, and a run in decide-for-me mode takes the recommended band and hook without asking.
- Save once per run. The self-check runs before Step 4; if something still needs fixing after the save, fix it on the saved draft with `npx tsx src/draft/update-draft.ts` (the revise procedure's writer), never with a second `draft-store.ts` save. Two draft rows for one run leave the card showing whichever landed last.
- The register (platform + tone) is **soft coloring, never a hard rule**: it shifts the language's register and hints at length, but the silo, the voice card, and the doctrine govern. Tone never gates a draft and never enters the mechanical checks. If tone and silo conflict, silo wins.
- The output is a draft, never a published post.
