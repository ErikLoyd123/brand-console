---
name: voice
description: Edit the voice card — add or refine one hard rule, hook formula, named voice pattern, or AI-tell, or refresh a section — and save it to your profile. Reads the current card and identity for context, drafts the change in your voice, confirms it with you, and slots it into the right section preserving everything else. Never invents an opinion; the profile owner decides. Only touches the active profile's voice-card.md.
type: skill
---

# voice

Make a **targeted, incremental edit to the voice card** — the single source of truth every
drafter and reviewer reads first — and save it. This is the guided, conversational counterpart
to the console's manual voice-card editor, and the lighter sibling of `setup`: where `setup`
runs the full first-time interview (and also writes `interview.md` and walks `identity.yaml`),
`voice` changes **only** the active profile's `voice-card.md` (in `profiles/<slug>/`), one
thing at a time, on a card that already exists.

It **never invents an opinion, rule, or voice.** Its job is to draw the change out of the
profile owner in their own words, draft it grounded in how they already write, confirm it, and
place it correctly. The owner decides; the skill files.

**Invoke with:** "edit my voice card", "add a hard rule", "add a hook formula", "add an AI-tell",
"refine my voice card", or from the Voice page's AI mode.

## Onboarding gate (run before editing)

There must be a card to edit. Profiles are gitignored under `profiles/<slug>/`; a fresh clone
ships only `profile.example/`. `checkCompleteness()` resolves the **active** profile. Run:

```bash
npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
```

`checkCompleteness()` names `voice-card.md` in `missing` when it is absent or empty.

- If the card is missing/empty: this skill has nothing to edit. Say so plainly ("There's no
  voice card yet to edit"), and offer to run `setup`'s guided voice interview to author one
  first. One clear question with a recommended path. If the owner declines, stop gracefully —
  do not fabricate a card. Authoring from nothing is `setup`'s job, not this skill's.
- If the card is present: continue.

## Read the card and its context first

Before asking anything, load the owner's own material so every draft is grounded in how they
actually write, never generic. Read, quietly, up front:

Resolve the active profile's file paths first, so every read and write below targets the
right profile:

```bash
npx tsx -e "import('./src/profile/loader.ts').then(m => console.log(JSON.stringify({ card: m.voiceCardPath(), identity: m.identityPath() })))"
```

- **The voice card** (the `card` path above) — the full current card: its hard rules, named
  voice patterns, hook formulas, AI-tells restatement, CTA posture, protected-relationship
  prose, and anchor voice samples. This is what you are editing; know its sections and headings
  exactly so you slot a change into the right one. A `brand` profile's card has brand sections
  instead (positioning and audience, voice & register, banned claims / compliance lines,
  product-naming rules, approved proof points and framing, AI-tells, samples) — read what's
  actually there and work with its real headings, not an assumed personal shape.
- **`identity.yaml`** (the `identity` path above; for context only) — pillars, register, CTA
  policy, and the machine-checkable protected-relationships list. You read this to keep a card
  edit consistent with it; you never write it here.

## 1. Ask what to change — one focused choice

Open with a single `ask_user` choice. Offer the common card edits as options, plus free text so
the owner can describe anything in their own words:

- **Add a hard rule** — a new pass-or-fail rule the review gate should enforce in spirit.
- **Add / refine a hook formula** — a new opening move, or sharpen an existing one.
- **Add a named voice pattern** — a recurring move that makes the writing sound like them.
- **Add an AI-tell** — a word or tic to scrub or flag (a human-readable addition to the card's
  blocklist; see the boundary note below on where enforcement actually lives).
- **Refine a section** — reword or tighten an existing section without changing its intent.
- **Refresh the whole card** — a card-only re-walk of the sections, for a broader update. Stay
  on the card; full re-onboarding (interview + identity) is `setup`.
- **…or describe it** — free text; do exactly what they ask, nothing more.

For a **`brand` profile** (the profile row's `kind`), phrase the same menu in the card's brand
terms: a hard rule may be a banned claim or compliance line, a "voice pattern" is a house-style
move, hooks come from the brand's approved framing, and additions must respect the
product-naming rules and approved proof points — never invent a claim or proof point the
company hasn't stated.

Honor the choice: do only what the focus calls for. A free-text focus overrides the options —
follow it precisely.

## 2. Draw it out — never supply the opinion

Interview to the depth the chosen thing needs, and no deeper. The content must come from the
owner:

- For a **hard rule**: what is the rule, and what does breaking it look like? Rules are
  pass-or-fail — confirm it is meant to gate a draft, not just guide it.
- For a **hook formula**: the shape of the opening and a concrete one-line example in their
  voice. If they can give the example, use theirs; if not, propose one drawn from the card's
  existing samples and ask them to confirm or edit it — never ship an example they did not bless.
- For a **voice pattern**: name it (a short label) and describe the move plainly, grounded in a
  place they already do it.
- For an **AI-tell**: the exact word/phrase and, if useful, the tell it signals.
- For **refine / refresh**: read the target section back to them, propose the reworded version,
  and confirm before writing.

If the card gives you material to propose from, propose **one** concrete draft and ask them to
confirm or edit it. If it does not, ask them for it in their words. Either way, the owner blesses
the final text before it lands. Do not pad, do not add a second change they did not ask for.

## 3. Boundary — card prose only, and point elsewhere when it belongs elsewhere

You edit the active profile's `voice-card.md` and nothing else. Two cases where a request belongs on a
different surface — name the surface, do not silently diverge:

- **Machine-enforced protected relationships.** The card carries the *prose* on how a protected
  relationship is handled; the machine-checkable list that the review gate enforces lives in
  that profile's `identity.yaml` and is read by `src/review/voice-checks.ts`. If the owner wants to add
  or change a *protected party* (not just the prose), add the prose here and tell them the
  enforced list is set via `setup` / the identity config, so the two stay in sync.
- **Enforced AI-tells and the em-dash rule.** The universal AI-tells and em-dash checks are
  enforced in committed code (`src/review/voice-checks.ts`). The card's AI-tells list is a
  human-readable restatement and guidance, not a second enforcement source. Adding a tell to the
  card is fine and useful — just say plainly that the card entry informs, while the committed
  checks enforce, so the owner knows a card-only tell is guidance rather than a hard gate.

Never touch pillars, feeds, register, products, or other identity fields from here.

## 4. Write it

Make the edit directly in the active profile's card (the `card` path you resolved up front),
preserving everything else:

- **Targeted add / refine:** use the `Edit` tool to insert the new rule/hook/pattern/tell into
  its correct section (or to reword the target lines), leaving every other section byte-for-byte
  intact. Match the card's existing formatting — numbered lists stay numbered, bullet sections
  stay bulleted, headings unchanged.
- **Refresh the whole card:** use `Write` to save the reworked full card, keeping every section
  heading and the anchor voice samples.

Then **canonicalize and validate** the saved file through the guarded writer, which normalizes
the trailing newline and rejects an accidentally-emptied card:

```bash
# pipe the card you just edited — the resolved `card` path from "Read the card" above
npx tsx src/profile/write-voice-card.ts < "<resolved card path>"
```

(The writer itself resolves the active profile via the loader and saves there, so feeding it
the same resolved file round-trips cleanly.)

If it exits non-zero (e.g. "Voice card cannot be empty."), you broke the card — restore it and
report the problem rather than leaving it damaged.

## 5. Report

Report plainly what changed: which section, and the one rule/hook/pattern/tell you added or
refined, quoted back so the owner sees exactly what landed. Keep it to the one change. This final
report is what the console shows on the result card, so make it a clear, human sentence.

## Rules

- **One card, one focused change per invocation.** A second unrelated edit is a second run.
- **Only the active profile's `voice-card.md`.** Read `identity.yaml` for context; never write it. Point to
  `setup` / identity config for anything machine-enforced (protected relationships, the enforced
  AI-tells) rather than diverging the card from the code.
- **Never invent an opinion or voice.** Draw the change out of the owner and confirm the exact
  text before writing. If they will not supply the substance, stop — do not fill it in for them.
- **Preserve the rest.** An edit changes one section; every other section, heading, and the
  anchor voice samples stay intact. The card is the whole system's source of truth — do not
  quietly drop parts of it.
- **Never publish or draft.** This skill edits the voice; it does not write posts.
