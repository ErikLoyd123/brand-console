// src/articles/create-article.ts
// CLI the spark/discovery web branch invokes to side-write the articles row after the queue
// item is written. The actual write is the shared createArticle (src/core/create-article.ts),
// the same one any API path uses, so the AI and manual creation paths cannot drift.
//
//   npx tsx src/articles/create-article.ts <ideaId> '{"title":"...","targetKeyword":"...","searchIntent":"..."}'
//   cat payload.json | npx tsx src/articles/create-article.ts <ideaId>
//
// An idea that already has an article, or an unknown id, exits non-zero with the reason on
// stderr so the skill can surface it verbatim rather than double-create.

import { readFileSync } from 'node:fs';
import { createArticle, type CreateArticleInput } from '../core/create-article';

const ideaId = process.argv[2];
if (!ideaId || ideaId.trim() === '') {
  console.error('create-article: expected an idea-queue id as the first argument.');
  process.exit(1);
}

function readJson(): string {
  const arg = process.argv[3];
  if (arg && arg.trim() !== '') return arg;
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '{}';
  }
}

let input: CreateArticleInput;
try {
  const raw = readJson().trim();
  input = raw === '' ? {} : (JSON.parse(raw) as CreateArticleInput);
} catch {
  console.error('create-article: expected a JSON payload with optional "title", "targetKeyword", "searchIntent".');
  process.exit(1);
}

const result = createArticle(ideaId, input);
if (!result.ok) {
  if (result.error === 'idea-not-found') {
    console.error(`create-article: no idea-queue item with id ${ideaId}.`);
  } else {
    console.error(`create-article: idea ${ideaId} already has article \`${result.articleId}\`.`);
  }
  process.exit(1);
}

// Report the created id in a form the console's result-linker can parse (id labeled and backticked).
console.log(`Created article \`${result.articleId}\` from idea ${ideaId}.`);
