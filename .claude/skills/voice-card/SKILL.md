---
name: voice-card
description: Loads the active profile's voice card. The single source of truth every drafter and reviewer reads first. MUST be loaded before drafting or reviewing any post. Loaded by the queue, spark, and discovery skills, the drafting procedures, and content-reviewer.
type: skill
---

# Voice Card Loader

This skill has no voice of its own. It loads the active profile's voice card — `profiles/<slug>/voice-card.md`, where `<slug>` is the active profile resolved from the `active_profile_id` setting — and treats its full contents as the authoritative voice for the current run. Every drafter and reviewer in the system reads this first. If the voice card cannot be loaded, nothing downstream may draft or review: a generic tool must never draft in a voice that does not exist.

## Onboarding gate (run before loading)

Run this before loading anything. This is the shared detect-and-offer gate (`.claude/skills/onboarding-gate.md`).

1. Check the active profile. Profiles are gitignored under `profiles/<slug>/`; a fresh clone ships only `profile.example/`. `checkCompleteness()` resolves the **active** profile from the `active_profile_id` setting, so this checks whichever profile is currently selected. Run:

   ```bash
   npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
   ```

   `checkCompleteness()` (from `src/profile/completeness.ts`) returns `{ complete: boolean, missing: string[] }`; when `voice-card.md` is missing, empty, or lacking its hard-rules/anchor-sample anchors, `missing` names it. It never reads `profile.example/`.

2. This loader needs the active profile's `voice-card.md` present and complete. If it is, pass the gate and go to Load. Otherwise stop and go to step 3.

3. Report plainly that no voice card is set up ("I don't see a voice card yet"), and offer to run the `setup` skill's guided interview now. One clear question with a recommended path.

4. If the user accepts: hand off to `setup` for the interview, let it write the active profile's `voice-card.md`, then resume and Load.

5. If the user declines: stop. Do not fabricate a voice and do not fall through to drafting. Report that nothing can load a voice that does not exist and that the setup interview is the unblock. Load nothing.

`setup` is a separate skill; the gate only names and offers it.

## Load

Read the active profile's `voice-card.md` (`profiles/<slug>/voice-card.md`) in full. Treat everything in it as the authoritative voice for this run: its background-in-service-of-a-point rule, its hard rules, its named voice patterns, its hook formulas, its AI-tells restatement, its CTA posture, its protected-relationship handling prose, and its anchor voice samples. That file is the single source of truth; this skill adds nothing to it and overrides nothing in it.

## Contract

- This is the single source of truth every drafter and reviewer loads before it writes or judges a post. `queue` and `content-reviewer` both load it as rule one.
- The enforced copy of the universal AI-tells and em-dash rules lives in committed code (`src/review/voice-checks.ts`). The voice card's own AI-tells list is a human-readable restatement and guidance, not a second source of enforcement truth. When they overlap, the committed checks enforce; the card informs.
- The profile's protected-relationship handling prose lives in the active profile's `voice-card.md`; the machine-checkable protected-relationships list lives in that profile's `identity.yaml` and is enforced by `voice-checks.ts`.
- If the gate above did not pass, this skill loads nothing and no downstream step may draft or review.
