// src/core/create-article.ts
// The single source of truth for side-writing a long-form articles row when spark/discovery
// resolve platform = web. Called by the intake CLI (src/articles/create-article.ts) and any
// API path, so the manual and AI creation paths cannot drift — mirrors promote.ts. Idempotent
// per ideaId: an idea that already grew an article is never re-created. The row is stamped with
// the active profile id; title/targetKeyword/searchIntent are the captured-at-intake SEO inputs
// (slug, sections, metaDescription are filled by later stages). See design
// 2026-07-13-multi-profile-longform-lane/04-articles-artifact-and-pipeline.

import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { articles, ideaQueueItems } from '../db/schema';
import { getActiveProfileId } from '../profile/loader';

export interface CreateArticleInput {
  /** Working title, from the chosen angle. Becomes the export H1 and frontmatter title. */
  title?: string;
  /** The one keyword the piece targets. Captured at intake. */
  targetKeyword?: string;
  /** The searcher's intent in the user's own words. Captured at intake. */
  searchIntent?: string;
}

export type CreateArticleResult =
  | { ok: true; articleId: string }
  | { ok: false; error: 'idea-not-found' }
  | { ok: false; error: 'already-exists'; articleId: string };

export function createArticle(
  ideaId: string,
  input: CreateArticleInput = {},
): CreateArticleResult {
  const idea = db.select().from(ideaQueueItems).where(eq(ideaQueueItems.id, ideaId)).get();
  if (!idea) return { ok: false, error: 'idea-not-found' };

  // Idempotent: an idea grows exactly one article (ideaId is a globally unique nanoid).
  const existing = db.select().from(articles).where(eq(articles.ideaId, ideaId)).get();
  if (existing) return { ok: false, error: 'already-exists', articleId: existing.id };

  const inserted = db
    .insert(articles)
    .values({
      profileId: getActiveProfileId(),
      ideaId,
      title: (input.title ?? '').trim(),
      targetKeyword: (input.targetKeyword ?? '').trim(),
      searchIntent: (input.searchIntent ?? '').trim(),
      stage: 'outlining',
      reviewStatus: 'pending',
    })
    .returning()
    .all();

  return { ok: true, articleId: inserted[0].id };
}
