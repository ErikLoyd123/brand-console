// src/images/annotate.ts
// Bakes annotations into screenshot pixels (sharp SVG composite) — the technique
// from the proven marketing-shots recipe: crisp rounded-rect highlight boxes in the
// brand's ring language (primary stroke + 5% fill), a drawn cursor + click ripple on
// controls being "pressed", straight callout arrows, and privacy blurs for regions
// that must not ship (names, emails, account ids). Annotations live in the image,
// not a DOM overlay, so the asset is portable anywhere the post lands.
//
// Marks take pixel coordinates of the input image, or percentages (0-100) with
// unit: 'percent' — percent marks survive a recapture at a different scale factor.

import sharp, { type OverlayOptions } from 'sharp';

export type MarkKind = 'box' | 'click' | 'blur' | 'arrow';

export interface Mark {
  kind: MarkKind;
  // box / click / blur: the target rectangle. arrow: (x,y) is the tail.
  x: number;
  y: number;
  w?: number;
  h?: number;
  // arrow only: the head (pointing-at) position.
  x2?: number;
  y2?: number;
  unit?: 'px' | 'percent';
  color?: string;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function toPx(mark: Mark, imgW: number, imgH: number): Rect & { x2: number; y2: number } {
  const pct = mark.unit === 'percent';
  const sx = (v: number) => (pct ? (v / 100) * imgW : v);
  const sy = (v: number) => (pct ? (v / 100) * imgH : v);
  return {
    x: Math.round(sx(mark.x)),
    y: Math.round(sy(mark.y)),
    w: Math.round(sx(mark.w ?? 0)),
    h: Math.round(sy(mark.h ?? 0)),
    x2: Math.round(sx(mark.x2 ?? 0)),
    y2: Math.round(sy(mark.y2 ?? 0)),
  };
}

function boxSvg(r: Rect, color: string, stroke: number): string {
  return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10"
    fill="${color}" fill-opacity="0.05" stroke="${color}" stroke-width="${stroke}"/>`;
}

// Cursor + click ripple at the mark's lower-right quadrant — reads as "this
// control was just pressed". Geometry from the proven annotate recipe.
function clickSvg(r: Rect, color: string, scale: number): string {
  const x = r.x + r.w * 0.7;
  const y = r.y + r.h * 0.78;
  return `
    <circle cx="${x}" cy="${y}" r="${30 * scale}" fill="none" stroke="${color}" stroke-width="${5 * scale}" stroke-opacity="0.55"/>
    <circle cx="${x}" cy="${y}" r="${48 * scale}" fill="none" stroke="${color}" stroke-width="${4 * scale}" stroke-opacity="0.28"/>
    <g transform="translate(${x}, ${y}) scale(${2.6 * scale})">
      <path d="M0,0 L0,17.3 L4.4,13.6 L7.1,19.9 L9.9,18.7 L7.2,12.5 L12.6,12 Z"
        fill="#1c2733" stroke="#ffffff" stroke-width="1.4"/>
    </g>`;
}

function arrowSvg(r: Rect & { x2: number; y2: number }, color: string, stroke: number): string {
  const angle = Math.atan2(r.y2 - r.y, r.x2 - r.x);
  const headLen = stroke * 4.5;
  const spread = Math.PI / 7;
  const hx1 = r.x2 - headLen * Math.cos(angle - spread);
  const hy1 = r.y2 - headLen * Math.sin(angle - spread);
  const hx2 = r.x2 - headLen * Math.cos(angle + spread);
  const hy2 = r.y2 - headLen * Math.sin(angle + spread);
  // Shorten the shaft so it doesn't poke through the head.
  const shaftX = r.x2 - headLen * 0.6 * Math.cos(angle);
  const shaftY = r.y2 - headLen * 0.6 * Math.sin(angle);
  return `
    <line x1="${r.x}" y1="${r.y}" x2="${shaftX}" y2="${shaftY}"
      stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>
    <polygon points="${r.x2},${r.y2} ${hx1},${hy1} ${hx2},${hy2}" fill="${color}"/>`;
}

export async function annotateImage(
  input: Buffer,
  marks: Mark[],
  defaultColor: string,
): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const imgW = meta.width ?? 0;
  const imgH = meta.height ?? 0;
  if (imgW === 0 || imgH === 0) throw new Error('annotateImage: could not read image dimensions');

  // Stroke weights scale with resolution so a 2x capture gets 2x-crisp lines.
  const scale = Math.max(1, imgW / 1600);
  const strokeW = Math.round(4 * scale);

  // Blurs first: each blurred region is cut out, blurred, and composited back
  // before the overlay SVG lands on top.
  let base = sharp(input);
  const blurMarks = marks.filter((m) => m.kind === 'blur');
  if (blurMarks.length > 0) {
    const layers: OverlayOptions[] = [];
    for (const mark of blurMarks) {
      const r = toPx(mark, imgW, imgH);
      const region = {
        left: Math.max(0, r.x),
        top: Math.max(0, r.y),
        width: Math.min(r.w, imgW - Math.max(0, r.x)),
        height: Math.min(r.h, imgH - Math.max(0, r.y)),
      };
      if (region.width <= 0 || region.height <= 0) continue;
      const blurred = await sharp(input).extract(region).blur(14 * scale).toBuffer();
      layers.push({ input: blurred, left: region.left, top: region.top });
    }
    base = sharp(await base.composite(layers).png().toBuffer());
  }

  const overlayParts: string[] = [];
  for (const mark of marks) {
    const color = mark.color ?? defaultColor;
    const r = toPx(mark, imgW, imgH);
    if (mark.kind === 'box') overlayParts.push(boxSvg(r, color, strokeW));
    else if (mark.kind === 'click') overlayParts.push(clickSvg(r, color, scale));
    else if (mark.kind === 'arrow') overlayParts.push(arrowSvg(r, color, Math.round(6 * scale)));
  }

  if (overlayParts.length === 0) {
    return base.png().toBuffer();
  }

  const overlay = Buffer.from(
    `<svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">${overlayParts.join('\n')}</svg>`,
  );
  return base.composite([{ input: overlay, left: 0, top: 0 }]).png().toBuffer();
}
