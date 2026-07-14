// src/core/update-article.ts
// The single writer behind both the section-draft/revise CLI (src/articles/update-article.ts)
// and PATCH /api/articles/:id, so console edits and skill edits cannot drift — the drafts-path
// analog. Field patches overwrite; `sections` replaces the whole ordered array (the outline
// stage); `sectionPatches` merges heading/intent/body into the sections that already carry the
// given id (the draft/revise stages). Any content write bumps updatedAt and resets reviewStatus
// to 'pending' — a rewritten article is no longer covered by a prior review — unless the payload
// sets reviewStatus explicitly (the reviewer's verdict / the owner's console edit), which wins.
// See design 2026-07-13-multi-profile-longform-lane/04-articles-artifact-and-pipeline.

import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { articles } from '../db/schema';

export interface SectionPatch {
  id: string;
  heading?: string;
  intent?: string;
  body?: string;
}

export interface UpdateArticleFields {
  title?: string;
  slug?: string;
  targetKeyword?: string;
  searchIntent?: string;
  metaDescription?: string;
  lengthTarget?: number;
  stage?: string;
  reviewStatus?: string;
  /** Full replacement of the ordered sections — the outline stage writes the whole array. */
  sections?: import('../db/schema').ArticleSection[];
  /** Patch individual sections by id — the draft/revise stages fill or rewrite one section. */
  sectionPatches?: SectionPatch[];
}

export function updateArticle(id: string, fields: UpdateArticleFields): void {
  const existing = db.select().from(articles).where(eq(articles.id, id)).get();
  if (!existing) throw new Error(`update-article: no article with id ${id}`);

  const set: Partial<typeof articles.$inferInsert> = {};
  if (fields.title !== undefined) set.title = fields.title;
  if (fields.slug !== undefined) set.slug = fields.slug;
  if (fields.targetKeyword !== undefined) set.targetKeyword = fields.targetKeyword;
  if (fields.searchIntent !== undefined) set.searchIntent = fields.searchIntent;
  if (fields.metaDescription !== undefined) set.metaDescription = fields.metaDescription;
  if (fields.lengthTarget !== undefined) set.lengthTarget = fields.lengthTarget;
  if (fields.stage !== undefined) set.stage = fields.stage;

  if (fields.sections !== undefined) {
    set.sections = fields.sections;
  } else if (fields.sectionPatches && fields.sectionPatches.length > 0) {
    const byId = new Map(fields.sectionPatches.map((p) => [p.id, p]));
    set.sections = existing.sections.map((s) => {
      const p = byId.get(s.id);
      if (!p) return s;
      return {
        id: s.id,
        heading: p.heading !== undefined ? p.heading : s.heading,
        intent: p.intent !== undefined ? p.intent : s.intent,
        body: p.body !== undefined ? p.body : s.body,
      };
    });
  }

  // Nothing to write (no field patches, no explicit reviewStatus) is a no-op.
  if (Object.keys(set).length === 0 && fields.reviewStatus === undefined) return;

  // A content write (title, metaDescription, or any section change) invalidates a prior review,
  // unless the caller states a verdict explicitly (reviewer/console), which wins.
  const wroteContent =
    fields.title !== undefined ||
    fields.metaDescription !== undefined ||
    fields.sections !== undefined ||
    (fields.sectionPatches !== undefined && fields.sectionPatches.length > 0);
  if (fields.reviewStatus !== undefined) {
    set.reviewStatus = fields.reviewStatus;
  } else if (wroteContent) {
    set.reviewStatus = 'pending';
  }

  set.updatedAt = Date.now();
  db.update(articles).set(set).where(eq(articles.id, id)).run();
}
