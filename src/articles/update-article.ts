// src/articles/update-article.ts
// CLI the section-draft/section-revise procedures invoke to write article edits back. Like
// update-draft.ts it reads a JSON file (not a shell arg) so a multi-line section body never has
// to survive shell escaping:
//
//   npx tsx src/articles/update-article.ts <payload.json>
//
// where payload.json is { "id": "<articleId>", ...UpdateArticleFields } — only the fields
// present are written. A content write resets reviewStatus to 'pending'; an explicit
// reviewStatus in the payload is honored instead. An unknown id exits non-zero with the message
// on stderr so the skill can surface it.

import { readFileSync } from 'node:fs';
import { updateArticle, type UpdateArticleFields } from '../core/update-article';

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error('usage: tsx src/articles/update-article.ts <payload.json>');
  process.exit(1);
}

let payload: UpdateArticleFields & { id?: string };
try {
  payload = JSON.parse(readFileSync(payloadPath, 'utf8'));
} catch (e) {
  console.error(`update-article: could not read/parse ${payloadPath}: ${(e as Error).message}`);
  process.exit(1);
}

if (!payload.id || payload.id.trim() === '') {
  console.error('update-article: payload needs an "id".');
  process.exit(1);
}

try {
  const { id, ...fields } = payload;
  updateArticle(id, fields);
  const touched = Object.keys(fields).filter(
    (k) => (fields as Record<string, unknown>)[k] !== undefined,
  );
  console.log(`Updated article ${id}: ${touched.length ? touched.join(', ') : 'no fields'}.`);
} catch (e) {
  console.error(`update-article: ${(e as Error).message}`);
  process.exit(1);
}
