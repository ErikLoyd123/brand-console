// src/articles/export-article.ts
// CLI the export stage invokes to render an article to disk. The actual write is the shared
// exportArticle (src/core/export-article.ts), the same one POST /api/articles/:id/export uses,
// so the manual and API export paths cannot drift:
//
//   npx tsx src/articles/export-article.ts <articleId>
//
// An article with no slug yet, or an unknown id, exits non-zero with the reason on stderr.

import { exportArticle } from '../core/export-article';

const articleId = process.argv[2];
if (!articleId || articleId.trim() === '') {
  console.error('export-article: expected an article id as the first argument.');
  process.exit(1);
}

const result = exportArticle(articleId);
if (!result.ok) {
  if (result.error === 'not-found') {
    console.error(`export-article: no article with id ${articleId}.`);
  } else {
    console.error(`export-article: article ${articleId} has no slug yet; set one at the outline stage before export.`);
  }
  process.exit(1);
}

console.log(`Exported article ${articleId} to ${result.path}.`);
