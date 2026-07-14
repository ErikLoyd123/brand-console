// src/ingest/manage-feed.ts
// CLI the feeds skill uses to LIST, UPDATE, or REMOVE feeds in the `sources` table.
// Adding a feed stays in add-feed.ts (it validates the URL is a real feed); this handles the
// rest of CRUD. Hardcodes no feeds — it operates on whatever is in the per-user DB.
//
//   npx tsx src/ingest/manage-feed.ts --list
//   npx tsx src/ingest/manage-feed.ts --update <id> '{"keywords":["aws","cost"],"curated":true,"enabled":false}'
//   npx tsx src/ingest/manage-feed.ts --remove <id>
//
// See design 2026-07-04-db-driven-feeds.

import Parser from 'rss-parser';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { sources, feedItems, feedItemTags } from '../db/schema';
import { getActiveProfileId } from '../profile/loader';

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

interface UpdatePatch {
  name?: string;
  url?: string;
  pillar?: string | null;
  keywords?: unknown;
  default_tag?: string;
  curated?: boolean;
  enabled?: boolean;
}

async function list(): Promise<void> {
  const rows = await db.select().from(sources).where(eq(sources.profileId, getActiveProfileId()));
  const out = rows.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    kind: r.kind,
    pillar: r.pillar,
    keywords: r.keywords ?? [],
    curated: Boolean((r.config as { curated?: boolean } | null | undefined)?.curated),
    enabled: r.enabled,
  }));
  console.log(JSON.stringify(out, null, 2));
}

async function update(id: string, json: string): Promise<void> {
  if (!id) fail('manage-feed --update: an id is required.');
  let patch: UpdatePatch;
  try {
    patch = JSON.parse(json) as UpdatePatch;
  } catch {
    fail('manage-feed --update: expected a JSON patch of fields to change.');
  }

  const existing = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
  if (existing.length === 0) fail(`manage-feed --update: no feed with id "${id}".`);
  const row = existing[0];

  const set: Partial<typeof sources.$inferInsert> = {};
  if (patch.name !== undefined) set.name = String(patch.name).trim();
  if (patch.url !== undefined) {
    const url = String(patch.url).trim();
    // Re-validate the feed if the URL is being changed.
    try {
      await new Parser().parseURL(url);
    } catch (err) {
      fail(`manage-feed --update: "${url}" did not parse as an RSS feed (${(err as Error).message}).`);
    }
    set.url = url;
  }
  if (patch.pillar !== undefined) set.pillar = patch.pillar ? String(patch.pillar).trim() : null;
  if (patch.keywords !== undefined) {
    set.keywords = Array.isArray(patch.keywords)
      ? patch.keywords.map((k) => String(k).trim()).filter(Boolean)
      : [];
  }
  if (patch.default_tag !== undefined) {
    set.defaultTag = patch.default_tag === 'ready-to-draft' ? 'ready-to-draft' : 'needs-your-take';
  }
  if (patch.enabled !== undefined) set.enabled = Boolean(patch.enabled);
  if (patch.curated !== undefined) {
    set.config = { ...(row.config ?? {}), curated: patch.curated === true };
  }

  const updated = await db.update(sources).set(set).where(eq(sources.id, id)).returning();
  const u = updated[0];
  console.log(
    `Updated feed "${u.name}" (pillar: ${u.pillar ?? 'none'}, ${(u.keywords ?? []).length} keywords, ` +
      `tag: ${u.defaultTag}, curated: ${Boolean((u.config as { curated?: boolean }).curated)}, ` +
      `${u.enabled ? 'active' : 'paused'}).`,
  );
}

async function remove(id: string): Promise<void> {
  if (!id) fail('manage-feed --remove: an id is required.');
  // FK enforcement is on — cascade in order: feed_item_tags -> feed_items -> source.
  const items = await db.select({ id: feedItems.id }).from(feedItems).where(eq(feedItems.sourceId, id));
  const itemIds = items.map((i) => i.id);
  if (itemIds.length > 0) {
    await db.delete(feedItemTags).where(inArray(feedItemTags.feedItemId, itemIds));
    await db.delete(feedItems).where(eq(feedItems.sourceId, id));
  }
  const deleted = await db.delete(sources).where(eq(sources.id, id)).returning();
  if (deleted.length === 0) fail(`manage-feed --remove: no feed with id "${id}".`);
  console.log(`Removed feed "${deleted[0].name}" and ${itemIds.length} of its inbox item(s).`);
}

async function main(): Promise<void> {
  const [, , mode, ...rest] = process.argv;
  if (mode === '--list') return list();
  if (mode === '--update') return update(rest[0], rest.slice(1).join(' '));
  if (mode === '--remove') return remove(rest[0]);
  fail('manage-feed: use --list, --update <id> <json>, or --remove <id>.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
