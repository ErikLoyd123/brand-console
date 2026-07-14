// src/ingest/migrate-feeds.ts
// One-time, idempotent importer: moves RSS feeds from the profile's identity.yaml `feed_groups`
// into the `sources` table, now the single source of truth for feeds. For each feed in each
// group it upserts a `kind='rss'` source by URL — inserting a new row, or backfilling
// pillar/keywords/default_tag onto a row a past discover-rss run already created (those
// predate the keywords/default_tag columns and carry empty defaults). Non-destructive: it
// never edits or deletes identity.yaml; feed_groups simply stops being read once discover-rss
// is flipped to the DB. Run once per existing profile:  npx tsx src/ingest/migrate-feeds.ts
// This file hardcodes no feeds — it imports whatever the loaded profile declares.
// See design 2026-07-04-db-driven-feeds.

import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { sources } from '../db/schema';
import { loadIdentity, profileExists } from '../profile/loader';

async function run(): Promise<void> {
  if (!profileExists()) {
    console.log('migrate-feeds: no profile found; nothing to migrate.');
    return;
  }
  const identity = loadIdentity();
  if (identity.feed_groups.length === 0) {
    console.log('migrate-feeds: profile has no feed_groups; nothing to migrate.');
    return;
  }

  let inserted = 0;
  let updated = 0;

  for (const group of identity.feed_groups) {
    for (const src of group.sources) {
      if (!src.url) continue;
      const existing = await db
        .select({ id: sources.id })
        .from(sources)
        .where(eq(sources.url, src.url))
        .limit(1);

      if (existing.length > 0) {
        // Backfill the group's metadata onto the row a prior run created.
        await db
          .update(sources)
          .set({
            kind: 'rss',
            name: src.name,
            pillar: group.pillar,
            keywords: group.keywords,
            defaultTag: group.default_tag,
            enabled: true,
          })
          .where(eq(sources.id, existing[0].id));
        updated += 1;
      } else {
        await db.insert(sources).values({
          kind: 'rss',
          name: src.name,
          url: src.url,
          pillar: group.pillar,
          keywords: group.keywords,
          defaultTag: group.default_tag,
          enabled: true,
        });
        inserted += 1;
      }
    }
  }

  // Fold the legacy OpenSourceDrop lens in: any kind='oss' source becomes a normal curated
  // RSS feed (config.curated => high relevance floor, the lens's old fixed-0.9 behavior), so it
  // is managed and runnable from the Feeds page like any other feed. Idempotent.
  const ossRows = await db.select().from(sources).where(eq(sources.kind, 'oss'));
  let converted = 0;
  for (const row of ossRows) {
    await db
      .update(sources)
      .set({ kind: 'rss', config: { ...(row.config ?? {}), curated: true } })
      .where(eq(sources.id, row.id));
    converted += 1;
  }

  console.log(
    `migrate-feeds: ${inserted} inserted, ${updated} updated from ${identity.feed_groups.length} feed group(s); ` +
      `${converted} OSS lens source(s) folded in as curated RSS feeds.`,
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
