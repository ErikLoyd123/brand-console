// src/core/export-article.ts
// The single writer behind both the export CLI (src/articles/export-article.ts) and
// POST /api/articles/:id/export, mirroring the promote/create-article shared-writer-plus-CLI
// pattern so the manual and API export paths cannot drift. Renders the article to a markdown
// file with an SEO frontmatter block under data/exports/<profileId>/<slug>.md (data/ is
// gitignored), then stamps exportPath/exportedAt and advances stage to 'exported'. Re-exporting
// overwrites the same <slug>.md and refreshes the date — idempotent on the slug. Export does not
// publish. See design 2026-07-13-multi-profile-longform-lane/04-articles-artifact-and-pipeline.

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { articles } from '../db/schema';
import { imageAbsPath, listImagesForIdea } from '../images/store';
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
  const dir = resolve(REPO_ROOT, 'data', 'exports', article.profileId);
  mkdirSync(dir, { recursive: true });

  // Bundle the idea's attached images beside the markdown (images/<slug>/…) and list
  // them in the frontmatter with their alt text, so the shipped folder is complete —
  // whatever site consumes the export gets the visuals and their descriptions with it.
  const attached = listImagesForIdea(article.ideaId);
  const bundled: { src: string; alt: string }[] = [];
  const srcByImageId = new Map<string, string>();
  if (attached.length > 0) {
    const imgDir = resolve(dir, 'images', slug);
    mkdirSync(imgDir, { recursive: true });
    for (const img of attached) {
      const abs = imageAbsPath(img.path);
      if (!existsSync(abs)) continue; // a missing file shouldn't block the export
      const name = basename(img.path);
      copyFileSync(abs, resolve(imgDir, name));
      const src = `images/${slug}/${name}`;
      bundled.push({ src, alt: img.alt });
      srcByImageId.set(img.id, src);
    }
  }

  // Inline placement: the body may reference attached images where they belong in the
  // prose — `![alt](image:<imageId>)` (the canonical form the imagery procedure writes)
  // or the console preview URL `![alt](/api/images/<imageId>/file)`. Rewrite both to
  // the bundled relative path so the exported markdown is self-contained; a ref to an
  // image that is no longer attached is left as-is (visible, not silently dropped).
  const rewriteImageRefs = (text: string): string =>
    text
      .replace(/\(image:([\w-]+)\)/g, (m, id: string) =>
        srcByImageId.has(id) ? `(${srcByImageId.get(id)})` : m,
      )
      .replace(/\(\/api\/images\/([\w-]+)\/file\)/g, (m, id: string) =>
        srcByImageId.has(id) ? `(${srcByImageId.get(id)})` : m,
      );

  const frontmatter = [
    '---',
    `title: ${yamlValue(article.title)}`,
    `description: ${yamlValue(article.metaDescription)}`,
    `target_keyword: ${yamlValue(article.targetKeyword)}`,
    `slug: ${slug}`,
    `date: ${isoDate(now)}`,
    ...(bundled.length > 0
      ? [
          'images:',
          ...bundled.flatMap((img) => [`  - src: ${yamlValue(img.src)}`, `    alt: ${yamlValue(img.alt)}`]),
        ]
      : []),
    '---',
  ].join('\n');

  // The body is one markdown document (the editing surface since the queue-workbench
  // restructure). Pre-restructure rows may carry structured sections instead — flatten
  // those the way the old exporter did, so re-exporting an old piece still works.
  const bodyParts: string[] = [`# ${article.title}`];
  if (article.body.trim() !== '') {
    bodyParts.push(rewriteImageRefs(article.body.trim()));
  } else {
    for (const section of article.sections) {
      bodyParts.push(`## ${section.heading}`);
      bodyParts.push(rewriteImageRefs(section.body));
    }
  }

  const contents = `${frontmatter}\n\n${bodyParts.join('\n\n')}\n`;

  const path = resolve(dir, `${slug}.md`);
  writeFileSync(path, contents, 'utf8');

  db.update(articles)
    .set({ exportPath: path, exportedAt: now, stage: 'exported', updatedAt: now })
    .where(eq(articles.id, articleId))
    .run();

  return { ok: true, path };
}
