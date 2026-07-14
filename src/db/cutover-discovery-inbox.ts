import { and, eq, isNull, notLike, or, sql } from 'drizzle-orm';
import { db } from './client';
import { feedItems, ideaQueueItems } from './schema';

// (a) Defensive backfill: ensure every existing feed_item carries a triage_state.
// The NOT NULL DEFAULT 'inbox' column fills existing and new rows at migration
// time, so this normally reports 0 changes; it exists to catch any row that
// predates the default (NULL or empty string).
const backfilled = db
  .update(feedItems)
  .set({ triageState: 'inbox' })
  .where(sql`${feedItems.triageState} IS NULL OR ${feedItems.triageState} = ''`)
  .run();
console.log(`[cutover] backfilled triage_state='inbox' on ${backfilled.changes} feed_items`);

// (b) Clear the auto-discovered queue flood: delete idea_queue_items that are
// still status='new' and were NOT created by capture. capture.ts writes
// sourceRef='spark:...'; discovery writes the article URL. Rows with a NULL
// sourceRef are also cleared here (a `new` row without a spark: sentinel is not
// a capture), so this delete predicate matches the Step-3/96 verification
// exactly and leaves no daylight between what's deleted and what's checked.
const deleted = db
  .delete(ideaQueueItems)
  .where(
    and(
      eq(ideaQueueItems.status, 'new'),
      or(isNull(ideaQueueItems.sourceRef), notLike(ideaQueueItems.sourceRef, 'spark:%')),
    ),
  )
  .run();
console.log(
  `[cutover] deleted ${deleted.changes} auto-discovered idea_queue_items (status='new', sourceRef IS NULL OR NOT LIKE 'spark:%')`,
);

// Report what survived, so the cutover proves sparks and drafts were preserved.
const remaining = db.select().from(ideaQueueItems).all();
const sparkCount = remaining.filter((r) => r.sourceRef?.startsWith('spark:')).length;
console.log(`[cutover] ${remaining.length} idea_queue_items remain (${sparkCount} sparks)`);
