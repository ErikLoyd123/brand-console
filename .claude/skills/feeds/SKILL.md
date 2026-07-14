---
name: feeds
description: Add, edit, or remove the RSS feeds discovery watches — all in the database, no code or config editing. Add validates a URL is a real feed and files it under a pillar with relevance keywords and a default tag; edit changes any of those (or pauses a feed); remove deletes a feed and its inbox items. Reads your current feeds first, then asks what to do and does it.
type: skill
---

# feeds

Full CRUD for the RSS feeds discovery watches, all in the `sources` database table — the single
source of truth for feeds. Add a feed, change one, pause it, or remove it, entirely from here;
nothing in code or `identity.yaml`. Everything you touch is per-user runtime data in the DB.

**Invoke with:** "add a feed", "edit that feed", "remove a feed", "change a feed's keywords",
"watch this RSS feed", or from the Feeds page's AI mode.

## Onboarding gate

Confirm a profile exists (feeds attach to a pillar, which comes from the profile):

```bash
npx tsx -e "import('./src/profile/completeness.js').then(m => console.log(JSON.stringify(m.checkCompleteness(), null, 2)))"
```

If `identity.yaml` is missing entirely, say so and offer to run `setup` first; otherwise
continue. A pillar is strongly preferred (items file under one) but not strictly required.

## Scope

Writes **only** the `sources` table (`kind='rss'` feeds): `name`, `url`, `pillar`, `keywords`
(relevance terms), `default_tag`, `curated`, `enabled`. Never edits code, the voice card,
pillars, register, or `identity.yaml`. One feed per action.

## Step 1 — Read the feeds, then ask what to do

Run the list command below first, so you know the current feeds before saying anything.
Open with a one-line summary of what exists (how many feeds, which pillars they cover,
any paused), then ask whether the user wants to **add**, **edit**, **remove**, or **list**
feeds, and route accordingly. If they already said (e.g. "add this URL"), skip the
question — but still read the list first, so a duplicate or a conflict surfaces
immediately instead of mid-action.

## List / pick a feed

To show feeds, or to resolve which feed the user means for an edit/remove, list them (each row
carries its `id`):

```bash
npx tsx src/ingest/manage-feed.ts --list
```

Match the user's words to a feed by name and use its `id`. If the match is ambiguous, show the
candidates and ask.

## Add

1. **Get the URL.** The add CLI validates it parses as a real RSS/Atom feed and rejects
   duplicates and dead URLs — surface any error verbatim and let the user correct it.
2. **Name it** (the feed's own title is a good default), **pick the pillar** (from the profile's
   pillars), choose **relevance keywords** (lowercase terms that mark an item relevant — they
   shape the score, they don't filter), and set the **default tag** (`needs-your-take` usually,
   or `ready-to-draft`).
3. **Curated?** Ask (or infer) whether it's a feed the user trusts to be on-topic (a hand-picked
   link blog / digest), where every item scores high relevance instead of keyword matching. If
   curated, keywords are optional.
4. Write it:

   ```bash
   npx tsx src/ingest/add-feed.ts '{
     "name": "<name>", "url": "<feed url>", "pillar": "<pillar-key or null>",
     "keywords": ["<term>"], "default_tag": "needs-your-take", "curated": false
   }'
   ```

Read the pillars for the choice with:

```bash
npx tsx -e "import('./src/core/pillars.js').then(m => console.log(JSON.stringify(m.getPillars().map(k => ({ key: k, label: m.getPillarLabel(k) })), null, 2)))"
```

## Edit

Resolve the feed's `id` (List, above), confirm what to change, and pass **only the changed
fields** as a JSON patch. Fields: `name`, `url`, `pillar`, `keywords`, `default_tag`, `curated`,
`enabled`. Changing `url` re-validates it as a real feed.

```bash
npx tsx src/ingest/manage-feed.ts --update <id> '{"keywords":["espresso","brewing","gear"],"curated":false}'
```

To **pause** a feed (keep it but exclude it from runs) set `"enabled": false`; to reactivate,
`"enabled": true`.

## Remove

Resolve the `id`, then **confirm with the user** — removing a feed also deletes its inbox items
(promoted queue ideas are untouched). Then:

```bash
npx tsx src/ingest/manage-feed.ts --remove <id>
```

Report how many inbox items were removed.

## Report

After any action, confirm what changed in plain language: the feed name and the fields set (add:
pillar/keywords/tag/curated; edit: what changed; remove: the count of items deleted). For an add,
tell the user they can pull it now with the feed's **Run** button on the Feeds page.

## Rules

- One feed per action; only the `sources` table. Never code, never `identity.yaml`.
- Never write an unvalidated URL — the add/update CLIs parse the feed as the gate, and their
  errors are the user's to resolve, not something to guess around.
- Always confirm a **remove** before running it — it deletes the feed's inbox items too.
- Suggest pillar/keywords from the feed and the profile, but don't invent a fit the user didn't
  confirm.
