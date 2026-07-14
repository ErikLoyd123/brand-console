# CLAUDE.md

## What this is

A personal-brand **content engine**: it discovers source material, drafts LinkedIn
posts in the owner's voice, and reviews them against a voice gate — a pipeline of
ingest → queue → draft → review, driven by local Claude Code skills and agents and
operated through a local **brand-console** web UI.

## Architecture

- **API** — Express, `src/server/index.ts`, on **port 5174**. Routes live in
  `src/server/routes/*` and mount under `/api/*`.
- **Console** — React + Vite app under `console/`, dev server on **port 3001**
  (`console/vite.config.ts`), which proxies `/api` → `http://localhost:5174`.
- **Database** — better-sqlite3 + drizzle-orm under `src/db/`. Schema:
  `src/db/schema.ts`; client: `src/db/client.ts`; migrations: `src/db/migrate.ts`.
- **Ingest** — discovery/capture scripts under `src/ingest/`
  (`discover-rss.ts`, `capture.ts`, `add-feed.ts`, `manage-feed.ts`).
- **Content engine** — skills in `.claude/skills/<name>/SKILL.md`
  (`spark`, `discovery`, `queue`, `feeds`, `pillars`,
  `register`, `tags`, `voice`, `setup`, `voice-card`) and agents in
  `.claude/agents/<name>.md` (`content-reviewer`, `discover`). Shared, non-invokable
  skill references (no `name:` frontmatter, linked not run) live directly under
  `.claude/skills/`: `onboarding-gate.md`, `content-doctrine.md`, and the
  `*-procedure.md` files the router skills dispatch to (`develop`/`draft`/`revise` for
  posts, `article-draft` for long-form web pieces written as one markdown document). The
  pipeline is capture → **queue (the review phase — every idea carries its full written
  piece)** → published; spark/discovery write the full piece in the same run, and Publish
  on a queue card ships it (LinkedIn API, Reddit copy-paste, web = markdown export). The
  fixed product rosters — a post's axes — live in `src/core/`: `silos.ts` (intent),
  `registers.ts` (platform/tone menu), and pillars; per-user selection layers on top in
  the active profile's `identity.yaml` (under gitignored `profiles/<slug>/`, resolved by
  `src/profile/loader.ts` — never hardcode a profile path).
- **Cadence** — planning system; config `.cadence/config.yaml`, docs under
  `docs/cadence/`.

## Running it

- API: `npm run server` (root — runs the API on 5174 via tsx).
- Database: `npm run db:generate`, `npm run db:migrate` (root).
- Console: `cd console && npm run dev` (3001), `npm run build`, `npm run preview`.

The console proxies `/api` to the API, so run both `npm run server` and the console
`npm run dev` for the UI to reach live data.

## Console terminal & the skill/agent contract

The console runs the real `claude` CLI in an embedded terminal (`src/server/terminal.ts`,
WebSocket `/api/terminal` bridged to a `node-pty` process). Its skill/agent
quick-command buttons are auto-generated from `GET /api/skills`, which scans
`.claude/skills/*/SKILL.md` and `.claude/agents/*.md` and reads each one's
frontmatter `name` and `description`.

**How the terminal finds `claude` (cross-platform):** it does not hardcode a path.
On macOS/Linux it launches `claude` through your login+interactive shell
(`$SHELL -lic 'exec claude'`), so claude resolves from your own PATH exactly as it
does when you type `claude` in a terminal. On Windows it spawns `claude.cmd` via
node-pty's ConPTY. If auto-detection fails (non-standard install, unusual PATH),
set `CLAUDE_BIN` in `.env` to claude's absolute path — see `.env.example`. The repo
root passed as the terminal's cwd is derived from the source location, never
hardcoded, so a fresh clone works without edits.

**Contract:** when you add or change a skill or agent, keep its frontmatter `name`
and `description` accurate — they become the button's label and tooltip. Adding a
skill surfaces its button with zero UI code; a stale or missing `name`/`description`
yields a missing or misleading button.

## In-app docs, markdown, and the architecture map

The console has a **Docs** section built from `console/src/content/docs/*.md`. Adding a
doc is just dropping a `.md` file with `title` / `category` / `order` frontmatter into
that folder — `console/src/lib/docs.ts` globs and registers it at build time (no manifest,
no DB). Category order: `Getting started`, `Setup`, `Reference`.

**Markdown formatting:** every markdown surface (doc bodies, the voice card) renders
through the shared `Markdown` component (`console/src/components/Markdown.tsx`), which uses
`react-markdown` + `remark-gfm`. **GitHub-flavored markdown is supported** — tables,
strikethrough, task lists, autolinks — and each element is hand-styled to the design
system (not `@tailwindcss/typography`). So: write GFM freely (tables are fine), always
render through this component, and never hand-roll a second renderer or
`dangerouslySetInnerHTML`. If you introduce a markdown element that isn't mapped yet, add
its styled mapping in that component rather than accepting the bare browser default.

**Sync contract:** `console/src/content/docs/how-it-fits-together.md` is the canonical map
of *where each kind of thing lives* (committed code vs gitignored `profiles/<slug>/` config vs
database) and *what is edited in the console vs authored via `setup` vs both*, plus
onboarding. When you add, move, or rename a surface — a config field (`identity.yaml` or a
`src/core/` roster), a console view or `/api/*` route, a DB table/column, or an onboarding
step — update that doc and its quick-reference table so it stays true. It is user-facing;
keep it plain-language.

## Provenance in the UI (design rule)

Nothing the console surfaces should sit in the open as a bare value with no explanation. Every
displayed piece of data must be **self-describing**: from the surface itself the user can tell
**what it is** and **where it originates / how to manage it**. When a view shows data that is
owned elsewhere — a config field, a DB table, another tab, or something authored by a skill —
say so and provide the affordance: link to the tab that manages it (e.g. a "Manage feeds →" /
"Manage pillars →" link), or name the origin for read-only data (e.g. "Stored in the database",
"Set via the `setup` skill"). Editable-elsewhere data links to its editor; read-only data states
its source. A raw list or value with no provenance is a bug, not a finished surface.

## Git

- **No AI attribution in commits.** Never add `Co-Authored-By: Claude …` (or any other
  AI co-author/generated-with trailer) to commit messages or PR bodies in this repo.
  Commits carry the human author's name alone — accountability for pushed code rests
  with the person who ships it, and the contributor graph should show people.

## Boundaries (hard rules)

- **Nothing committed may be user-specific.** Anything that flows into the repo —
  i.e. any tracked, non-gitignored file: `src/`, `console/src/`, committed skills and
  agents under `.claude/`, migrations, docs — MUST be generic and identical for every
  user. No person's actual feeds, pillars, tones, voice, names, relationships,
  products, or any detail telling of a specific individual, and no skill or agent that
  only makes sense for one user. This is a hard gate on every commit: when the code
  ships to GitHub it carries zero personal data. All user-unique data belongs to the
  **user**, not the repo, and lives only in the gitignored `profiles/` tree or the local
  **database** (`data/brand.db`, gitignored, fresh per clone) — reached at runtime, never
  hardcoded. The committed code is a generic engine; the person's identity is data it
  loads. If asked to "remember" or "add" something user-specific, put it in the active
  profile's folder or the DB, never in a tracked file. (`profile.example/` is the one deliberate
  exception: a fictional persona used as a neutral reference, never a real user.)
- **Local-only.** This is a local single-user tool. Do not add public exposure,
  remote hosting, or multi-tenant assumptions.
- **Secrets stay server-side.** Credentials (API keys, tokens, LinkedIn auth) live
  only in the Express server / server-side env and are never sent to or embedded in
  the frontend. The browser reaches secret-backed capability only through `/api/*`.

## Profile data

`profiles/<slug>/` folders hold personalized voice/identity data — one per profile
(personal or brand), all **gitignored** — plus rows in the `profiles` table; the
active one is picked by `app_settings.active_profile_id` and resolved per call by
`src/profile/loader.ts`. Local runtime data, never committed. A fresh clone ships
only the tracked `profile.example/` persona; create a profile from the console's
sidebar switcher, then the `setup` skill (run from the Voice page or a terminal)
populates it.
