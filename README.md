# Brand Content Engine

A personal-brand content system built as Claude Code skills and agents over a local
backend and React console. It discovers post-worthy material across your content
pillars, drafts in *your* voice with a human-in-the-loop seed for anything opinionated,
runs every draft through a voice-compliance and anti-slop review gate, and hands it to
you to edit and approve. **Nothing auto-publishes, ever.**

The engine is profile-driven. Each profile — a person or a brand — lives as a row in
the local database plus a gitignored `profiles/<slug>/` folder holding its voice card,
`identity.yaml`, and interview. You can keep several profiles and switch between them
from the console sidebar; the engine drafts in whichever voice is active, with none of
anyone else's data baked in. A fictional example persona ships in `profile.example/`
so you can see the shape before creating your own.

## How it works

A six-stage pipeline sharing one loadable voice card:

```
voice card → discovery (per pillar) → idea queue → drafting → review gate → publish → feedback
```

- **Discovery is agent-heavy.** RSS watchers and optional web-scan lenses feed one idea
  queue, alongside your own captured sparks. Each item is tagged `needs-your-take`
  (opinion content) or `ready-to-draft` (factual/curation) and scored 0–100 so the best
  material surfaces first.
- **Anti-slop guardrail.** Agents find material and propose angles, but any genuine
  opinion must carry *your* actual take (a one- to two-sentence seed). Every draft passes
  the voice card scrub and your edit-and-approve. No em dashes, no hype, no autopublish.
- **You publish manually.** LinkedIn can publish through a confirm-gated connection you
  approve per post; everything else is copy-paste.

## Getting started

Prerequisites:

- **Node 20+**
- **[Claude Code](https://claude.com/claude-code)**, installed and on your PATH — the
  console's guided setup, per-page AI assistants, and embedded terminal all launch the
  real `claude` binary. Without it the console still runs, but nothing AI-powered will.
- On macOS, the Xcode command-line tools (`xcode-select --install`) — needed to build
  the embedded terminal's native `node-pty` module during install.

```bash
# 1. Install dependencies (root + console)
make install

# 2. Create the local database (required — the API errors without it)
make db-migrate

# 3. Run the API (:5174) and console (:3001) together; Ctrl-C stops both
make dev
```

Then open **http://localhost:3001**. Everything else happens in the console:

1. **Create your first profile.** A fresh install opens straight onto a **welcome
   screen**: give the profile a name, pick its kind (a person or a brand), and hit
   **Create profile**. The console reloads into the new, empty profile. (Later profiles
   are created from the profile switcher at the top of the sidebar.)
2. **Run setup from the Voice page.** The console lands you there automatically while a
   profile is incomplete. It shows what's still missing and a **Start setup** button that
   runs the guided voice interview and identity walk right in the app — no commands to
   memorize. Re-run it any time; it's idempotent.
3. **Optional extras, each on its own page.** Connect LinkedIn under **Connections**
   (otherwise you copy-paste posts). Manage feeds, pillars, and tags on their pages.

No `.env` is needed to get started — it's only for LinkedIn OAuth keys or a
non-standard `claude` path (see `.env.example`).

For the full map of what lives where and how the pieces fit, open **Docs** in the
console — start with *How it fits together*.

### Optional: local image generation (Apple Silicon)

The imagery skill can generate **images locally** — photoreal or illustrated, any style,
no API key, nothing leaves your machine. Models are **named entries** in gitignored
`image-generation.config.json`: FLUX.2 [klein] by default (Apache-2.0, ~13 GB), with
FLUX.1 [schnell] (~24 GB), the Draw Things app, and **bring-your-own** — anything mflux
can run — as further entries. (One optional entry is *not* local: the `gemini` backend
sends prompts to Google, needs a billed `GEMINI_API_KEY`, and ships switched off.) The `setup` skill offers this once during onboarding
(install / skip / don't-ask-again) and walks these same steps in-app; by hand it's:

```bash
# One command: asks which models you want (Enter = the default, or pick several,
# or "all"), installs mflux + the Hugging Face CLI first if they're missing
# (needs uv — https://docs.astral.sh/uv/), then downloads the chosen weights
# (one time; ~13 GB FLUX.2 [klein], ~24 GB FLUX.1 [schnell]) with live progress,
# ending each with a tiny test render that proves the install works.
make image-model

# Non-interactive, by name (or MODEL=all for every entry):
make image-model MODEL=flux2-klein
make image-model MODEL="flux2-klein flux1-schnell"
```

(`make image-gen` still exists to install/upgrade just the tools without downloading
anything.) Skipping the download is safe — it's just slower later: the first generated
image downloads the weights itself before it can render (the same one-time fetch, as a
failsafe).

**Hugging Face account:** the shipped FLUX defaults are Apache-2.0 and download with
**no account or token**. Only a **gated** model (its Hugging Face page shows "Agree and
access repository") needs one: create a free account, accept the license on the model's
page, create a **Read** token at <https://huggingface.co/settings/tokens>, then
`hf auth login` (the token lands in `~/.cache/huggingface`, outside the repo).

**Picking and bringing models:** copy `image-generation.config.example.json` to
`image-generation.config.json` and edit — switch the `default`, or add an entry for any
model mflux can run (one CLI per family: `mflux-generate`, `mflux-generate-flux2`,
`mflux-generate-qwen`, …) or whatever Draw Things has loaded. The Connections page shows
the whole roster with per-model availability. Full walkthrough — including the
gated-repo and Hugging Face "Xet" download gotchas — is under **Local image generation**
in the console Docs. Skip all of this and the imagery skill still offers diagrams, data
figures, screenshots, and Unsplash.

## Running it

```bash
make dev
```

- API → http://localhost:5174 (Express, `src/server`)
- console → http://localhost:3001 (Vite, proxies `/api` to the API)

The console hot-reloads on edit; the API does not, so restart `make dev` after changing
`src/`. Run them separately with `make api` and `make console`. If a port is stuck from a
previous run, `make stop` frees both. `make` with no target lists every shortcut.

Fresh discovery material is a separate step — the Feeds page's **Run all** (or
`make discover` from the terminal) pulls new items into the Discovery inbox; it is not
part of running the app.

### The in-console terminal

The console's top-right **Terminal** button opens a live Claude Code session — the real
`claude` CLI, running locally, right inside the console. A chip per repo skill and agent
types its command into the session for you; you can also just chat. It launches the actual
binary on your subscription, so nothing is reimplemented and no credentials pass through
the console.

- **Finding `claude`.** No path is hardcoded. macOS/Linux resolve it through your login
  shell (the same PATH that makes `claude` work in your own terminal); Windows uses
  `claude.cmd`. If it can't be found — unusual install, custom PATH, Windows — set
  `CLAUDE_BIN` to its absolute path in `.env` (see `.env.example`).
- **Prerequisite.** The embedded terminal uses the native `node-pty` module, installed by
  `make install` (on macOS that needs the Xcode command-line tools, `xcode-select --install`).
  If the terminal can't start, the drawer says so and its chips fall back to copying the
  command for you to paste elsewhere.

## Everyday workflow

Work happens in the console, and each pipeline page has its own AI assistant: Spark
shapes a raw one-liner into a seeded queue item, Discovery works a found article into a
queued take, and Queue is where every idea carries its full written piece — the assistant
develops the points, drafts the post or long-form web article, revises it, and can put an
image on the card (the `imagery` skill); Publish on the card ships it. The assistants are
the repo's skills (`.claude/skills/`), surfaced in-app — the same commands also work in
any Claude Code session in this repo, or in the embedded terminal.

Every draft is routed through the `content-reviewer` gate, which runs
`src/review/voice-checks.ts` against the draft and applies judgment to the softer rules.
It never rewrites silently — it passes, or it returns a specific list of fixes. You decide.

## Repository layout

| Path | What it is |
|------|-----------|
| `.claude/skills/` | The content workflow, one skill per console surface: `spark`, `discovery`, `queue`, `feeds`, `pillars`, `register`, `tags`, `voice`, `brand`, `imagery` — plus `setup` and the shared references (`voice-card`, the doctrine, and the `*-procedure.md` files the router skills dispatch to) |
| `.claude/agents/` | `discover` (fills the idea queue) and `content-reviewer` (the voice gate) |
| `src/` | Local Express API (`src/server`), SQLite/Drizzle store (`src/db`), ingest (`src/ingest`), profile loader (`src/profile`), core scoring/pillars/tags (`src/core`), voice checks (`src/review`) |
| `console/` | Local React 19 + Vite + Tailwind console. 17 views across Pipeline (Overview, Discovery, Queue, Published), Insights (Calendar, Pillars, Intent, Register, Tags), Inputs (Voice, Brand, Feeds, Spark), System (Connections, Database, API Reference), and Docs — all backed by the live API (no mock data) |
| `profiles/` | **Your** profiles, one folder per slug (voice card, `identity.yaml`, interview). Gitignored — never committed |
| `profile.example/` | A fictional persona (Jordan Rivera) showing the profile shape. Tracked |
| `docs/` | Cadence design docs and brand docs (gitignored where they carry PII) |
| `data/` | Local SQLite database (`brand.db`). Gitignored |

## Data model

SQLite via Drizzle ORM (`src/db/schema.ts`), stored at `data/brand.db`:

- `profiles` / `app_settings` — your profiles and the active-profile pointer
- `sources` / `feed_items` / `feed_item_tags` — configured feeds, their fetched entries, and tag links
- `idea_queue_items` — the scored, tagged queue (pillar, tag, proposed angle, seed, score)
- `drafts` — hook options, body, close, media suggestion, review status
- `articles` — long-form pieces and their sections
- `tags` — the profile's tag vocabulary
- `scheduled_posts` / `published_posts` — planned posts and the published archive
- `sparks` — captured one-liners
- `linkedin_tokens` — LinkedIn OAuth tokens (local only, never leaves the server)

Browse the live schema any time in the console's **Database** view. Regenerate
migrations after a schema change with `npm run db:generate`, then `npm run db:migrate`.

## Design docs

The full design lives under `docs/cadence/designs/` (gitignored locally as it may carry
PII). Start with `00-overview.md` for the rationale, the five-pillar model, and the
anti-slop decisions log.
