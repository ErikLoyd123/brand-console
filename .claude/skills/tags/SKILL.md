---
name: tags
description: Grow your tag vocabulary without bloating it — the judgment the plain Add-tag box can't give. Adds tags you name (deduping against near-duplicates and synonyms first) or proposes a tight set drawn from your real untagged inbox items. Add-focused; rename, recolor, and delete stay on the Tags page. Prefers reusing an existing tag over minting a near-twin.
type: skill
---

# tags

Help the user grow the **tag vocabulary** — the topical labels attached to discovered items —
while keeping it small and tight. This is the human-in-the-loop version of the `discover` agent's
guardrail: *prefer reusing an existing tag; a small, tight vocabulary is the goal, not exhaustive
labeling.* You only ever **add**. Rename, recolor, and delete stay on the console's Tags page.

Everything you touch is the per-user `tags` table in the DB — never code, never `identity.yaml`.
Tags are profile-independent (they attach to feed items, not pillars), so there is no onboarding
gate: if the DB is reachable you can run.

**Invoke with:** "add a tag", "add a tag for X", "suggest some tags", "what tags am I missing",
or from the Tags page's AI mode.

## Scope

Writes **only** the `tags` table, add-only, via `src/ingest/manage-tags.ts`. One vocabulary per
run; add as many tags as the user confirms. Never renames, recolors, deletes, or merges (those
are the Tags page's job) — but you may *recommend* the user prune or merge there when you spot
redundancy.

## Step 1 — Always read the current vocabulary first

Never mint before you know what already exists. List it (each row carries `id`, `name`, `slug`,
and `usageCount`):

```bash
npx tsx src/ingest/manage-tags.ts --list
```

The `slug` is the frozen identity — casing and pluralization collide on it ("Cost Anomalies" and
"cost-anomaly" are the same tag). `usageCount` shows how load-bearing each tag is.

## Step 2 — Route by how the user came in

### Path A — the user names a tag (or a topic)
For each name the user proposes:

1. **Check for a collision or near-twin.** Slugify it mentally and compare against the vocabulary
   from Step 1 — not just exact slug matches, but **synonyms and near-duplicates** (e.g. proposed
   "Espresso Brewing" when "espresso" already exists; "K8s" when "kubernetes" exists). If a good
   existing tag already covers it, **recommend reuse** and don't mint. Say which existing tag and
   why.
2. **Only mint when nothing fits and the category is genuinely reusable** across future items — a
   tag that will only ever match one article is noise, not vocabulary.
3. Mint the survivors (insert-if-absent on slug — a slug hit returns the existing tag untouched
   with `minted:false`, so a race or a missed near-twin can never overwrite):

   ```bash
   npx tsx src/ingest/manage-tags.ts --add '{"name":"Cost Anomaly"}'
   ```

### Path B — the user asks you to suggest ("suggest tags", "what am I missing")
Ground the suggestions in real material, not guesses.

1. Read the untagged / thinly-tagged inbox items so proposals come from what's actually there:

   ```bash
   npx tsx -e "(async () => { const {db} = await import('./src/db/client'); const {feedItems, feedItemTags} = await import('./src/db/schema'); const {eq, isNull} = await import('drizzle-orm'); const r = await db.select({ id: feedItems.id, title: feedItems.title, summary: feedItems.summary }).from(feedItems).leftJoin(feedItemTags, eq(feedItemTags.feedItemId, feedItems.id)).where(isNull(feedItemTags.tagId)); console.log(JSON.stringify(r.slice(0, 40), null, 2)); process.exit(0); })();"
   ```

2. Propose a **tight** candidate set (a handful, not a taxonomy) drawn from recurring themes in
   those titles/summaries. Dedup each candidate against the existing vocabulary exactly as in
   Path A — a candidate that a current tag already covers is dropped, not offered.
3. Show the user the candidates with a one-line reason each, let them pick which to mint, then
   mint the chosen ones with `--add` as above.

## Step 3 — Report

Confirm plainly, so vocabulary growth stays visible and prunable:

- Which tags you **minted** and which you **reused** (never silently mint a near-twin).
- Any redundancy you noticed in the existing vocabulary worth merging/pruning on the Tags page —
  name the specific tags, don't act on it.
- The new vocabulary size.

## Rules

- Read the vocabulary (Step 1) before every mint. Never mint blind.
- Prefer reuse over minting; a near-duplicate is a bug in the vocabulary, not a new tag.
- Add-only. Never rename, recolor, delete, or merge — recommend those on the Tags page instead.
- Suggest tags grounded in the real vocabulary and real items; never invent a category the
  user's material doesn't support.
