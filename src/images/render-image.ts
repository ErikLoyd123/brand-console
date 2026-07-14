// src/images/render-image.ts
// CLI the imagery procedure invokes for a BESPOKE composed graphic — the default
// composed path: author a one-off HTML/CSS document that depicts the piece's idea
// (a diagram, a comparison, a flow) in the profile's brand language, render it at
// 2x, and attach it to a queue idea. Reads a JSON payload file:
//
//   npx tsx src/images/render-image.ts <payload.json>
//
// payload: {
//   "ideaId": "<queue idea id>",
//   "alt": "<alt text — required>",
//   // The markup, one of (htmlFile strongly preferred — no JSON escaping):
//   "htmlFile": "/abs/path/graphic.html",
//   "html": "<div>…</div>",
//   "width"?: 1200,      // CSS px; PNG lands at 2x
//   "height"?: 675,      // omit to auto-fit the content height
//   // preview mode: write the render to this file and print dimensions WITHOUT
//   // storing — the author-look-iterate loop. ideaId/alt not needed.
//   "out"?: "/abs/path/preview.png"
// }
//
// Prints the stored image row as JSON (or {out,width,height} in preview mode).

import { readFileSync, writeFileSync } from 'node:fs';
import { renderHtml } from './render-html';
import { requireIdea, storeImage } from './store';

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error('usage: tsx src/images/render-image.ts <payload.json>');
  process.exit(1);
}

interface Payload {
  ideaId?: string;
  alt?: string;
  html?: string;
  htmlFile?: string;
  width?: number;
  height?: number;
  out?: string;
}

async function main() {
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8')) as Payload;
  const preview = typeof payload.out === 'string' && payload.out !== '';

  const html = payload.htmlFile ? readFileSync(payload.htmlFile, 'utf8') : payload.html;
  if (!html || html.trim() === '') {
    throw new Error('payload needs "htmlFile" (preferred) or "html"');
  }
  if (!preview) {
    if (!payload.ideaId) throw new Error('payload needs an "ideaId" (or "out" for preview mode)');
    if (!payload.alt || payload.alt.trim() === '') {
      throw new Error('payload needs non-empty "alt" text — every image ships with alt text');
    }
  }

  const shot = await renderHtml({ html, width: payload.width, height: payload.height });

  if (preview) {
    writeFileSync(payload.out!, shot.buffer);
    console.log(JSON.stringify({ out: payload.out, width: shot.width, height: shot.height }, null, 2));
    return;
  }

  const idea = requireIdea(payload.ideaId!);
  const row = storeImage({
    profileId: idea.profileId,
    ideaId: idea.id,
    source: 'composed',
    buffer: shot.buffer,
    ext: 'png',
    alt: payload.alt!.trim(),
    width: shot.width,
    height: shot.height,
    params: { method: 'html', width: payload.width ?? 1200, height: payload.height ?? null },
  });

  console.log(JSON.stringify(row, null, 2));
}

main().catch((e) => {
  console.error(`render-image: ${(e as Error).message}`);
  process.exit(1);
});
