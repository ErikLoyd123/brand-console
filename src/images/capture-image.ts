// src/images/capture-image.ts
// CLI the imagery procedure invokes to screenshot a live page, optionally annotate
// it (boxes, click ripples, arrows, privacy blurs), and attach the result to a
// queue idea. Reads a JSON payload file:
//
//   npx tsx src/images/capture-image.ts <payload.json>
//
// payload: {
//   "ideaId": "<queue idea id>",
//   "alt": "<alt text — required>",
//   "url": "https://…",
//   // preview mode: write the capture to this file and print its dimensions
//   // WITHOUT storing — the look-then-annotate loop: preview, view the PNG to
//   // measure percent marks, then annotate-image.ts the previewed file.
//   // ideaId/alt are not needed in preview mode.
//   "out"?: "/abs/path/preview.png",
//   // capture options (all optional): viewport {width,height}, deviceScaleFactor,
//   // fullPage, clip {x,y,width,height}, hideSelectors [..], waitForSelector,
//   // waitMs, scrollTo (y px | selector)
//   ...CaptureOptions,
//   // scroll-composite mode: several shots of the same url stitched vertically.
//   // Each stop overrides the base options (typically just scrollTo / clip).
//   "stitchStops"?: [{ "scrollTo": 900 }, ...], "stitchGap"?: 24,
//   // annotations baked into the pixels; use unit "percent" so coords survive
//   // capture-scale changes. kinds: box | click | arrow | blur
//   "marks"?: [{ "kind": "box", "unit": "percent", "x": 10, "y": 20, "w": 30, "h": 8 }]
// }
//
// Annotation stroke color defaults to the profile brand's primary. Prints the
// stored image row as JSON.

import { readFileSync, writeFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { profiles } from '../db/schema';
import { loadBrand } from '../profile/brand';
import { annotateImage, type Mark } from './annotate';
import { captureUrl, stitchVertical, type CaptureOptions } from './capture';
import { requireIdea, storeImage } from './store';

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error('usage: tsx src/images/capture-image.ts <payload.json>');
  process.exit(1);
}

interface Payload extends CaptureOptions {
  ideaId?: string;
  alt?: string;
  marks?: Mark[];
  stitchStops?: Partial<CaptureOptions>[];
  stitchGap?: number;
  out?: string;
}

async function main() {
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8')) as Payload;
  if (!payload.url) throw new Error('payload needs a "url"');
  const preview = typeof payload.out === 'string' && payload.out !== '';
  if (!preview) {
    if (!payload.ideaId) throw new Error('payload needs an "ideaId" (or "out" for preview mode)');
    if (!payload.alt || payload.alt.trim() === '') {
      throw new Error('payload needs non-empty "alt" text — every image ships with alt text');
    }
  }

  const idea = preview ? null : requireIdea(payload.ideaId!);
  const profile = idea
    ? db.select().from(profiles).where(eq(profiles.id, idea.profileId)).get()
    : undefined;
  const brand = loadBrand(profile?.slug);

  const { ideaId, alt, marks, stitchStops, stitchGap, out, ...baseCapture } = payload;

  let shot: { buffer: Buffer; width: number; height: number };
  if (stitchStops && stitchStops.length > 0) {
    const buffers: Buffer[] = [];
    for (const stop of stitchStops) {
      const capture = await captureUrl({ ...baseCapture, ...stop });
      buffers.push(capture.buffer);
    }
    shot = await stitchVertical(buffers, {
      gap: stitchGap ?? 0,
      background: brand.colors.background,
    });
  } else {
    shot = await captureUrl(baseCapture);
  }

  if (preview) {
    writeFileSync(out!, shot.buffer);
    console.log(JSON.stringify({ out, width: shot.width, height: shot.height }, null, 2));
    return;
  }

  let buffer = shot.buffer;
  if (marks && marks.length > 0) {
    buffer = await annotateImage(buffer, marks, brand.colors.primary);
  }

  const row = storeImage({
    profileId: idea!.profileId,
    ideaId: idea!.id,
    source: 'screenshot',
    buffer,
    ext: 'png',
    alt: alt!.trim(),
    width: shot.width,
    height: shot.height,
    params: {
      url: payload.url,
      viewport: payload.viewport ?? { width: 1600, height: 1000 },
      deviceScaleFactor: payload.deviceScaleFactor ?? 2,
      fullPage: payload.fullPage ?? false,
      stitched: (stitchStops?.length ?? 0) > 0,
      marks: marks ?? [],
    },
  });

  console.log(JSON.stringify(row, null, 2));
}

main().catch((e) => {
  console.error(`capture-image: ${(e as Error).message}`);
  process.exit(1);
});
