// src/images/store.ts
// The single writer for image attachments, mirroring the shared-writer pattern the
// article pipeline uses: every producer (compose, capture, unsplash, upload route)
// stores through here so the file on disk and the images row never drift. Files land
// under gitignored data/images/<profileId>/<imageId>.<ext>; the row carries the
// data/images/-relative path plus the provenance the console surfaces.

import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client';
import { ideaQueueItems, images } from '../db/schema';
import { REPO_ROOT } from '../profile/loader';

export const IMAGES_ROOT = resolve(REPO_ROOT, 'data', 'images');

export type ImageSource = 'composed' | 'screenshot' | 'unsplash' | 'upload';

export type ImageRow = typeof images.$inferSelect;

export interface StoreImageInput {
  profileId: string;
  ideaId: string;
  source: ImageSource;
  buffer: Buffer;
  // Container format of `buffer`. png for composed/screenshot intermediates
  // (lossless, single-compression rule); jpg/webp for photos as fetched.
  ext: 'png' | 'jpg' | 'webp';
  alt: string;
  width: number;
  height: number;
  params?: Record<string, unknown>;
}

export function imageAbsPath(relPath: string): string {
  return resolve(IMAGES_ROOT, relPath);
}

// Every producer attaches to an idea; the idea's own profileId is the image's
// profileId (never trusted from the payload), so an image can't land under the
// wrong profile's folder.
export function requireIdea(ideaId: string): typeof ideaQueueItems.$inferSelect {
  const idea = db.select().from(ideaQueueItems).where(eq(ideaQueueItems.id, ideaId)).get();
  if (!idea) throw new Error(`no queue idea with id "${ideaId}"`);
  return idea;
}

export function storeImage(input: StoreImageInput): ImageRow {
  const id = nanoid();
  const rel = join(input.profileId, `${id}.${input.ext}`);
  const abs = imageAbsPath(rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, input.buffer);

  try {
    const inserted = db
      .insert(images)
      .values({
        id,
        profileId: input.profileId,
        ideaId: input.ideaId,
        source: input.source,
        path: rel,
        alt: input.alt,
        width: input.width,
        height: input.height,
        params: input.params ?? {},
      })
      .returning()
      .all();
    return inserted[0];
  } catch (e) {
    // Keep disk and DB in step: a failed insert (bad ideaId, FK violation)
    // must not leave an orphan file behind.
    try {
      unlinkSync(abs);
    } catch {
      /* file may not exist */
    }
    throw new Error(
      `could not record image (is the idea id valid?): ${(e as Error).message}`,
    );
  }
}

export function listImagesForIdea(ideaId: string): ImageRow[] {
  return db.select().from(images).where(eq(images.ideaId, ideaId)).all();
}

export function getImage(id: string): ImageRow | undefined {
  return db.select().from(images).where(eq(images.id, id)).get();
}

// Delete row + file together. Missing file is tolerated (the row is still the
// thing being removed); a missing row is the caller's 404.
export function deleteImage(id: string): boolean {
  const row = getImage(id);
  if (!row) return false;
  db.delete(images).where(eq(images.id, id)).run();
  const abs = imageAbsPath(row.path);
  if (existsSync(abs)) {
    try {
      unlinkSync(abs);
    } catch {
      /* already gone or locked; the row is what matters */
    }
  }
  return true;
}
