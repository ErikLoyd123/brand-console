---
title: Profiles & brands
category: Setup
order: 1
---

A **profile** is who is speaking. Everything the engine produces — posts, long-form
articles, feeds, drafts, tags — belongs to exactly one profile, and the console always
shows one profile at a time. Your personal brand is one profile; a company like the one
whose blog you run is another. Switching profiles is like switching workspaces: nothing
bleeds between them.

## Personal vs. brand

A profile has a **kind**, chosen when you create it:

| Kind | The setup interview asks about | Typical use |
|---|---|---|
| `personal` | Your story, opinions, voice mechanics, audience | Your own LinkedIn / personal brand |
| `brand` | Positioning, audience/ICP, banned claims, product naming, proof points | A company blog, whitepapers, SEO content |

The kind changes *how setup interviews you* and what its voice card covers — the
pipeline underneath (queue → draft → review → publish or export) is identical for both.

## Creating a profile

Open the **profile switcher** at the top of the sidebar → **New profile** → name +
kind. The profile is created empty and becomes active immediately, so the console
re-scopes to it and lands you on the **Voice** page, which doubles as the setup surface
until the profile is populated. Until then, every other screen shows a setup banner under
the top bar with a **Set up voice →** button that brings you back here.

## Setting it up

The Voice page shows what's still missing and hosts the **setup interview** — a guided
conversation (one question at a time) that:

1. Distills your **voice card** (`profiles/<slug>/voice-card.md`) — the single source of
   truth every draft and review reads first.
2. Fills the **identity knobs** (`profiles/<slug>/identity.yaml`) — pillars, platforms
   (turn on `web` here for long-form articles), product naming, CTA policy.

Setup is re-runnable and never invents anything you didn't say. After it completes, the
Voice page becomes the normal voice-card editor, and every content skill unlocks.

Feeds and tags are added afterwards on their own pages — each profile watches its own
feeds and owns its own tag vocabulary.

## Where a profile lives

- **Identity**: plain files in `profiles/<slug>/` (gitignored — never committed).
- **Content**: rows in the local database, stamped with the profile's id.
- **Exports**: finished long-form pieces land in `data/exports/<profile-id>/<slug>.md`.

## Switching

The switcher shows every profile with its kind and a `setup` badge if it's incomplete.
Selecting one re-scopes the entire console — queue, drafts, articles, feeds, voice —
and new terminal skill runs pick up the new active profile automatically. Work already
in flight finishes against the profile it started with.
