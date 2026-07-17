---
name: setup
description: Populate the active profile (its gitignored profiles/<slug>/ folder) so the content engine drafts and reviews in its voice, with none of anyone else's data. Two independent stages, a guided voice interview that distills voice-card.md (raw answers saved to interview.md after every question, so an interrupted interview resumes where it left off) and a knob-walk that fills identity.yaml, plus an optional offer to set up local image generation (or defer it for good). Brand-aware — a personal profile gets the personal interview, a brand profile the company one. Idempotent and re-runnable. Invoke with "run setup", "set up my profile", or when an onboarding gate offers it.
type: skill
---

# setup

`setup` populates the **active profile's** gitignored folder (`profiles/<slug>/`) so the content engine drafts and reviews in its voice, with none of anyone else's data. It has two independent stages, because identity comes in two shapes. Stage A is a guided voice interview, distilled into that folder's `voice-card.md` with the raw answers saved to `interview.md`. Stage B is a knob-walk that fills `identity.yaml`. Run both on a fresh profile, or re-run either one alone to update. This skill is committed and generic: everything it produces lands in the gitignored `profiles/` tree, never in the committed tool, and this file must never be edited to add anyone's personal data.

The profile schema, the file shapes, and the completeness contract are owned by design `01-profile-model` and implemented in `src/profile/loader.ts` and `src/profile/completeness.ts`. This skill writes files that satisfy that contract and validates against it before reporting done. It reads `profile.example/` only as a neutral reference menu.

**Invoke with:** "run setup", "set up my profile", "redo my voice interview", "update my pillars", or when an onboarding gate offers to run setup for a missing or incomplete profile.

## What a complete profile is

Before and after running, judge completeness by the phase 01 contract, the same predicate `src/profile/completeness.ts` enforces for the onboarding gate:

- All three files exist and are non-empty in the active profile's folder: `voice-card.md`, `interview.md`, `identity.yaml`.
- `identity.yaml` parses as valid YAML.
- `display_name` is present and non-empty.
- `pillars` has at least one entry; each has a non-empty `key`, a non-empty `label`, and a numeric `weight`; the `key` values are unique.
- `feed_groups`, where present, are internally consistent: every group's `pillar` matches a declared `pillars[].key`, every group has at least one source, and every source has both a `name` and a `url`. Zero feed groups is still complete.
- `voice-card.md` contains at least one hard-rules section and at least one anchor voice sample.

Everything else (`products`, `protected_relationships`, per-group `keywords` and `default_tag`, `cta_policy`, `enabled_lenses`, `lenses`) has a working default and never blocks completeness.

## Step 0: detect what exists and route

Resolve **where to write** first — every read and write in both stages targets the active profile's directory, never a hardcoded path:

```bash
npx tsx -e "import('./src/profile/loader.ts').then(m => console.log(m.resolveActiveProfileDir()))"
```

All file references below (`voice-card.md`, `interview.md`, `identity.yaml`) live in that directory. Then read what's already there before writing anything. `setup` is the **universal profile configurator**: use it to onboard a fresh profile, to **backfill** sections a profile predates or never filled, or to **adjust** anything already set. It is idempotent — it completes gaps and updates in place, and it never wipes an existing profile.

**Always open by telling the owner where they stand.** The very first question of every run states, in one plain sentence, what already exists and what this run will do — the owner may be resuming after an interruption and must never be dropped into a mid-setup question with no context. Then route by state:

- **Nothing yet** (the active profile's folder is empty or a bare skeleton — a just-created profile awaiting setup): say this is a fresh profile and setup has two parts (a voice interview, then a short settings walk), then run a full first pass, Stage A then Stage B — and close with the optional Stage C offer (local image generation) if it is neither set up nor deferred, plus one plain pointer to the optional **brand look** (the console's Brand page, or the `brand` skill) so image styling is discoverable — point, don't walk it; the walk is the `brand` skill's job. (If no profile row exists at all, the command above says so — have the user create one from the console's sidebar switcher first, or via `POST /api/profiles`.)
- **Partial** (some files or required fields missing per the contract above): the owner is here to **finish setup** — do not present a menu of everything setup can do. Open with the status plus a single confirm (e.g. "Your voice interview is done — all that's left is the settings file: pillars, platforms, and a few options. Pick up where we left off?" with options like *Finish setup* / *Something else*), then walk **only the missing required pieces** straight through to complete. Do not re-ask what is already answered.
  - **A partial interview counts as partial, not fresh.** If `interview.md` exists but carries the in-progress note (or clearly covers only some themes) and `voice-card.md` is absent, the interview was interrupted mid-run. Read `interview.md` in full, tell the owner exactly where they left off ("your answers through voice mechanics are saved; two themes remain"), and **resume from the first uncovered theme or the noted next question — never re-ask a question whose answer is already in the file, and never restart from question one.** The saved answers are the owner's time; treat them as authoritative.
- **Complete**: nothing is required, so the opening question is a **menu**: say the profile is complete, then offer what to update — redo or refresh the voice card (Stage A), a specific `identity.yaml` field or the whole knob-walk (Stage B) — **and always scan for unconfigured optional sections to backfill**. A profile can satisfy the completeness contract yet still have never-configured optional config — most importantly the register/`platforms` axis on a profile written before that axis existed, plus `feed_groups`, `products`, `protected_relationships`, `enabled_lenses`, or a `cta_policy` left at defaults — plus the profile's **brand look** (`profiles/<slug>/brand/`; absent means images render unbranded — offer the pointer to the Brand page or the `brand` skill, never walk it here) — and, app-wide rather than per-profile, **local image generation** (Stage C) when it is neither set up nor deferred. This is how an existing install learns about a newly shipped capability: the scan surfaces it once, and a defer makes the scan stay quiet about it from then on. Name what is unset and offer to backfill it; default to a Stage B direct edit for a one-field change, and offer Stage A re-distillation to refresh the voice card.

**Backfill is not gated by completeness.** An optional section being absent is a normal thing to detect and offer to fill, not an error. Treat "this axis exists in the schema but your profile never set it" the same as any other gap: surface it plainly and offer to walk it. This is what makes `setup` universal — it is the one place to configure *any* profile field, whether first-run, newly added, or being changed.

Never force a user through a stage they do not need. Confirm the scope, then proceed. `setup` is surfaced in the console (a skill button that runs it in the embedded terminal), so any of these — onboard, backfill, adjust — can be run in-app.

**Question style, every stage.** One knob or theme per question. The prompt is the question itself in plain words — a sentence or two, no section headings, no markdown scaffolding, no engine jargon (say "may posts mentioning it end with an ask, like a demo link?", not "product-adjacent CTA eligibility"). Teaching, examples, and trade-offs belong in the option descriptions, not the prompt.

**Detect the active profile's `kind`.** Stage A forks on whether this profile is a person or a
company. Read the active profile's kind before starting Stage A:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({ db }) => { const { profiles, appSettings } = await import('./src/db/schema.js'); const { eq } = await import('drizzle-orm'); const a = db.select().from(appSettings).where(eq(appSettings.key, 'active_profile_id')).get(); const p = a ? db.select().from(profiles).where(eq(profiles.id, a.value)).get() : null; console.log(p?.kind ?? 'personal'); })"
```

`personal` (or a missing profile, on a fresh clone) runs the personal interview below; `brand`
runs "Stage A when `kind` is `brand`". Stage B is identical either way.

## Stage A: the guided voice interview

Stage A draws out the prose part of identity in conversation and distills it into the voice card. It walks six themes as a backbone, adapting follow-ups to the answers rather than reading a fixed script. Ask **one question at a time.** Keep the person's own words. Capture verbatim any sample they offer, a real post, a sentence they are proud of, a phrasing they hate. Capturing at least one genuine writing sample is a goal of the interview, because a real sample grounds the voice in how the person actually writes, not how they describe their writing. If none has been offered by the end, ask for one directly.

**Save as you go — never hold answers only in conversation.** Append each question-and-answer pair to the active profile's `interview.md` **immediately after every answer**, under its theme heading, before asking the next question. An interview session can be abandoned or interrupted at any moment (the console's embedded terminal closes with the page), and anything not yet on disk is lost with it. While the interview is underway the file opens with a short **in-progress note**: a status line stating the interview is mid-run, which themes are covered so far, and the next question to ask. Update that note on each append; **remove it when Stage A completes** (all themes covered and the voice card distilled). This note is also what Step 0's partial-interview routing reads to resume.

### Stage A when `kind` is `personal`: the six themes

1. **Motivation and what winning looks like.** The real reason for building a brand, not the metrics answer, who they want to reach, and the honest energy-versus-friction picture: what they enjoy versus what drains them. This tells the system where to lean and where to scaffold.
2. **Real domain opinions.** Their point of view and what they watch others get wrong, captured as reusable content seeds.
3. **Stories and the arc.** Which stories they will tell and how they frame them without bragging, including any story that carries a handling guardrail, a relationship they will not criticize or a topic that needs care.
4. **Voice mechanics.** Words and habits they love and avoid, content they admire and content that makes them cringe, and their target register (plain, casual, formal, professional).
5. **Audience.** Who they want to reach and what those people should think, feel, or do, and whether their content carries an ask and on what kind of post.
6. **The skeptic / catch lens.** What they consider dishonest or overhyped in their space and want to call out.

Proceed one question at a time, follow the energy, and move on from a theme when it is genuinely covered rather than when a script ends.

**Optional light register touch.** The register axis adds **no** mandatory seventh theme. But once the owner's leaned tones are known (the `platforms` step in Stage B, or an existing profile), the interview MAY ask one light follow-up inside **theme 4 (voice mechanics)** or **theme 5 (audience)** — "when you write in that register, what does it actually sound like?" — and distill the answer into a short **register per platform** note in the voice card. That note is prose only: how the owner's chosen tones read in their voice, the guidance a drafter needs that a tone *key* cannot carry. The structured selection stays in `identity.yaml`; the voice stays in the card. If the interview yields nothing concrete, the distillation discipline applies — leave the note thin and flag the gap rather than inventing a register the owner never described.

### Stage A when `kind` is `brand`: the company interview

For a `brand` profile, Stage A is a company interview, not a personal one. It keeps the same
discipline — one question at a time, capture verbatim samples (a real published sentence, a
positioning line the company is proud of), follow the energy — but walks six company-shaped
themes:

1. **Positioning.** What the company does, who it's for, and the category it competes in; the
   one-line "what we are" that doubles as the tone test.
2. **Audience / ICP.** The buyer and the reader, what they should think, feel, or do, and the
   level they're addressed at (practitioner vs executive).
3. **Banned claims and compliance.** The pass-or-fail guardrails: superlatives it won't make,
   competitor claims it won't state, numbers it can't cite without a source, regulated language
   it must avoid. These become the brand card's hard rules.
4. **Product naming.** How the product and company are named and capitalized, what they are
   never called, and when a piece may name the product versus stay category-level (the brand
   analog of the personal CTA posture).
5. **Voice and register.** The company's tone (authoritative, plain, technical), words and tics
   it embraces and bans, and content it admires versus content that reads as marketing fluff.
6. **Proof and credibility.** The evidence the company leads with (customers, benchmarks, its
   own engineering), framed the way it's allowed to be framed.

Distill into `voice-card.md` following the *same file contract* the review gate expects — hard
rules, named voice patterns, an AI-tells blocklist, real samples, a CTA/product-naming rule —
but with brand-shaped sections:

- **Positioning and category** (in place of "who the person is"): what the company is and the
  category it competes in, the ethos line that doubles as the tone test.
- **Audience / ICP**: who it addresses and at what level.
- **Banned claims and compliance** (the hard-rules core): the pass-or-fail guardrails above.
- **Product-naming rules** (the CTA analog): naming, capitalization, and when a piece may name
  the product.
- **Company voice patterns and tone**: the moves that make the writing sound like the company,
  each named and demonstrated from the interview.
- **Approved proof points and framing**: the evidence it leads with and how it's allowed to be
  framed.
- **AI-tells / marketing-fluff blocklist**: words and tics to scrub, universal tells plus
  company-specific ones.
- **Real voice samples**: at least one verbatim anchor sample plus signature phrasings.

The distillation discipline is unchanged and matters more here: name only what the interview
surfaced; never invent a claim, a proof point, or a positioning the company did not state — an
invented claim is a compliance risk, not just an off-voice line. Machine-checkable lists (for
example banned superlatives) still belong in `identity.yaml`, not the card; the card holds the
human framing.

### Stage A outputs: two files

Write **both**:

- `interview.md` (in the active profile's directory): the raw answers as a faithful, themed transcript in the person's own words, verbatim samples preserved exactly, organized under the six theme headings. **Built incrementally during the interview** (see "Save as you go" above), so at any moment the file holds every answer given so far; when the interview completes, drop the in-progress note so the file reads as a finished transcript. This is the durable, re-distillable source of truth. It is not a throwaway.
- `voice-card.md` (same directory): the distilled voice card, written *from* the interview **only after the interview completes** — distillation needs the whole conversation, so this file appearing is what marks Stage A done. This is the rich prose artifact the drafting and review skills load. For a `personal` profile aim for the shape below; for a `brand` profile use the brand-card sections named under "Stage A when `kind` is `brand`". Both satisfy the same completeness contract (a hard-rules section and an anchor sample):
  - **Who the person is**: background deployed in service of a point and never as a credential drop, the core differentiator, and an ethos line that doubles as positioning and as the tone test.
  - **Pillars, voice-only framing**: a short reference noting the card governs voice, not topic selection (topic weighting lives in `identity.yaml`).
  - **Hard rules**: the pass-or-fail rules a draft must satisfy, drawn from what the person stated (for example a no-em-dashes rule, a register rule, a show-don't-tell rule, a CTA rule).
  - **Named voice patterns**: the moves that make the writing sound like them, each named and demonstrated from the interview.
  - **The values spine and any protected-relationship guardrail in prose**: the worldview the writing stands on, and the narrative framing of any relationship the person will not criticize. The machine-checkable list of those relationships lives in `identity.yaml`; the card holds the human framing.
  - **Hook formulas and banned hooks**: the opening shapes that work and the ones that fail.
  - **AI-tells blocklist**: words and tics to scrub or flag, universal tells plus any person-specific ones surfaced.
  - **Real voice samples**: at least one verbatim anchor sample plus signature phrasings, used as the comparison target when a draft is uncertain.
  - **CTA rule (expanded)** and a **never-fabricate-a-real-detail** rule.

### Distillation discipline

Distillation is a summarization-and-structuring pass over the person's own words. **Name the patterns the person demonstrated; never invent opinions, stories, hard rules, or a persona the interview did not contain.** The same take-origination discipline that governs drafting, never manufacture an opinion, governs distillation. Every named voice pattern and hard rule must trace to something the person actually said or wrote. If a card section has no support in the interview, leave it thin and note the gap rather than filling it with a plausible-sounding invention. When in doubt, quote the interview.

## Stage B: the knob-walk to `identity.yaml`

Stage B captures the mechanical fields into the active profile's `identity.yaml`. It offers two modes; the user picks per run:

- **Guided walk** (default on a first run): ask for each field group in turn, in plain language, offering sensible defaults and the `profile.example/identity.yaml` values as a starting menu, so the user can accept rather than compose.
- **Direct edit** (default offer when updating one field on a complete profile): point the user at the active profile's `identity.yaml` (the resolved directory from Step 0), explain the single field they want to change, let them save, then validate.

Read `profile.example/identity.yaml` first and offer its structure as the menu. Walk these fields (schema owned by design `01-profile-model`):

- **`display_name`**: string, required, no default. The person's name as it should appear and be reasoned about ("writing AS this person"). Must be filled.
- **`products`**: list of strings, default `[]`. The product or company name(s) the person may promote. Drives the CTA policy: only a post touching one of these is product-adjacent and eligible for an ask. Empty means every post is personal-brand and carries no ask.
- **`protected_relationships`**: list of strings, default `[]`. Entities the person will not blame or criticize (a former employer, a partner, a mentor, a respected competitor). Feeds the review guardrail. Empty means no relationship-specific guardrail; the universal rules still apply.
- **`pillars`**: list, at least one entry, required. Confirm the set and the weights. Each entry has `key` (a short stable identifier, for example `brewing`), `label` (the human-readable name), and `weight` (a relative share; weights need not sum to any total, the engine normalizes them, and `0` keeps a pillar defined but idle). The `key` values must be unique.
- **`feed_groups`**: **do not walk this — RSS feeds are no longer configured here.** Feeds now live in the database (the `sources` table) and are managed entirely from the console: the **Feeds page** (add form + per-feed/run-all buttons) or the focused **`feeds`** skill, which validates a URL is a real feed and writes it to the DB. A legacy `feed_groups` block in an existing `identity.yaml` is ignored by discovery; a one-time `npx tsx src/ingest/migrate-feeds.ts` imports it into the DB. If the user asks to add a feed during setup, point them to the Feeds page / `feeds` skill rather than writing `feed_groups`. See design 2026-07-04-db-driven-feeds.
- **`cta_policy`**: object, with defaults that reproduce no-ask-by-default. `personal_posts_carry_ask` (boolean, default `false`), `product_posts_max_ask_lines` (integer, default `1`), `ask_style` (string, default `soft-honest`). Confirm or accept the defaults.
- **`enabled_lenses`**: list of strings, default `[]`. Optional add-on discovery lenses beyond the always-on RSS baseline. RSS always runs off the `sources` table (managed on the Feeds page) and is never listed here. Confirm which opt-in lenses to enable.
- **`lenses`**: map of lens name to `{ name, url, pillar }`, default `{}`. Config for an enabled add-on lens that needs its own feed (for example `opensourcedrop`): `name` (the source's display name), `url` (its feed URL), and `pillar` (which declared pillar its items feed). Only lenses actually enabled in `enabled_lenses` need an entry here; walk this only for lenses the user just enabled.
- **`platforms`**: list, default `[]`. The register axis — which platforms the owner posts to and how they sound there. Walk it in the same accept-the-menu style as the field groups above, offering the **shipped roster** from `src/core/registers.ts` (the `Platform` menu and each platform's shipped tones/themes) as the starting choices, not any per-user file. LinkedIn ships today; the roster is extensible in code, so future platforms appear in the menu with zero changes here. (To configure this axis *in isolation* — one platform, without the rest of the knob-walk — the focused **`register`** skill walks exactly these same choices and writes the same `platforms:` block via `src/profile/write-register.ts`; it is what the console's Register page runs in AI mode.) Walk these choices, one at a time, defaults offered:
  - **Active platforms**: which platform(s) the owner actually posts to. LinkedIn is the shipped default and likely the single answer today.
  - **Default platform**: the one platform `spark`/`queue` assume when a spark names none. Exactly one active platform carries `default: true`. With a single active platform this is automatic; with several, the user picks.
  - **Tones leaned on**: which of the platform's shipped tones the owner favors, informed by the Stage A voice card. **Do not leave this empty on a first run or a backfill** — lean on the tones that fit the owner's voice so the register lands configured (the console's Register screen shows leaned tones as checked; an empty selection reads as unconfigured). When the owner just wants to accept the menu, lean on **all** shipped tones (they can narrow later); only an explicit "not that one" leaves a tone unleaned. A lean is soft guidance, never a hard rule. Optionally attach a short `note` per tone (how it sounds in the owner's voice), drawn from Stage A.
  - **Custom themes / tones** (optional): a theme or tone specific to this owner and not in the shipped menu, captured as ordinary entries in the same `tones`/`themes` lists — a `key` the roster doesn't define plus a `note`. Because they are per-user, they live only here in `identity.yaml`, never in `src/core/registers.ts`.

  Each entry: `key` (must match a `Platform` in `src/core/registers.ts`), `active` (bool, default `true`), `default` (bool — exactly one active platform is the default; with a single platform, mark it the default rather than leaving it unset), and `tones`/`themes` lists of `{ key, note }`. Omitting `tones`/`themes` is technically valid (the engine falls back to the shipped menu), but a first run or backfill should **lean on tones rather than omit them**, so the register reads as configured instead of empty. Zero platforms is still a valid, complete profile; the engine defaults to `linkedin`.

Write the result to the active profile's `identity.yaml` conforming to the schema.

### Validate before reporting done

Either mode ends by validating the active profile's `identity.yaml` and the whole profile against the completeness contract in "What a complete profile is" above, the predicate `src/profile/completeness.ts` enforces. Confirm the YAML parses, `display_name` is set, every pillar has a unique `key`, a `label`, and a numeric `weight`, and every feed group is internally consistent. Report exactly what was written and where, and name any field left at its default.

Extend the same pass to the `platforms` list (platforms do **not** block completeness — an empty list is still complete, exactly like `feed_groups`, because the engine defaults to `linkedin`):

- Every `platforms[].key` matches a `Platform` key exported by `src/core/registers.ts`. An unknown key is a validation failure to surface, not silently drop.
- Among active platforms there is **exactly one** default — or none, in which case the engine falls back to `linkedin`. Two defaults is a failure to surface.
- Custom tones/themes are accepted as-is; they are per-user nuance and match nothing in the committed menu by design.

Report the platform selection alongside the other written fields: name the active platforms, the default, any leaned or custom tones/themes, and state plainly if `platforms` was left empty and the engine will default to `linkedin`.

## Stage C (optional): local image generation

The imagery skill can generate images locally — photoreal or illustrated, no API key,
nothing leaves the machine. Models are named entries in `image-generation.config.json`
(FLUX.2 [klein] by default; bring-your-own via any mflux-supported model or Draw Things).
It is **optional and app-wide** (a machine capability,
not a profile file): it never blocks completeness, and skipping it costs nothing — the imagery
skill still offers diagrams, data figures, screenshots, and Unsplash.

**When to offer it:** at the end of a full first pass (after Stage B), and whenever the
Complete-menu backfill scan runs. Offer it **only** when both are true — the generator is not
set up, and the owner has not deferred it. Check both first:

```bash
npx tsx -e "import('./src/images/generate.js').then(async m => { const c = m.loadGeneratorConfig(); console.log(JSON.stringify({ defaultModel: c.default, configured: await m.generatorConfigured(c) })) })"
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {appSettings}=await import('./src/db/schema.js');const {eq}=await import('drizzle-orm');const r=db.select().from(appSettings).where(eq(appSettings.key,'image_gen_setup')).get();console.log(r?.value ?? 'unset')})"
```

`configured: true` → nothing to offer (mention it's ready only if the owner asks). `deferred`
→ stay silent about it entirely; the owner opted out and re-opts in by asking (or from the
Connections page). Otherwise, one plain question, three options:

1. **Set it up now.** Walk it in two steps, tools then weights:
   - **Tools:** `make image-gen` (installs `mflux` + the `hf` CLI via uv; if mflux is
     already installed but older than 0.18, `uv tool upgrade mflux` — the default FLUX.2
     [klein] model needs `mflux-generate-flux2`). Optionally
     `cp image-generation.config.example.json image-generation.config.json` to pick models
     (without a config the FLUX.2 [klein] default applies). A gated Hugging Face model also
     wants its license accepted and `hf auth login` with a read token — the Apache-2.0 FLUX
     defaults normally need none. Full walkthrough: Docs → Setup → *Local image generation*.
   - **Weights (offer it, don't just warn):** the download belongs to setup, not to the
     owner's first image. Ask which models to fetch — the default is the usual answer, but
     name the config's entries so several or all is one answer away — then run
     `make image-model MODEL="<names>"` (or `MODEL=all`; run bare it prompts
     interactively, and non-interactively it fetches the default). It installs mflux + the
     `hf` CLI itself if they're missing, streams download progress (one time; ~13 GB for
     FLUX.2 [klein], ~24 GB for FLUX.1 [schnell]), and ends each model with a tiny test
     render that doubles as the install check. It can take a while on a slow link, so say
     so and run it in the background if the owner wants to keep going. If they decline,
     name the consequence in one line: the first generated image will do the same download
     itself as a failsafe, making that first run much longer.
   Verify with the status one-liner above and report the result plainly, including whether
   the weights are already fetched or still pending first use.
2. **Not now.** Do nothing — the offer resurfaces on a later run.
3. **Don't ask again.** Persist the opt-out, then never raise it unprompted again:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {appSettings}=await import('./src/db/schema.js');db.insert(appSettings).values({key:'image_gen_setup',value:'deferred'}).onConflictDoUpdate({target:appSettings.key,set:{value:'deferred'}}).run();console.log('image_gen_setup=deferred')})"
```

Whatever the answer, name the consequence in one line (what the imagery skill will and won't
offer) so declining never hides the capability. The imagery procedure reads the same
`image_gen_setup` setting and applies the same silence on `deferred`.

## Re-running setup to update

`setup` is idempotent and re-runnable. Because the two halves are independent and each reads the existing profile files before writing, re-running is how a profile evolves. Re-running never wipes the profile.

- **Re-run Stage A** to re-distill the voice card. Read the existing `interview.md`, optionally add a few new questions, **append** the new answers to it and never discard prior answers, then **rewrite** `voice-card.md` from the full interview. The card is a derived artifact; the durable source is the interview. Re-distillation follows the same distillation discipline: it names patterns the person demonstrated and never invents opinions the interview does not contain. If the user hand-edited the card and wants those edits kept, fold them into an interview answer before re-distilling, or a re-distill will not know about them.
- **Re-run Stage B** to change pillars, weights, feeds, product names, protected relationships, CTA policy, enabled lenses, or a lens's config, via the guided walk or a direct edit. Stage B updates fields **in place**.

Nothing about the committed tool changes on a re-run; only the gitignored profile folder moves.

## Generic and PII-free

This skill contains no owner data and must never be edited to add any. It writes only into the gitignored `profiles/` tree, reads `profile.example/` as a neutral reference menu, and reasons only from what the current user says in their own interview and knob-walk. On a fresh profile, a first full run leaves its `voice-card.md`, `interview.md`, and `identity.yaml` populated with the user's own identity, satisfying the completeness contract, with zero of anyone else's data.
