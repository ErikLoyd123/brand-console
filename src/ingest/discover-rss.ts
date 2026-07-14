// src/ingest/discover-rss.ts
// Generic RSS discovery engine. Reads the enabled RSS feeds from the `sources` table — the
// single source of truth for feeds — and records raw feed items into the inbox (feed_items),
// each carrying a lightweight relevance/freshness score so the triage inbox can sort by it.
// Discovery is record-only: it does not create idea_queue_items — those are born only on
// promote or capture. The /discover agent tags the recorded inbox items.
//
// `runRss` is the reusable engine (also called by the console's Run buttons via
// POST /api/sources[/:id]/run); the bottom of this file is a thin CLI wrapper that runs every
// enabled RSS feed, preserving `npx tsx src/ingest/discover-rss.ts` for the agent/script path.
// See designs 02-discovery-and-enrichment and 2026-07-04-db-driven-feeds.

import Parser from 'rss-parser';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { sources, feedItems } from '../db/schema';
import { score, freshnessScore } from '../core/scoring';
import { getActiveProfileId } from '../profile/loader';

const parser = new Parser();

type SourceRow = typeof sources.$inferSelect;

/** One feed's outcome from a run — truthful counts, with a per-feed error instead of a throw. */
export interface FeedRunResult {
  sourceId: string;
  name: string;
  parsed: number;
  added: number;
  error?: string;
}

/** Keyword relevance in 0..1 from the item text against the feed's keyword set. */
function relevanceOf(text: string, keywords: string[]): number {
  const haystack = text.toLowerCase();
  const hits = keywords.filter((t) => haystack.includes(t.toLowerCase())).length;
  return Math.min(1, 0.6 + hits * 0.15);
}

/** All enabled RSS feeds from the DB, in insertion order. */
async function enabledRssSources(): Promise<SourceRow[]> {
  return db
    .select()
    .from(sources)
    .where(and(eq(sources.kind, 'rss'), eq(sources.enabled, true), eq(sources.profileId, getActiveProfileId())))
    .all();
}

/** Fetch and record one feed's new items into the inbox, returning its outcome. */
async function runOne(src: SourceRow): Promise<FeedRunResult> {
  const result: FeedRunResult = { sourceId: src.id, name: src.name, parsed: 0, added: 0 };
  if (!src.url) {
    result.error = 'no url';
    return result;
  }

  let feed: Parser.Output<Record<string, unknown>>;
  try {
    feed = await parser.parseURL(src.url);
  } catch (err) {
    result.error = (err as Error).message;
    return result;
  }

  const entries = feed.items ?? [];
  result.parsed = entries.length;

  for (const entry of entries) {
    const externalId = entry.guid ?? entry.link ?? entry.title ?? '';
    if (!externalId) continue;
    const dupe = await db
      .select({ id: feedItems.id })
      .from(feedItems)
      .where(and(eq(feedItems.sourceId, src.id), eq(feedItems.externalId, externalId)))
      .limit(1);
    if (dupe.length > 0) continue;

    const title = entry.title ?? '(untitled)';
    const link = entry.link ?? src.url;
    const summary = (entry.contentSnippet ?? entry.content ?? '').slice(0, 1000);
    const publishedAt = entry.isoDate ? new Date(entry.isoDate).getTime() : null;

    // A "curated" feed (config.curated) is one you trust to be on-topic — every item gets a
    // high relevance floor instead of keyword scoring. This generalizes the old OpenSourceDrop
    // lens's fixed 0.9 into a per-feed attribute any feed can carry.
    const curated = Boolean((src.config as { curated?: boolean } | null | undefined)?.curated);
    const relevance = curated ? 0.9 : relevanceOf(`${title} ${summary}`, src.keywords ?? []);
    const freshness = freshnessScore(publishedAt);
    const itemScore = score(relevance, freshness, 0.6);

    await db.insert(feedItems).values({
      profileId: src.profileId,
      sourceId: src.id,
      externalId,
      title,
      url: link,
      summary,
      publishedAt,
      score: itemScore,
    });
    result.added += 1;
  }

  return result;
}

/**
 * Run RSS discovery over the given sources (default: all enabled RSS feeds). Record-only:
 * inserts new inbox items with a relevance/freshness score. A single feed's fetch/parse error
 * is captured in its result, never fatal to the others. Returns a per-feed summary and total.
 */
export async function runRss(
  list?: SourceRow[],
): Promise<{ perFeed: FeedRunResult[]; totalAdded: number }> {
  const feeds = list ?? (await enabledRssSources());
  const perFeed: FeedRunResult[] = [];
  for (const src of feeds) {
    perFeed.push(await runOne(src));
  }
  const totalAdded = perFeed.reduce((n, r) => n + r.added, 0);
  return { perFeed, totalAdded };
}

/** Run one feed by id (used by POST /api/sources/:id/run). Null if the id is unknown/not rss. */
export async function runOneById(sourceId: string): Promise<FeedRunResult | null> {
  const rows = await db.select().from(sources).where(eq(sources.id, sourceId)).limit(1);
  const src = rows[0];
  if (!src || src.kind !== 'rss') return null;
  return runOne(src);
}

// CLI wrapper: run every enabled RSS feed. Preserves the agent/script entry point.
async function main(): Promise<void> {
  const feeds = await enabledRssSources();
  if (feeds.length === 0) {
    console.log(
      'discover-rss: no enabled RSS feeds in the sources table. Add feeds from the console ' +
        '(Feeds page or the add-feed skill), or run migrate-feeds once to import identity.yaml.',
    );
    return;
  }
  const { perFeed, totalAdded } = await runRss(feeds);
  for (const r of perFeed) {
    if (r.error) console.error(`skip ${r.name}: ${r.error}`);
    else console.log(`${r.name}: parsed ${r.parsed} entries, ${r.added} new`);
  }
  console.log(`discover-rss: ${totalAdded} new feed items recorded to the inbox`);
}

// Only run the CLI when invoked directly, so importing runRss from the API doesn't trigger a run.
if (process.argv[1] && process.argv[1].endsWith('discover-rss.ts')) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
