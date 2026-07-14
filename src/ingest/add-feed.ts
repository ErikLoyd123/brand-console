// src/ingest/add-feed.ts
// CLI the `add-feed` skill invokes to add one RSS feed to the `sources` table — the feed-axis
// analogue of capture.ts / write-register.ts. Takes the feed as JSON (argv[2] or stdin),
// VALIDATES the URL actually parses as RSS (so no dead/non-feed URLs enter the DB), then
// inserts a kind='rss' source. Prints the created row. A bad/duplicate/non-feed URL exits
// non-zero with the reason on stderr so the skill surfaces it verbatim. Hardcodes no feeds.
//
//   npx tsx src/ingest/add-feed.ts '{"name":"Daily Grind Weekly","url":"https://example.com/feed/",
//     "pillar":"brewing","keywords":["espresso","brewing"],"default_tag":"needs-your-take"}'
//
// See design 2026-07-04-db-driven-feeds.

import { readFileSync } from 'node:fs';
import Parser from 'rss-parser';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { sources } from '../db/schema';
import { getActiveProfileId } from '../profile/loader';

interface AddFeedInput {
  name?: string;
  url?: string;
  pillar?: string | null;
  keywords?: unknown;
  default_tag?: string;
  curated?: boolean;
}

function readInput(): string {
  const arg = process.argv[2];
  if (arg && arg.trim() !== '') return arg;
  return readFileSync(0, 'utf8');
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function main(): Promise<void> {
  let input: AddFeedInput;
  try {
    input = JSON.parse(readInput()) as AddFeedInput;
  } catch {
    fail('add-feed: expected a feed as JSON (name, url, pillar?, keywords?, default_tag?).');
  }

  const name = String(input.name ?? '').trim();
  const url = String(input.url ?? '').trim();
  if (!name) fail('add-feed: a name is required.');
  if (!url) fail('add-feed: a url is required.');

  const pid = getActiveProfileId();
  const existing = await db
    .select({ id: sources.id })
    .from(sources)
    .where(and(eq(sources.profileId, pid), eq(sources.url, url)))
    .limit(1);
  if (existing.length > 0) fail(`add-feed: a feed with url "${url}" already exists.`);

  // Validate it's a real, parseable RSS/Atom feed before writing.
  try {
    await new Parser().parseURL(url);
  } catch (err) {
    fail(`add-feed: "${url}" did not parse as an RSS feed (${(err as Error).message}).`);
  }

  const keywords = Array.isArray(input.keywords)
    ? input.keywords.map((k) => String(k).trim()).filter(Boolean)
    : [];
  const defaultTag = input.default_tag === 'ready-to-draft' ? 'ready-to-draft' : 'needs-your-take';
  const pillar = input.pillar ? String(input.pillar).trim() : null;

  // curated => trust the feed to be on-topic; items get a high relevance floor instead of
  // keyword scoring. Good for hand-picked/link-blog feeds (the former OpenSourceDrop lens).
  const curated = input.curated === true;

  const inserted = await db
    .insert(sources)
    .values({ profileId: pid, kind: 'rss', name, url, pillar, keywords, defaultTag, config: { curated }, enabled: true })
    .returning();

  const row = inserted[0];
  console.log(
    `Added RSS feed "${row.name}" (pillar: ${row.pillar ?? 'none'}, ` +
      `${keywords.length} keyword${keywords.length === 1 ? '' : 's'}, tag: ${row.defaultTag}` +
      `${curated ? ', curated' : ''}). Run it from the Feeds page to pull items.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
