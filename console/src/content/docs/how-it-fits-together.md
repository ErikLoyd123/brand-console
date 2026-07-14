---
title: How it fits together — config, console, and onboarding
category: Reference
order: 1
---

This page is the map. It explains **where every kind of thing lives**, and therefore
**how you change it** — some things you edit as files or in the terminal, some you edit
right here in the console, and a few are both. If you ever wonder "do I change this in a
file or on a screen?", this is the answer.

## The one rule underneath everything

There are three storage places, and each kind of thing has a home based on a single
question: **is this the same for everyone, is it your personal setup, or is it a live
record of work?**

| Storage | Holds | Who/what changes it | Example |
|---|---|---|---|
| **Committed code** | *Structure* — the same for every user of this engine | A code change (a developer / a PR) | The list of post intents (silos), the platform + tone menu, the review rules |
| **Your profile** (`profiles/<slug>/`, not shared) | *Your setup* — who you are, how you sound, what you post about | The `setup` skill, or hand-editing the files | Your voice card, your pillars, your platforms/tones (feeds live in the database, not here) |
| **The database** | *Live work* — the actual items flowing through the pipeline | The console, or the skills as they run | Sparks, queued ideas, drafts, scheduled and published posts, tags |

The guiding rule: **structure is code, your nuance is config or database, and none of
your personal data ever lives in committed code.** That is why, for example, the *menu*
of tones ships in code but *which tones you use* lives in your profile — and why a theme
that is specific to you never gets hard-coded.

## Config-based — you edit files (or run `setup`), not a screen

These are your identity and settings. They live in your profile folder, `profiles/<slug>/`
(which stays on your machine and is never shared), or in committed code. You change them
through the `setup` skill — run from the Voice page or the terminal — or by editing the
files; some now have console editors too.

- **Your voice** — `profiles/<slug>/voice-card.md` (how you write) and
  `profiles/<slug>/interview.md` (the raw answers it was distilled from). The **Voice**
  screen shows the card and edits it two ways — by hand in its editor, or with the AI
  `voice` skill — and re-running the `setup` voice interview rebuilds it from scratch.
- **Your knobs** — `profiles/<slug>/identity.yaml`: your display name, products, protected
  relationships, **pillars** (topics + weights), **feeds**, CTA policy, discovery lenses,
  and **platforms + tones** (the register axis). Written by the `setup` knob-walk, or edited
  by hand. It can still list your **Reddit destinations** (the subreddits and `u/` profile you
  post to), but that's now just a personal note — Reddit is a manual copy-paste channel, so
  nothing in the console reads the list.
- **The fixed menus (code)** — the roster of **silos** (post intents), now **keyed by
  platform** — LinkedIn: conversation / teach / win / curate; Reddit: discuss / help /
  share / ask / curate — and the **platform + tone menu**, which now spans **both
  LinkedIn and Reddit** (each platform ships its own tones and neutral starter themes).
  These are product structure; they change only in code, and the same menus ship to
  everyone.
- **The skills and agents** — the `.claude/skills/` and `.claude/agents/` definitions.
  There is **one skill per console page** — `spark`, `discovery`, `queue`, `drafts`, `articles`,
  `feeds`, `pillars`, `register`, `voice` — plus `setup`, the content
  reviewer, and the shared references skills pull from (`voice-card`, `content-doctrine`,
  `onboarding-gate`, the `develop`/`draft`/`revise` procedure files the `queue` and `drafts`
  skills share, and the `outline`/`section-draft`/`section-revise` procedure files the `articles`
  skill dispatches to). The console turns the page skills into buttons and can run them, but it
  does not edit them.

## Console-based — you create and edit it here, it lives in the database

These are the moving parts of the pipeline. You make and change them on screen, and they
are stored in the local database.

- **Tags** — the **Tags** screen fully manages them: create, rename, recolor, and delete by
  hand, or **add with AI** (the `tags` skill dedups a new tag against near-duplicates and can
  suggest tags drawn from your untagged items — add-only; rename/recolor/delete stay here).
- **Drafts** — the **Drafts** editor: edit the hook/body/close by hand or **Revise with AI**
  (the `drafts` skill sharpens them in your voice and writes them back), see the live
  voice-check findings, then **publish to LinkedIn** (a real API post behind a type-`PUBLISH` gate)
  or **Copy to publish** — which copies the finished text out for you to paste anywhere. Reddit
  is copy-paste only: draft it here, copy it, and post it on Reddit by hand. **Delete** (in the
  action bar, with a confirm) removes a draft and returns its idea to the queue as seeded; a
  draft that was published can't be deleted — it's the Published archive's record.
- **Articles (long-form)** — the **Articles** editor is the long-form workbench: an ordered
  **outline** of sections (each a heading, a one-line intent, and a body), the **SEO fields**
  (target keyword, search intent, meta description, slug, length target), a **stage** you can
  advance by hand, and the same live **voice check** the Drafts editor runs. **Develop the
  outline / Draft a section / Refine with AI** run the `articles` skill in your voice; the
  per-section editing is the plain floor beneath it. **Export as Markdown** writes a local file
  to `data/exports/` (with SEO frontmatter) and shows you its path — it does not publish. A piece
  starts from a **spark** or from **Discovery** by choosing the `web` platform and a piece kind.
  **Delete article** (bottom of the editor, with a confirm) removes the piece *and* the queue
  idea it grew from; the raw spark capture stays in the database log.
- **The discovery inbox** — the **Discovery** screen: triage incoming feed items. Archive
  the noise, **save** a keeper for later (a low-friction, pre-queue shortlist — no take
  required), or move one into the queue two ways: **promote** it with a one-line take you type
  (the fast path, where you pick its **silo**), or **Work up with AI** — the `discovery` skill
  reads the piece and its source, draws out your take and the 2–4 points, and promotes it with
  those beats already attached (the discovery-lane mirror of `spark`). The flow is a substance
  ladder: *inbox → saved → queue → draft*.
- **The idea queue** — the **Queue** screen: your ideas (promoted or captured), carrying more
  than a bare angle. Add your **seed** (your take) and **develop the points** — the 2–4 beats
  you'd make — by hand or with the `queue` skill's **Develop with AI**. Then **Draft with AI**
  on the card has the same `queue` skill write the post (using your take + points as the spine)
  and lands the result on the Drafts screen. The `queue` skill can also revise a draft — the same
  revise the Drafts page offers, since both share one revise procedure. A **spark** skips the
  inbox and lands here directly: it's already yours. The trash button on a card **deletes the
  idea and everything downstream** (its drafts and, for a web piece, its article — with a
  confirm); it's refused if one of its drafts was published, since the Published archive
  references that draft.
- **Scheduling & calendar** — the **Calendar** screen plans when a draft goes out.
- **Published** — the **Published** screen is the archive of what shipped, with a link
  back to each post.
- **Connections** — the **Connections** screen runs the **LinkedIn** sign-in and disconnect.
  Reddit shows here too, but only as a note that it's a manual copy-paste channel — there's
  nothing to connect.
- **Raw data** — the **Database** screen is a direct read-only window into the tables.

## Both — a menu in config, the choices in the console

A few things are split across two homes: the **structure** is config or code, but the
**per-item choice or the live data** is in the console/database. This is the pattern to
recognize.

- **Pillars** — stored in `identity.yaml`, but the **Pillars** screen now edits them
  directly (add, rename, reweight, remove — it writes the config file) *and* shows live
  stats. You can still edit them via `setup` in the terminal.
- **Silo (post intent)** — the *menu* is fixed in code (now **keyed by platform**:
  LinkedIn's conversation / teach / win / curate and Reddit's discuss / help / share /
  ask / curate), but you **choose** an item's silo in the console when you promote it from
  Discovery, and that choice is saved to the item. The **Intent** screen browses the
  intents (meaning, rules, live counts); it's read-only because the roster is fixed
  structure that drafting and review depend on.
- **Feeds** — your RSS feeds live in the **database** (the `sources` table), not config. The
  **Feeds** screen is where you add them (a form or the AI `feeds` skill) and **run** them —
  a per-feed *Run* button and a *Run all* button pull fresh items into the Discovery inbox. No
  code or `identity.yaml` editing. (A legacy `feed_groups` block in an older profile is ignored;
  `npx tsx src/ingest/migrate-feeds.ts` imports it into the DB once.)
- **Sparks** — drop a spark from the **Spark** screen: the plain "Save spark" button stores it
  raw (via `src/ingest/capture.ts`), or the AI path runs `spark` to shape it first. Either way it
  lands in the same queue. A **platform picker** on the form (LinkedIn / Reddit / Web, defaulting
  to your register default) tells the AI path up front where the spark is headed: a social
  platform shapes a post and, once the seed is saved, offers to draft it on the spot; **Web**
  runs the long-form pipeline end to end — seed, article row, outline, and section drafts on the
  Articles screen — without re-asking. Picking Web also reveals a **piece-kind dropdown**
  (how-to, explainer, comparison, thought piece, whitepaper — the web intents) if you already
  know the shape; leave it on "Let spark propose" and the interview suggests one. (A plain save
  ignores both; a raw spark is destination-free.)
- **Register (platform + tone)** — the *menu* of tones/themes is in code (read-only) and
  now spans **both LinkedIn and Reddit**, but the **Register** screen edits your *selection*
  (which platforms are active/default, which tones you lean on, and custom tones/themes) and
  writes it to `identity.yaml`. `spark` also pins a platform/tone onto an item that drafting
  then honors.

## Onboarding — how your profile gets filled in

Onboarding is the one-time (and re-runnable) process that populates your profile folder
(`profiles/<slug>/`) so the engine drafts and reviews in **your** voice, with none of
anyone else's data. It is **conversation-driven, not a form** — a guided interview you can
run right from the Voice page (or any terminal):

1. **The `setup` skill** does the real work, in two independent stages:
   - **Stage A — the voice interview.** A guided conversation that becomes your
     `voice-card.md` (raw answers saved to `interview.md`).
   - **Stage B — the knob-walk.** Plain-language questions that fill `identity.yaml`:
     pillars, feeds, products, CTA policy, and your **platforms + tones**.
   You can run either stage alone to update, any time. It never wipes what's there.
2. **The onboarding gate.** Every content skill checks your profile before it runs. If
   something it needs is missing, it says so plainly and **offers to run `setup`** for the
   missing piece, then continues — a detour, not a dead end. What counts as "complete" is
   a fixed contract (at minimum: a voice card with anchors, and at least one pillar).
3. **The console's part.** The **Getting started** and **Setup** docs walk you through it,
   the Voice page (or the embedded terminal) is where you run `setup`, and the **Connections** screen handles the
   optional **LinkedIn** sign-in used for direct publishing. Reddit needs no sign-in — it's a
   manual copy-paste channel. If you open a screen that needs a profile you don't have yet, the
   gate points you back to `setup`. A **profile switcher** at the top of the sidebar shows which
   brand you're working as (name + a personal/brand pill), switches the whole console to that
   profile's data, and can create a new empty profile (**New profile**: name + kind); profiles
   live in `profiles/<slug>/` and are populated with the `setup` skill. While the active profile
   is incomplete, the console lands on the **Voice** page, which doubles as the setup surface —
   a checklist of what's missing plus a button that runs the setup interview — so a fresh clone
   or a just-created brand is walked straight into setup, and every other screen shows a
   **setup banner** under the top bar ("… isn't set up yet — Set up voice →") until the
   profile is complete. See **Profiles & brands** for the full story.

The short version: **your identity is authored through `setup` (conversation → files);
the console is where you then run the pipeline day to day.**

## Quick reference

| Thing | Config | Console | Database | Notes |
|---|---|---|---|---|
| Voice card | ✅ (file) | ✅ edit (AI `voice` skill / by hand) | — | First authored by `setup`; edited on the Voice screen after |
| Pillars | ✅ (`identity.yaml`) | ✅ edit + stats (form / AI `pillars` skill) | — | Editable on Pillars screen, by hand or AI (weights informed by queue depth + coverage) |
| Feeds | — | ✅ add + run (form / `feeds` skill) | ✅ | DB is source of truth; managed entirely in the console |
| Silo menu / choice | ✅ menu (code), **per-platform** | ✅ pick per item + Intent view | ✅ stored | Both; roster keyed by platform — LinkedIn / Reddit intents, plus **`web` piece kinds** (how-to, explainer, comparison, thought piece, whitepaper) for long-form |
| Register (platform/tone) | ✅ menu (code) + selection (`identity.yaml`) | ✅ edit selection | ✅ per-item pin | Menu read-only, spans LinkedIn **and Reddit**; selection editable |
| Tags | — | ✅ full CRUD (form / AI `tags` skill) | ✅ | Console-owned; the `tags` skill adds with anti-bloat judgment, rename/recolor/delete stay in the console |
| Sparks | ✅ (`spark` / plain button) | ✅ Spark screen | ✅ | Raw save or AI-shaped via `spark` |
| Discovery inbox / saved | — | ✅ triage · archive / save-for-later / promote (type a take) or **Work up with AI** | ✅ (`feed_items`) | Promote needs a one-line take; the `discovery` skill draws out your take + points and promotes (mirror of `spark`) |
| Queue / seeds / points | — | ✅ seed + develop points (form / AI `queue` skill) | ✅ | Console-owned; points are the developed take draft uses as the spine |
| Drafts | — | ✅ edit + publish | ✅ | Console-owned |
| Articles (long-form) | — | ✅ edit + AI (`articles` skill) | ✅ | Console-owned; outline + sections editor, per-section AI in your voice |
| Article SEO fields | — | ✅ edit | ✅ | Target keyword / search intent captured at intake; meta / slug filled later; all feed the export frontmatter |
| Article export | — | ✅ Export as Markdown (action) | — | Writes `data/exports/<profile>/<slug>.md` (gitignored) and shows the path; never publishes |
| Profiles / active profile | ✅ (`profiles/<slug>/`, via `setup`) | ✅ switcher | ✅ setting | Disk holds each profile; the sidebar switcher sets the active one and re-scopes the console |
| Scheduled / published | — | ✅ | ✅ | Console-owned |
| LinkedIn connection | — | ✅ Connections | ✅ token | OAuth in the console |
| Reddit posting | — | ✅ Copy to publish (Drafts) | — | Manual copy-paste channel; no API, no connection, no token |
| Reddit destinations | ✅ (`identity.yaml`, optional) | — | — | A personal note of where you post; nothing in the console reads it |
| Skills / agents / review rules | ✅ (code) | ▶ run only | — | Structure, not edited in UI |

Legend: ✅ edit here · 👁 view-only · ⏳ planned · ▶ run, not edit · — not applicable.
