// src/draft/update-draft.ts
// CLI the `revise` skill invokes to write a refined draft back to the drafts table.
// Like draft-store's save CLI, it reads a JSON file (not a shell arg) so a multi-line body
// never has to survive shell escaping:
//
//   npx tsx src/draft/update-draft.ts <payload.json>
//
// where payload.json is { "id": "<draftId>", "body"?, "hookOptions"?: string[], "close"?,
// "mediaSuggestion"? } — only the fields present are written. Any hook/body/close change
// resets reviewStatus to 'pending' (a revised draft is no longer covered by a prior review).
// An unknown id exits non-zero with the message on stderr so the skill can surface it.

import { readFileSync } from 'node:fs';
import { updateDraftFields, type UpdateDraftFields } from './draft-store';

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error('usage: tsx src/draft/update-draft.ts <payload.json>');
  process.exit(1);
}

let payload: UpdateDraftFields & { id?: string };
try {
  payload = JSON.parse(readFileSync(payloadPath, 'utf8'));
} catch (e) {
  console.error(`update-draft: could not read/parse ${payloadPath}: ${(e as Error).message}`);
  process.exit(1);
}

if (!payload.id || payload.id.trim() === '') {
  console.error('update-draft: payload needs an "id".');
  process.exit(1);
}

try {
  const { id, ...fields } = payload;
  updateDraftFields(id, fields);
  const touched = Object.keys(fields).filter((k) => (fields as Record<string, unknown>)[k] !== undefined);
  console.log(`Updated draft ${id}: ${touched.length ? touched.join(', ') : 'no fields'}.`);
} catch (e) {
  console.error(`update-draft: ${(e as Error).message}`);
  process.exit(1);
}
