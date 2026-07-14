// src/core/export-article.ts
// The single writer behind both the export CLI (src/articles/export-article.ts) and
// POST /api/articles/:id/export, mirroring the promote/create-article shared-writer-plus-CLI
// pattern so the manual and API export paths cannot drift. Renders the article to a markdown
// file with an SEO frontmatter block under data/exports/<profileId>/<slug>.md (data/ is
// gitignored), then stamps exportPath/exportedAt and advances stage to 'exported'. Re-exporting
// overwrites the same <slug>.md and refreshes the date — idempotent on the slug. Export does not
// publish. See design 2026-07-13-multi-profile-longform-lane/04-articles-artifact-and-pipeline.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { articles } from '../db/schema';
import { REPO_ROOT } from '../profile/loader';

export type ExportArticleResult =
  | { ok: true; path: string }
  | { ok: false; error: 'not-found' }
  | { ok: false; error: 'no-slug' };

// A JSON string literal is a valid YAML double-quoted scalar, so JSON.stringify gives
// correct escaping (quotes, backslashes, newlines) for frontmatter values that may
// contain a colon or quote. Slug (kebab-case) and date never need it.
function yamlValue(value: string): string {
  return JSON.stringify(value);
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function exportArticle(articleId: string): ExportArticleResult {
  const article = db.select().from(articles).where(eq(articles.id, articleId)).get();
  if (!article) return { ok: false, error: 'not-found' };
  const slug = (article.slug ?? '').trim();
  if (slug === '') return { ok: false, error: 'no-slug' };

  const now = Date.now();
  const frontmatter = [
    '---',
    `title: ${yamlValue(article.title)}`,
    `description: ${yamlValue(article.metaDescription)}`,
    `target_keyword: ${yamlValue(article.targetKeyword)}`,
    `slug: ${slug}`,
    `date: ${isoDate(now)}`,
    '---',
  ].join('\n');

  const bodyParts: string[] = [`# ${article.title}`];
  for (const section of article.sections) {
    bodyParts.push(`## ${section.heading}`);
    bodyParts.push(section.body);
  }

  const contents = `${frontmatter}\n\n${bodyParts.join('\n\n')}\n`;

  const dir = resolve(REPO_ROOT, 'data', 'exports', article.profileId);
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, `${slug}.md`);
  writeFileSync(path, contents, 'utf8');

  db.update(articles)
    .set({ exportPath: path, exportedAt: now, stage: 'exported', updatedAt: now })
    .where(eq(articles.id, articleId))
    .run();

  return { ok: true, path };
}
