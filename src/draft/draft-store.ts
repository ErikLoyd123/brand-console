import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { ideaQueueItems, drafts } from '../db/schema.js';
import { getActiveProfileId } from '../profile/loader.js';

export type IdeaForDraft = typeof ideaQueueItems.$inferSelect;

export interface SaveDraftInput {
  ideaId: string;
  hookOptions: string[];
  body: string;
  close: string;
  mediaSuggestion: string;
}

/** Read one idea-queue item to draft from. Throws if it does not exist. */
export function getIdeaForDraft(id: string): IdeaForDraft {
  const item = db.select().from(ideaQueueItems).where(eq(ideaQueueItems.id, id)).get();
  if (!item) {
    throw new Error(`draft-store: no idea-queue item with id ${id}`);
  }
  return item;
}

/**
 * Persist a draft and advance its idea-queue item.
 * A new draft.reviewStatus is 'pending'. The item's status becomes 'drafted'.
 */
export function saveDraft(input: SaveDraftInput): string {
  const draft = db
    .insert(drafts)
    .values({
      ideaId: input.ideaId,
      profileId: getActiveProfileId(),
      hookOptions: input.hookOptions,
      body: input.body,
      close: input.close,
      mediaSuggestion: input.mediaSuggestion,
      reviewStatus: 'pending',
    })
    .returning({ id: drafts.id })
    .get();

  db.update(ideaQueueItems)
    .set({ status: 'drafted' })
    .where(eq(ideaQueueItems.id, input.ideaId))
    .run();

  return draft.id;
}

export interface UpdateDraftFields {
  body?: string;
  hookOptions?: string[];
  close?: string;
  mediaSuggestion?: string;
}

/**
 * Patch a draft's content fields in place — used by the `revise` skill (and the
 * console editor's save shares the same PATCH route). Only the provided fields are written.
 * Any change to the written content (hook/body/close) resets reviewStatus to 'pending':
 * a revised draft is no longer covered by a prior review. Throws if the draft is unknown.
 */
export function updateDraftFields(id: string, fields: UpdateDraftFields): void {
  const existing = db.select().from(drafts).where(eq(drafts.id, id)).get();
  if (!existing) throw new Error(`draft-store: no draft with id ${id}`);

  const set: Partial<typeof drafts.$inferInsert> = {};
  if (fields.body !== undefined) set.body = fields.body;
  if (fields.hookOptions !== undefined) set.hookOptions = fields.hookOptions;
  if (fields.close !== undefined) set.close = fields.close;
  if (fields.mediaSuggestion !== undefined) set.mediaSuggestion = fields.mediaSuggestion;
  if (Object.keys(set).length === 0) return;

  // A content edit invalidates any prior review verdict.
  if (set.body !== undefined || set.hookOptions !== undefined || set.close !== undefined) {
    set.reviewStatus = 'pending';
  }
  db.update(drafts).set(set).where(eq(drafts.id, id)).run();
}

// CLI: `tsx src/draft/draft-store.ts <payload.json>` persists a draft from a JSON file.
// draft writes its generated post to a temp JSON file and calls this so a
// multi-line body never has to pass through a shell argument.
const isMain =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const payloadPath = process.argv[2];
  if (!payloadPath) {
    console.error('usage: tsx src/draft/draft-store.ts <payload.json>');
    process.exit(1);
  }
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8')) as SaveDraftInput;
  const draftId = saveDraft(payload);
  console.log(JSON.stringify({ draftId, ideaId: payload.ideaId, status: 'drafted' }));
}
