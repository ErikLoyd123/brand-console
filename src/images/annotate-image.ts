// src/images/annotate-image.ts
// CLI the imagery procedure invokes to annotate an already-captured PNG (usually a
// capture-image.ts preview — the look-then-annotate loop: preview the shot, view
// the file to measure percent marks, then bake them here) and attach the result
// to a queue idea. Reads a JSON payload file:
//
//   npx tsx src/images/annotate-image.ts <payload.json>
//
// payload: {
//   "ideaId": "<queue idea id>",
//   "file": "/abs/path/preview.png",
//   "alt": "<alt text — required>",
//   "marks": [{ "kind": "box"|"click"|"arrow"|"blur", "unit": "percent", ... }],
//   // provenance recorded on the row (what page the preview came from):
//   "url"?: "https://…"
// }
//
// Stroke color defaults to the profile brand's primary. Prints the stored image
// row as JSON.

import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { db } from '../db/client';
import { profiles } from '../db/schema';
import { loadBrand } from '../profile/brand';
import { annotateImage, type Mark } from './annotate';
import { requireIdea, storeImage } from './store';

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error('usage: tsx src/images/annotate-image.ts <payload.json>');
  process.exit(1);
}

interface Payload {
  ideaId?: string;
  file?: string;
  alt?: string;
  marks?: Mark[];
  url?: string;
}

async function main() {
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8')) as Payload;
  if (!payload.ideaId) throw new Error('payload needs an "ideaId"');
  if (!payload.file) throw new Error('payload needs a "file" (the captured PNG to annotate)');
  if (!payload.alt || payload.alt.trim() === '') {
    throw new Error('payload needs non-empty "alt" text — every image ships with alt text');
  }

  const idea = requireIdea(payload.ideaId);
  const profile = db.select().from(profiles).where(eq(profiles.id, idea.profileId)).get();
  const brand = loadBrand(profile?.slug);

  const input = readFileSync(payload.file);
  const marks = payload.marks ?? [];
  const buffer = marks.length > 0 ? await annotateImage(input, marks, brand.colors.primary) : input;
  const meta = await sharp(buffer).metadata();

  const row = storeImage({
    profileId: idea.profileId,
    ideaId: idea.id,
    source: 'screenshot',
    buffer,
    ext: 'png',
    alt: payload.alt.trim(),
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    params: { url: payload.url ?? null, marks, annotatedFrom: payload.file },
  });

  console.log(JSON.stringify(row, null, 2));
}

main().catch((e) => {
  console.error(`annotate-image: ${(e as Error).message}`);
  process.exit(1);
});
