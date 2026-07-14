---
name: pillars
description: Manage your content pillars — add, rename, reweight, or remove them, and rebalance weights against your real queue coverage. Reads your live pillar stats (published count, queue depth, coverage gaps) so it can propose a balanced set of weights, not just edit blindly. Proposes, you confirm; never reweights on its own. Writes only the pillars in the active profile's identity.yaml.
type: skill
---

# pillars

Manage the **pillar axis** — the themes you write from — and save it to your profile. A pillar
is `{ key, label, weight }`: a stable key, a human label, and a relative weight (the engine
normalizes weights into target shares). This skill adds, renames (via label), reweights, and
removes pillars, and — its distinctive job — **rebalances weights against your real numbers**:
it reads your live pillar stats (published count, queue depth, coverage gaps) and proposes a
balanced set, so "manage weights" means informed, not guessed.

It is the guided, conversational counterpart to the console's pillar editor, and the pillar
analogue of `feeds`. It **proposes and you confirm** — it never rewrites your weights on
its own.

**Invoke with:** "add a pillar", "reweight my pillars", "rebalance my pillars", "my Wins lane
is dead", "rename this pillar", or from the Pillars page's AI mode.

## Onboarding gate (run before managing)

Pillars live in the active profile's `identity.yaml`; Profiles are gitignored under `profiles/<slug>/` (a fresh clone ships only
`profile.example/`). Confirm the profile exists and parses:

```bash
npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
```

At least one pillar is required for a complete profile. If `identity.yaml` is missing entirely,
say so plainly and offer to run `setup` first; stop gracefully if the user declines. Otherwise
continue.

## Read the current pillars and their real numbers first

Before proposing anything, load both the config and the live stats so any reweight is grounded
in what is actually happening, never generic:

```bash
# Current pillars (key, label, weight) — the list you will edit and write back whole.
npx tsx -e "import('./src/profile/loader.js').then(m => console.log(JSON.stringify(m.loadIdentity().pillars, null, 2)))"
# Live per-pillar coverage: published count and queue depth. A pillar with nothing
# published and nothing queued is a coverage gap.
npx tsx -e "import('./src/server/routes/overview.js').then(m => console.log(JSON.stringify(m.computePillarStats(), null, 2)))"
```

Read the **voice card** (the active profile's `voice-card.md`) too if a new pillar or a rename is in play —
it names the pillars in prose and sets what each lane is for, so a label or a new pillar stays
consistent with how the owner already frames them.

## 1. Read the pillars, then ask what to do

Run the two reads above (current pillars, live coverage) first, so you know the state
before saying anything. Open with a one-glance summary — each pillar with its weight and
whether it has a coverage gap — then one `ask_user` choice with the common pillar
actions, plus free text. If the user already named the action, skip the question but
keep the summary: the informed opening is the point.

- **Add a pillar** — a new theme (new key + label + a starting weight).
- **Rename a pillar** — change its label (never its key; see the rule below).
- **Reweight / rebalance** — change one weight, or propose a balanced set across all of them.
- **Remove a pillar** — drop a theme (warn about queued items filed under it; see below).
- **…or describe it** — free text; do exactly what they ask.

If the user already said what they want ("add a pillar for X", "Wins is dead, fix the weights"),
skip the question and go straight to it.

## 2. Rebalance — informed by the stats, always proposed

This is the value this skill adds over a plain form. When reweighting or rebalancing:

- **Name what the numbers say.** Point out coverage gaps (a pillar with 0 queued and 0
  published) and mismatches between a pillar's weight and its actual coverage — plainly, in
  one or two lines. Example shape: "Gear is weighted 10 but has nothing queued and one
  post; Brewing is weighted 40 and carries most of your published and queued work."
- **Propose a concrete set of weights**, with a one-line rationale for the change. Weights are
  relative shares — keep them simple, whole numbers that sum to something readable.
- **Confirm before writing.** Show the proposed before → after and ask. Never apply a reweight
  the user has not agreed to. If they want to hand-tune, take their numbers.

Do not chase volume mechanically — a low-activity pillar the owner cares about is theirs to
keep. Advise; the owner decides.

## 3. Add / rename / remove

- **Add:** pick a short kebab-case **key** (stable forever) and a human **label**, and a
  starting **weight** relative to the others. A brand-new pillar has no posts or queue yet, so
  it starts as a coverage gap — say so and suggest a discovery pass or a spark to warm it.
- **Rename:** change the **label** only. **Never change an existing pillar's key** — queued
  items and feeds are filed under the key, and changing it orphans them. If the user wants a
  truly different theme, that is a remove + add, and they lose the old lane's items.
- **Remove:** if the pillar has queued or published items (check the stats), warn that those
  items keep a key with no matching pillar (they will not show a pillar label) — confirm the
  user accepts that before removing.

## 4. Write it

Compose the **complete** new pillar list (every pillar you are keeping, with its final label and
weight, plus any additions, minus any removals) and write it in one authoritative call. Keep
every kept pillar's key byte-identical to what you read:

```bash
npx tsx src/profile/write-pillars.ts '[
  { "key": "brewing", "label": "Brewing", "weight": 40 },
  { "key": "gear", "label": "Gear", "weight": 20 }
]'
```

- The CLI validates the whole list (at least one pillar, unique keys, each with a label and a
  numeric weight >= 0) and writes it through the comment-preserving identity writer. A
  `ValidationError` is surfaced verbatim — fix and retry, do not guess around it.
- Write the whole list, not a fragment: this call replaces the pillar block entirely.

## 5. Report

Report plainly what changed — which pillars were added/renamed/removed and the before → after
weights — so the owner sees exactly what landed. This final report is what the console shows on
the result card; make it one clear, human sentence.

## Rules

- **Only the pillars in `identity.yaml`.** Read the stats and the voice card for context; never
  write them, the register, feeds, or code. The pillar *stats* are read-only truth about what is
  happening; you never fabricate them.
- **Keys are permanent.** Rename via label; a changed key orphans queued items and feeds. A new
  theme is add + remove, not a key change.
- **Propose, never impose, weights.** Ground every reweight in the real numbers, show the
  before → after, and let the owner confirm. Weights are relative shares the engine normalizes.
- **One coherent change set per run**, then report. Never publish or draft — this skill shapes
  the pillars, nothing downstream.
