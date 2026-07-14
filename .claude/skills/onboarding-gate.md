# Onboarding gate (shared reference)

This is the canonical detect-and-offer onboarding gate. It is not an invokable skill (no `name` frontmatter); it is the single written source for the gate block that `voice-card` and `queue` each embed at the very top of their procedure, customized only by the two per-skill fills below. The gate implements design 02 (setup and onboarding) and fires at the profile choke point described in design 03 (generic skills and guardrails).

## The block

Run this before any other step in the skill.

1. Check the active profile. Profiles live in gitignored `profiles/<slug>/` directories; a fresh clone ships only `profile.example/`. `checkCompleteness()` resolves the **active** profile from the `active_profile_id` setting, so a fresh, not-yet-populated profile reports incomplete and the gate offers `setup` for that profile. Run:

   ```bash
   npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
   ```

   `checkCompleteness()` (owned by `src/profile/completeness.ts`) returns `{ complete: boolean, missing: string[] }`: `complete` is `true` only when all three files exist and are non-empty, `identity.yaml` parses with its required fields, and `voice-card.md` carries its anchors; `missing` lists plain-language reasons (each naming the specific file or field) when it is not. It never reads `profile.example/`.

2. Judge against what THIS skill needs (the `REQUIRED` fill). If everything this skill needs is present and complete, pass the gate and continue. Otherwise stop before doing the skill's normal work and go to step 3.

3. Report and offer, in plain language:
   - State what is missing for THIS skill by name ("I don't see a voice card yet", "your identity.yaml has no pillars defined").
   - Offer to run the `setup` skill now, scoped to the missing piece (the guided interview, the knob-walk, or both). One clear question with a recommended path, not a wall.
   - Name the alternative (the `DEGRADATION` fill): proceed with the named degradation, or stop.

4. If the user accepts: hand off to the `setup` skill for the missing half or halves, let it write the profile, then resume the original request against the now-complete profile. The gate is a detour, not a dead end.

5. If the user declines: apply this skill's `DEGRADATION`. Always name what was skipped and how to enable it later, so declining once never hides the capability.

`setup` is authored separately; the gate only names and offers it.

## The two per-skill fills

| Skill | `REQUIRED` | `DEGRADATION` on decline |
|-------|-----------|--------------------------|
| `voice-card` | the active profile's `voice-card.md` present and complete | Stop. Do not fabricate a voice. Report that nothing can load a voice that does not exist and that the setup interview is the unblock. Load nothing. |
| `queue` | the active profile's `voice-card.md` present and complete | Stop gracefully. Write nothing. Report that it cannot draft in nobody's voice and that the setup interview is the unblock. |
