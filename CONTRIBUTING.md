# Contributing

This is a local-first personal-brand **content engine**: it discovers source material,
drafts posts and articles in the owner's voice, produces brand-styled imagery, and
reviews everything against a voice gate — operated through a local web console.
`CLAUDE.md` is the full contract (AI agents working in this repo follow it); this file
is the short human version.

## The one hard rule

**Nothing committed may be user-specific.** Every tracked file — `src/`,
`console/src/`, skills under `.claude/`, migrations, docs — must be generic and
identical for every user. No real person's feeds, pillars, voice, names, products,
credentials, or anything traceable to an individual. All personal data lives only in
gitignored homes:

| Home | Holds |
|---|---|
| `profiles/<slug>/` | voice card, identity config, brand look (colors/logos/brand docs) |
| `data/` | the SQLite database, image files, exports |
| `.env` | credentials (LinkedIn, Unsplash) — server-side only, never sent to the frontend |

`profile.example/` is the one exception: a fictional persona used as a neutral
reference. If a change needs personal data to work, the data goes in a profile or the
DB and the code reads it at runtime.

## Boundaries worth knowing before you build

- **Local-only.** Single-user tool on localhost. No public exposure, remote hosting,
  or multi-tenant assumptions.
- **Secrets stay server-side.** The browser reaches secret-backed capability only
  through `/api/*` routes.
- **Skills/agents are UI.** `.claude/skills/*/SKILL.md` frontmatter (`name`,
  `description`) becomes console buttons automatically — keep both accurate when you
  touch a skill.
- **Docs sync contract.** `console/src/content/docs/how-it-fits-together.md` is the
  canonical map of where everything lives. Add or move a config field, route, table,
  or view → update that doc in the same PR.
- **Provenance in the UI.** Nothing the console shows may be a bare value: every
  surface says what the data is and where it's managed.

## Dev setup

```bash
npm install && npm run db:migrate     # deps + SQLite schema (data/brand.db)
npm run server                        # API on :5174
cd console && npm install && npm run dev   # console on :3001 (proxies /api)
```

## Before you open a PR

- `npx tsc --noEmit` (repo root) and `npx tsc --noEmit -p console` both pass — CI
  enforces exactly these.
- Skim your diff for the hard rule: no personal data, no secrets, nothing that only
  makes sense for one user.
- Commits carry **your** name, no AI co-author trailers — accountability for pushed
  code rests with the person who ships it.

## Workflow

Branch from `main`, open a PR, merge when CI is green. Small, reviewable changes over
big-bang branches.
