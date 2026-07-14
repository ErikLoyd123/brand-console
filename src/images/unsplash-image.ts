// src/images/unsplash-image.ts
// CLI the imagery procedure invokes for the Unsplash source (BYO key:
// UNSPLASH_ACCESS_KEY in .env). Two modes, both via a JSON payload file:
//
//   npx tsx src/images/unsplash-image.ts <payload.json>
//
// Search (no ideaId writes anything — prints candidates as JSON):
//   { "query": "cloud cost dashboard", "page"?: 1, "orientation"?: "landscape" }
//
// Attach (downloads the chosen photo through the required download_location flow
// and stores it against the idea, photographer attribution in params):
//   { "ideaId": "<queue idea id>", "photoId": "<unsplash photo id>", "alt"?: "…" }
//
// alt falls back to the photo's own alt_description when not given.

import { readFileSync } from 'node:fs';
import { downloadUnsplashPhoto, searchUnsplash } from './unsplash';
import { requireIdea, storeImage } from './store';

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error('usage: tsx src/images/unsplash-image.ts <payload.json>');
  process.exit(1);
}

interface Payload {
  query?: string;
  page?: number;
  orientation?: 'landscape' | 'portrait' | 'squarish';
  ideaId?: string;
  photoId?: string;
  alt?: string;
}

async function main() {
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8')) as Payload;

  if (payload.query) {
    const results = await searchUnsplash(payload.query, {
      page: payload.page,
      orientation: payload.orientation,
    });
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (!payload.ideaId || !payload.photoId) {
    throw new Error('payload needs either a "query" (search) or "ideaId" + "photoId" (attach)');
  }

  const idea = requireIdea(payload.ideaId);
  const photo = await downloadUnsplashPhoto(payload.photoId);
  const alt = (payload.alt ?? photo.alt).trim();
  if (alt === '') {
    throw new Error('no alt text: the photo has none — pass "alt" in the payload');
  }

  const row = storeImage({
    profileId: idea.profileId,
    ideaId: idea.id,
    source: 'unsplash',
    buffer: photo.buffer,
    ext: photo.ext,
    alt,
    width: photo.width,
    height: photo.height,
    params: photo.params,
  });

  console.log(JSON.stringify(row, null, 2));
}

main().catch((e) => {
  console.error(`unsplash-image: ${(e as Error).message}`);
  process.exit(1);
});
