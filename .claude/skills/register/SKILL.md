---
name: register
description: Shape one platform's register — the tones you sound in and the themes you return to — and save it to your profile. Reads your voice card and the shipped tone menu for context, teaches what each tone means, draws out how it sounds in your voice, helps you name new custom tones, and writes it to identity.yaml per platform. Only touches the register axis, never the voice card itself.
type: skill
---

# register

Shape the **register axis** for one platform — the tones you sound in and the themes you keep
returning to, and how each sounds *in your voice* — and save it to your profile. `register` is
the guided, conversational counterpart to the console's Register editor. It **teaches** what
each tone means, helps you put words to how you actually sound on that platform, and makes
naming a brand-new tone a first-class step. It does that one axis and nothing else.

`register` **reads** your voice card and identity for context so its guidance is grounded in
how you actually write — but it never edits the voice card. That is a separate concern owned
by the `voice` / `setup` skills. All three read from the same gitignored profile folder;
this one only writes the `platforms:` block.

**Invoke with:** "set up my register", "shape my Reddit voice", "what tones do I lean on", or
from the Register page's AI mode.

## Onboarding gate (run before walking)

1. Confirm a profile exists and parses. Profiles are gitignored under `profiles/<slug>/`; a fresh clone ships only
   `profile.example/`. Run:

   ```bash
   npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
   ```

2. `register` only needs the active profile's `identity.yaml` to exist and parse — the `platforms:` block
   it writes has a shipped default and never blocks completeness, so a profile with no
   platforms configured yet is the normal first-run case. If `identity.yaml` is missing
   entirely, say so plainly and offer to run `setup` first; stop gracefully if the user
   declines. Otherwise continue.

## Read the profile for context first

Before asking anything, load the user's own material so the walk is grounded in how they
actually write, not generic. Read all three, quietly, up front:

```bash
# The shipped tone/theme menu per platform (committed structure, read-only).
npx tsx -e "import('./src/core/registers.js').then(m => console.log(JSON.stringify(m.getPlatforms().map(k => m.getRegister(k)), null, 2)))"
# The current per-platform selection (what's already leaned on).
npx tsx -e "import('./src/profile/loader.js').then(m => console.log(JSON.stringify(m.loadIdentity().platforms ?? [], null, 2)))"
```

Then read **the active profile's `voice-card.md`** if it exists — the distilled voice (hard rules, anchor
samples, any register-per-platform notes). This is your context for proposing how each tone
sounds in *this* person's voice. If the card is missing or thin, the walk still runs; it just
leans on the shipped guidance and the user's own words instead of proposing voice-matched
phrasings. **Never invent voice the card doesn't support** — a thin card means thinner
suggestions, not fabricated ones.

## The shipped menu is structure; your selection is what we write

The tone and theme **menu** is committed product structure in `src/core/registers.ts`, uniform
for every profile — each tone carries a plain-language `guidance` line (what it means) that you
use to teach it. Your **selection** — which you lean on, your per-tone voice notes, and any
custom tones — layers on top in `identity.yaml`, and is the only thing this skill writes.
Custom tones/themes (a `key` the menu doesn't define) are per-user and welcome; they live only
in `identity.yaml`, never in `src/core/registers.ts`.

## The flow

Guided, one thing at a time — explain, then ask. Not a checklist quiz. It converges on one
platform's register per invocation.

### 1. Pick the platform — whose voice are we shaping

Ask which platform to shape (offer `getPlatforms()`, noting which are already configured).
Read that platform's `format` and let it frame everything below: the **same tone sounds
different per platform** — LinkedIn's short hook-led feed post vs Reddit's plain, specific
markdown self-post. One platform per run.

### 2. Orient, then ask what to focus on

First, one or two plain sentences: **tones** are *how you sound*; **themes** are *the subjects
you keep returning to*. Both are specific to this platform. This is where you teach, not test.

Then **ask what the user wants to focus on this session**, and do only that — don't force a
full walk on someone who wants one thing. Offer these as options (an `ask_choice`, free text
allowed):

- **Tones** — walk the tones (how you sound).
- **Themes** — walk the themes (what you return to).
- **New ones** — skip straight to naming custom tones and/or themes the menu doesn't ship.
- **Everything** — the full walk: tones, themes, and new ones.
- **…or write your own** — let them say it in their words (e.g. "just update the voice notes on
  my existing tones", "only my Reddit dry-wit note"). Adapt to exactly what they ask.

Honor the choice: run only the steps below that the focus calls for, and skip the rest. "New
ones" jumps to Step 4 (naming customs) for tones, themes, or both. A free-text focus overrides
the fixed options — do precisely what they described, nothing more.

### 3. Walk each tone — teach it, then draw out the user's voice

*(Run this if the focus is **Tones** or **Everything** — or if a free-text focus calls for it.)*

For each of the platform's shipped tones, one at a time:

- **Teach it.** Say what the tone means in plain words, from its `guidance`.
- **Ground it in their voice.** If the voice card gave you something, **propose one concrete
  line** of how *their* version of this tone sounds on *this* platform, drawn from their
  samples and rules — then ask them to confirm or edit it. That confirmed line (or a short
  description in their words) becomes the tone's `note`. If the card gave you nothing, offer a
  neutral one-line example and ask how it sounds in their words instead.
- **Confirm the lean.** Whether they actually lean on this tone here — soft guidance, never a
  hard rule. Lean toward keeping the ones that fit and **filling the note** rather than leaving
  it blank (an empty selection reads as unconfigured on the Register screen).

- **Save it as you go.** The moment the user confirms a leaned tone's note, persist *that one
  note* immediately so it lands in its "how it sounds in your voice" box in the console while
  the walk continues (the page refreshes on each step):

  ```bash
  npx tsx src/profile/write-register.ts --note <platform-key> tones <tone-key> "<the confirmed note>"
  ```

  This updates only that one field, leaving every other lean untouched (it appends the tone if
  it wasn't leaned yet — e.g. a custom tone you just named). Do this per tone as you confirm
  it, not batched at the end. The authoritative full selection is still written once in Step 7.

If the user already understands the tones and only wants to **update the notes** (the "how it
sounds in your voice" fields), honor that — skip the teaching and go tone by tone, drawing out
and saving each note with the `--note` write above. The per-note write never unchecks another
tone, so a notes-only pass is safe.

### 4. Name new tones — a first-class step

*(Run this if the focus is **New ones** or **Everything**; it's also the whole point when the
user picked "New ones".)*

Explicitly invite it, don't treat it as an afterthought: *"Is there a way you write on
[platform] that none of these name?"* If yes, help them **name it** (a short kebab-case key)
and **describe how it sounds** (the note), drawing on the voice card. A custom tone is an
ordinary `{ key, note }` entry the shipped menu doesn't define; it lives only in
`identity.yaml`.

### 5. Themes — same shape, lighter

*(Run this if the focus is **Themes**, **New ones**, or **Everything**.)*

Themes are the recurring subjects the user returns to. Walk the shipped ones the same
explain-then-ask way, invite a **custom theme** ("a subject that's yours"), and capture a short
note each. Save each confirmed theme note as you go, exactly like tones but with `themes`:

```bash
npx tsx src/profile/write-register.ts --note <platform-key> themes <theme-key> "<the confirmed note>"
```

Themes are optional; an empty list is valid.

### 6. Confirm active and default — light, near the end

*(For the full walk. Skip it for a narrow focus — e.g. a notes-only tweak — where active/default
isn't changing.)*

Only now, quickly: is this platform **active** (does the user post here)? Is it the
**default** (the one `spark`/`queue` assume when a spark names none)? Don't open the walk
with this. Exactly one active platform is the default; making this platform the default moves
it here.

### 7. Write it

The progressive `--note` writes filled the boxes as you went; this final write is the
**authoritative reconcile** — it sets `active`/`default` and the complete leaned set, dropping
any tone the user ultimately did *not* lean on (a per-note write can't remove one). Include
every leaned tone/theme with its final note. Pass the whole selection as one JSON object:

```bash
npx tsx src/profile/write-register.ts '{
  "key": "<platform-key>",
  "active": true,
  "default": <true|false>,
  "tones":  [ { "key": "<tone-key>",  "note": "<how it sounds in their voice>" } ],
  "themes": [ { "key": "<theme-key>", "note": "<their note>" } ]
}'
```

- `key` must be a platform from `getPlatforms()` (`linkedin` or `reddit` today). An unknown key
  is rejected with a `ValidationError` — surface it verbatim, don't guess.
- Include every tone/theme leaned on (shipped or custom) with its note; omit the rest.
- The CLI upserts this one platform into `identity.yaml`, preserving every other platform's
  entry and the file's comments, and moves the default here when `"default": true`.

### 8. Report

Report what landed: the platform, active/default, and the leaned tones and themes with any
custom ones named. Stop after one platform.

## Rules

- One platform's register per invocation. A second platform means a second `register` run.
- Only the `platforms:` axis. **Read** the active profile's `voice-card.md` for context but never write it —
  the voice card belongs to the `voice` / `setup` skills. Never touch pillars, feeds,
  products, or other identity fields.
- Teach before you ask. The value of this walk is that the user leaves understanding what each
  tone means and with real words for how they sound — not a set of checked boxes.
- The shipped menu (`src/core/registers.ts`) is read-only structure; the selection and custom
  entries are the only things written. A lean is soft guidance, not a hard rule.
- Ground suggestions in the voice card; never fabricate voice it doesn't support. A thin card
  means thinner notes, not invented ones.
