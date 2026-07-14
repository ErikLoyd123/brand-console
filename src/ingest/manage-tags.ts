// src/ingest/manage-tags.ts
// CLI the `tags` skill uses to LIST the vocabulary or ADD a tag to the `tags` table.
// Add-only by design: rename, recolor, and delete stay in the console's Tags page (and the
// PATCH/DELETE routes). Hardcodes no tags — it operates on whatever is in the per-user DB.
// The slug + insert-if-absent semantics mirror src/server/routes/tags.ts so a tag minted here
// and one minted in the console collide on the same unique slug.
//
//   npx tsx src/ingest/manage-tags.ts --list
//   npx tsx src/ingest/manage-tags.ts --add '{"name":"Cost Anomaly"}'
//
// See the `tags` skill (.claude/skills/tags/SKILL.md).

import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { tags, feedItemTags } from '../db/schema';
import { getActiveProfileId } from '../profile/loader';

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

// Normalize a display name into a stable slug key: lowercase, non-alphanumerics collapse to
// single hyphens, trim leading/trailing hyphens. Kept identical to routes/tags.ts so casing and
// pluralization ("Cost Anomalies" vs "cost-anomaly") collide on the unique slug index.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// List the whole vocabulary with a per-tag usage count (how many feed items carry it), via a
// left join so tags attached to nothing still report 0. Same shape as GET /api/tags.
async function list(): Promise<void> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
      usageCount: sql<number>`count(${feedItemTags.feedItemId})`,
    })
    .from(tags)
    .leftJoin(feedItemTags, eq(feedItemTags.tagId, tags.id))
    .where(eq(tags.profileId, getActiveProfileId()))
    .groupBy(tags.id)
    .orderBy(asc(tags.name));
  console.log(JSON.stringify(rows, null, 2));
}

// Insert-if-absent on slug. A slug hit returns the existing tag untouched with minted:false, so
// the skill can report reuse vs. mint truthfully. Never overwrites an existing tag's name/color.
async function add(json: string): Promise<void> {
  let parsed: { name?: unknown };
  try {
    parsed = JSON.parse(json) as { name?: unknown };
  } catch {
    fail('manage-tags --add: expected JSON like \'{"name":"Cost Anomaly"}\'.');
  }
  const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
  const slug = slugify(name);
  if (slug === '') fail('manage-tags --add: a non-empty "name" is required.');

  const pid = getActiveProfileId();
  const existing = await db
    .select()
    .from(tags)
    .where(and(eq(tags.profileId, pid), eq(tags.slug, slug)))
    .limit(1);
  if (existing.length > 0) {
    console.log(JSON.stringify({ ...existing[0], minted: false }, null, 2));
    return;
  }
  const inserted = await db.insert(tags).values({ name, slug, profileId: pid }).returning();
  console.log(JSON.stringify({ ...inserted[0], minted: true }, null, 2));
}

async function main(): Promise<void> {
  const [, , mode, ...rest] = process.argv;
  if (mode === '--list') return list();
  if (mode === '--add') return add(rest.join(' '));
  fail('manage-tags: use --list or --add \'{"name":"..."}\'.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
