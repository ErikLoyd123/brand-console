// src/images/compose-scene.ts
// The scene+UI composite (see design 03-scene-ui-composite): FLUX generates a
// photoreal scene, but diffusion models write gibberish text — so we stamp a crisp,
// correct card (a chart / UI / quote authored as HTML/CSS) onto the monitor in the
// scene, warped to the screen's angle. The perspective is done by the browser via a
// CSS matrix3d transform (see perspective.ts) rendered through the same Playwright
// pipeline the composed graphics use (render-html.ts) — no CV dependency.
//
// Corners come from the look-then-place-in-percent discipline annotate.ts uses:
// look at the scene, read the screen's four corners (TL, TR, BR, BL) as percentages
// of the image; percent survives any later scale change.
//
// CLI (mirrors the other producers), via a JSON payload file:
//   npx tsx src/images/compose-scene.ts <payload.json>
//
// Preview (writes the composite, prints {out,width,height}, does not store):
//   { "scenePath": "/tmp/scene.png", "cardHtmlFile": "/tmp/card.html",
//     "corners": [{ "x": 12, "y": 18 }, { "x": 48, "y": 15 },
//                 { "x": 50, "y": 55 }, { "x": 14, "y": 52 }],
//     "out": "/tmp/composite.png" }
//
// Attach (stores against the idea; alt mandatory):
//   { "ideaId": "…", "alt": "…", "scenePath": "…", "cardHtmlFile": "…", "corners": [...] }

import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { renderHtml } from './render-html';
import { matrix3dForQuad, type Point } from './perspective';
import { requireIdea, storeImage } from './store';

export interface ComposeSceneOptions {
  // Absolute path to the generated scene image (PNG/JPG).
  scenePath: string;
  // The crisp card, authored as an HTML/CSS document (preferred) or a pre-rendered
  // image path. One is required.
  cardHtml?: string;
  cardImagePath?: string;
  // CSS-pixel width to render the card HTML at (before it is warped). Default 900.
  cardWidth?: number;
  // The screen's four corners in the scene, as percentages (0-100), order
  // TL, TR, BR, BL.
  corners: Point[];
}

export interface ComposedScene {
  buffer: Buffer; // PNG
  width: number;
  height: number;
}

function dataUri(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

// Render the card, warp it onto the scene's screen quad, and rasterise the result.
export async function composeScene(opts: ComposeSceneOptions): Promise<ComposedScene> {
  if (opts.corners.length !== 4) {
    throw new Error('corners must be four points (TL, TR, BR, BL) in percent');
  }

  const sceneBuf = readFileSync(opts.scenePath);
  const sceneMeta = await sharp(sceneBuf).metadata();
  const W = sceneMeta.width ?? 0;
  const H = sceneMeta.height ?? 0;
  if (W === 0 || H === 0) throw new Error(`could not read scene dimensions from ${opts.scenePath}`);

  // The card: either render the supplied HTML, or read an existing image.
  let cardBuf: Buffer;
  let cardW: number;
  let cardH: number;
  if (opts.cardHtml && opts.cardHtml.trim() !== '') {
    const card = await renderHtml({ html: opts.cardHtml, width: opts.cardWidth ?? 900 });
    cardBuf = card.buffer;
    cardW = card.width;
    cardH = card.height;
  } else if (opts.cardImagePath) {
    cardBuf = readFileSync(opts.cardImagePath);
    const cm = await sharp(cardBuf).metadata();
    cardW = cm.width ?? 0;
    cardH = cm.height ?? 0;
    if (cardW === 0 || cardH === 0) throw new Error('could not read card image dimensions');
  } else {
    throw new Error('composite needs a "cardHtml" or "cardImagePath"');
  }

  // Percent → scene pixels for the destination quad.
  const dst: Point[] = opts.corners.map((c) => ({ x: (c.x / 100) * W, y: (c.y / 100) * H }));
  const transform = matrix3dForQuad(cardW, cardH, dst);

  const composite = `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;}
      .stage{position:relative;width:${W}px;height:${H}px;overflow:hidden;}
      .scene{position:absolute;top:0;left:0;width:${W}px;height:${H}px;display:block;}
      .card{position:absolute;top:0;left:0;width:${cardW}px;height:${cardH}px;
        transform-origin:0 0;transform:${transform};
        box-shadow:0 0 40px rgba(0,0,0,0.35);}
    </style></head><body>
      <div class="stage">
        <img class="scene" src="${dataUri(sceneBuf, 'image/png')}">
        <img class="card" src="${dataUri(cardBuf, 'image/png')}">
      </div>
    </body></html>`;

  // Render at the scene's exact pixel size (deviceScaleFactor 1 — the scene is
  // already full resolution), so the output matches the photo dimensions.
  const shot = await renderHtml({ html: composite, width: W, height: H, deviceScaleFactor: 1 });
  return { buffer: shot.buffer, width: shot.width, height: shot.height };
}

// ---- CLI ----

async function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath) {
    console.error('usage: tsx src/images/compose-scene.ts <payload.json>');
    process.exit(1);
  }
  interface Payload extends Omit<ComposeSceneOptions, 'cardHtml'> {
    cardHtml?: string;
    cardHtmlFile?: string;
    ideaId?: string;
    alt?: string;
    out?: string;
  }
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8')) as Payload;
  const cardHtml = payload.cardHtmlFile
    ? readFileSync(payload.cardHtmlFile, 'utf8')
    : payload.cardHtml;

  const result = await composeScene({
    scenePath: payload.scenePath,
    cardHtml,
    cardImagePath: payload.cardImagePath,
    cardWidth: payload.cardWidth,
    corners: payload.corners,
  });

  const preview = typeof payload.out === 'string' && payload.out !== '';
  if (preview) {
    writeFileSync(payload.out!, result.buffer);
    console.log(JSON.stringify({ out: payload.out, width: result.width, height: result.height }, null, 2));
    return;
  }

  if (!payload.ideaId) throw new Error('payload needs an "ideaId" (or "out" for preview mode)');
  if (!payload.alt || payload.alt.trim() === '') {
    throw new Error('payload needs non-empty "alt" text');
  }
  const idea = requireIdea(payload.ideaId);
  const row = storeImage({
    profileId: idea.profileId,
    ideaId: idea.id,
    source: 'generated',
    buffer: result.buffer,
    ext: 'png',
    alt: payload.alt.trim(),
    width: result.width,
    height: result.height,
    params: { composite: 'scene+ui', corners: payload.corners },
  });
  console.log(JSON.stringify(row, null, 2));
}

main().catch((e) => {
  console.error(`compose-scene: ${(e as Error).message}`);
  process.exit(1);
});
