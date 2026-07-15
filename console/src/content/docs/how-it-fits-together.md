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
- **Your brand look** — `profiles/<slug>/brand/`: a `brand.yaml` (colors, fonts, optional
  logo, style notes), a `refs/` folder of example images whose look you want matched, and
  optionally **brand documents** — any `.md` or `.html` file dropped in `brand/` (a company
  brand book, tone guide, or messaging doc; most useful for a brand profile that already
  has formal guidelines). The **imagery** skill reads all of it before producing anything,
  so composed graphics and screenshot annotations land in *your* palette and follow *your*
  rules, not stock ones — while the voice card stays the authority for the writing itself.
  Optional — without it a neutral default applies. Three ways to set it up: the **Brand**
  page in the console (color pickers, font fields, style notes, logo/reference/document
  uploads, and a live test card), the **brand** skill (which can derive a palette from
  your live website or a reference image), or by hand in the files;
  `profile.example/brand/` shows the documented shape.
- **The skills and agents** — the `.claude/skills/` and `.claude/agents/` definitions.
  There is **one skill per console page** — `spark`, `discovery`, `queue`,
  `feeds`, `pillars`, `register`, `voice` — plus `setup`, `imagery` (images for a queue
  idea), `brand` (the profile's visual look that imagery reads), the content
  reviewer, and the shared references skills pull from (`voice-card`, `content-doctrine`,
  `onboarding-gate`, and the procedure files the page skills dispatch to:
  `develop`/`draft`/`revise` for posts, `article-draft` for long-form web pieces, and
  `imagery` for images).
  The console turns the page skills into buttons and can run them, but it
  does not edit them.

## Console-based — you create and edit it here, it lives in the database

These are the moving parts of the pipeline. You make and change them on screen, and they
are stored in the local database.

- **Tags** — the **Tags** screen fully manages them: create, rename, recolor, and delete by
  hand, or **add with AI** (the `tags` skill dedups a new tag against near-duplicates and can
  suggest tags drawn from your untagged items — add-only; rename/recolor/delete stay here).
- **The discovery inbox** — the **Discovery** screen: triage incoming feed items. Archive
  the noise, **save** a keeper for later (a low-friction, pre-queue shortlist — no take
  required), or move one into the queue two ways: **promote** it with a one-line take you type
  (the fast path, where you pick its **silo**), or **Work up with AI** — the `discovery` skill
  reads the piece and its source, draws out your take and the 2–4 points, promotes it, and
  **writes the full piece** onto the new queue card (the discovery-lane mirror of `spark`).
  The flow is a substance ladder: *inbox → saved → queue (with the full piece) → published*.
- **The queue — the review phase** — the **Queue** screen is the workbench: every idea sits
  with its **full written piece** on the card. Slice by lane (LinkedIn / Reddit / Web) and by
  intent. Add or edit your **seed** (your take) and **points** (the 2–4 beats) by hand or with
  **Develop with AI**; **Write with AI** has the `queue` skill write the full piece (a post's
  hook/body/close, or a web article as one markdown document) from your take + points, and
  turns into a revise once content exists. The card's **content box** is the plain floor —
  a real post preview (LinkedIn chrome, or Reddit title + body with the 300-char title cue),
  an editor for the text (and, for web, the meta description and slug) with live voice checks
  while you type, a **review badge** showing the gate's verdict, and **Review with AI**, which
  runs the `content-reviewer` gate on the piece and writes the verdict back (any edit resets
  it to pending). When it's good to go,
  **Publish** on the card: LinkedIn posts via the API behind a type-`PUBLISH` gate (or Copy +
  record it manually), Reddit is Copy + record (a manual copy-paste channel), and a web piece
  **exports the Markdown file** (with SEO frontmatter, to `data/exports/`) — export *is* the
  web lane's publish. Publishing moves the idea to the Published screen. The trash button
  **deletes the idea and everything downstream** (with a confirm); it's refused once anything
  shipped, since the Published archive references it.
- **Images on a card** — each queue card has an **Images** strip: what's attached, where
  each image came from (AI graphic / screenshot / Unsplash with photographer credit /
  upload), an **Image with AI** button, and a hand-upload affordance (alt text required).
  Image with AI proposes concepts for the piece and produces one — a brand-styled composed
  graphic, an annotated screenshot of a live page (boxes, arrows, click marks, privacy
  blurs, scroll composites), or a stock photo (needs `UNSPLASH_ACCESS_KEY` in `.env`) —
  rows live in the database, files under `data/images/`. **Where images go:** a LinkedIn
  image sits below the post text — the publish modal offers the card's images as picks,
  and picking several makes a multi-photo post; a web article places images **inline in
  the markdown** as `![alt](image:<id>)` references (the AI inserts them where you agree,
  or add one by hand), which export rewrites to the bundled files beside the `.md` —
  unreferenced images still bundle and are listed in the frontmatter for the site to use
  (e.g. as a hero); Reddit is copy-paste — download from the strip and attach it there.
- **Scheduling & calendar** — the **Calendar** screen plans when a piece goes out.
- **Published** — the **Published** screen is the archive of everything shipped, across all
  three lanes, sliceable by platform: posts link back to the live post, web rows show the
  exported file's path.
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
  raw (via `src/ingest/capture.ts`), or the AI path runs `spark` to shape it — and then **write
  the full piece**, so the run ends with a finished post or article on its Queue card, ready
  for review. A **platform picker** on the form (LinkedIn / Reddit / Web, defaulting to your
  register default) tells the AI path up front where the spark is headed; picking Web also
  reveals a **piece-kind dropdown** (how-to, explainer, comparison, thought piece, whitepaper —
  the web intents) if you already know the shape; leave it on "Let spark propose" and the
  interview suggests one. (A plain save ignores both; a raw spark is destination-free.)
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
   gate points you back to `setup`. On a **fresh install with no profiles at all**, the console
   opens on a **welcome screen** instead of the app: name your first profile, pick its kind
   (personal or brand), and create it — no terminal step. A **profile switcher** at the top of
   the sidebar shows which brand you're working as (name + a personal/brand pill), switches the
   whole console to that profile's data, and creates later profiles (**New profile**: name +
   kind); profiles live in `profiles/<slug>/` and are populated with the `setup` skill. While
   the active profile is incomplete, the console lands on the **Voice** page, which doubles as
   the setup surface — a checklist of what's missing plus a button that runs the setup
   interview — so a fresh clone or a just-created brand is walked straight into setup, and
   every other screen shows a **setup banner** under the top bar ("… isn't set up yet — Set up
   voice →") until the profile is complete. See **Profiles & brands** for the full story.

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
| Queue (ideas + full content) | — | ✅ the review phase: seed, points, content editor, AI write/revise, Publish | ✅ | Console-owned; every idea carries its full written piece (post fields, or a web article's markdown body) on the card |
| Article SEO fields | — | ✅ edit (on the web idea's queue card) | ✅ | Target keyword / search intent captured at intake; meta / slug filled at write time; all feed the export frontmatter |
| Web publish (= export) | — | ✅ Publish on the queue card | ✅ | Writes `data/exports/<profile>/<slug>.md` (gitignored) and moves the piece to Published; the file is the shipped artifact — attached images are bundled beside it |
| Images on a card | — | ✅ Images strip (view / upload / delete) + LinkedIn publish pick | ✅ (`images`) | Produced by the `imagery` skill (composed graphic / annotated screenshot / Unsplash) or uploaded; files in `data/images/`; alt text required |
| Brand look (imagery) | ✅ (`profiles/<slug>/brand/`) | ✅ Brand page (form + uploads + live preview / AI `brand` skill) | — | `brand.yaml` colors/fonts/logo/style notes + `refs/` example images + optional `.md`/`.html` brand docs (brand book, tone guide); read by `imagery`; optional (neutral default) |
| Profiles / active profile | ✅ (`profiles/<slug>/`, via `setup`) | ✅ switcher | ✅ setting | Disk holds each profile; the sidebar switcher sets the active one and re-scopes the console |
| Scheduled / published | — | ✅ | ✅ | Console-owned |
| LinkedIn connection | — | ✅ Connections | ✅ token | OAuth in the console |
| Reddit posting | — | ✅ Copy + Publish on the queue card | — | Manual copy-paste channel; no API, no connection, no token — Publish just records it |
| Reddit destinations | ✅ (`identity.yaml`, optional) | — | — | A personal note of where you post; nothing in the console reads it |
| Skills / agents / review rules | ✅ (code) | ▶ run only | — | Structure, not edited in UI |

Legend: ✅ edit here · 👁 view-only · ⏳ planned · ▶ run, not edit · — not applicable.
