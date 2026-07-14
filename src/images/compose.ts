// src/images/compose.ts
// The "create it ourselves" imagery source: brand-styled graphics composed from
// SVG and rendered by sharp — deterministic, brand-exact, no external API. Three
// templates cover the shapes short-form content actually uses:
//
//   quote    — a pull-quote card (quote text + attribution)
//   stat     — a big-number card (value + label + optional context line)
//   headline — a title card (kicker + title + optional subtitle)
//
// Colors and fonts come from the profile's brand guidelines (src/profile/brand.ts);
// the optional logo is composited bottom-right. Output is a lossless PNG at the
// requested pixel size (default 1600x900) — single compression, never upscaled.

import sharp from 'sharp';
import type { BrandGuidelines } from '../profile/brand';

export type ComposeTemplate = 'quote' | 'stat' | 'headline';

export interface ComposeInputs {
  // quote: text + attribution; stat: value + label + context; headline: kicker + title + subtitle.
  text?: string;
  attribution?: string;
  value?: string;
  label?: string;
  context?: string;
  kicker?: string;
  title?: string;
  subtitle?: string;
}

export interface ComposeOptions {
  template: ComposeTemplate;
  inputs: ComposeInputs;
  brand: BrandGuidelines;
  width?: number;
  height?: number;
}

export interface ComposedImage {
  buffer: Buffer;
  width: number;
  height: number;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Greedy word wrap against an estimated glyph width (0.52em is a good average for
// the sans stacks the defaults use). SVG has no native text wrapping, so lines are
// laid out as explicit <text> elements.
function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (candidate.length > maxChars && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

// Pick the largest font size (descending through `sizes`) whose wrapped line count
// fits maxLines; falls back to the smallest size with a hard line cap.
function fitText(
  text: string,
  boxWidth: number,
  maxLines: number,
  sizes: number[],
): { size: number; lines: string[] } {
  for (const size of sizes) {
    const maxChars = Math.floor(boxWidth / (size * 0.52));
    const lines = wrapText(text, maxChars);
    if (lines.length <= maxLines) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  const maxChars = Math.floor(boxWidth / (size * 0.52));
  return { size, lines: wrapText(text, maxChars).slice(0, maxLines) };
}

function textLines(
  lines: string[],
  x: number,
  startY: number,
  size: number,
  fill: string,
  fontFamily: string,
  weight = 400,
  lineHeight = 1.25,
): { svg: string; endY: number } {
  const parts: string[] = [];
  let y = startY;
  for (const line of lines) {
    parts.push(
      `<text x="${x}" y="${y}" font-family="${escapeXml(fontFamily)}" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`,
    );
    y += size * lineHeight;
  }
  return { svg: parts.join('\n'), endY: y };
}

function quoteSvg(w: number, h: number, inputs: ComposeInputs, brand: BrandGuidelines): string {
  const pad = Math.round(w * 0.09);
  const boxW = w - pad * 2;
  const quote = inputs.text ?? '';
  const fitted = fitText(quote, boxW, 5, [72, 64, 56, 48, 40, 34]);
  const blockH = fitted.lines.length * fitted.size * 1.25;
  const startY = Math.round(h / 2 - blockH / 2 + fitted.size * 0.8);
  const body = textLines(
    fitted.lines, pad, startY, fitted.size, brand.colors.foreground, brand.fonts.heading, 600, 1.25,
  );
  const attribution = inputs.attribution
    ? `<text x="${pad}" y="${body.endY + 28}" font-family="${escapeXml(brand.fonts.body)}" font-size="30" fill="${brand.colors.muted}">${escapeXml(`— ${inputs.attribution}`)}</text>`
    : '';
  return `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${brand.colors.background}"/>
    <rect x="0" y="0" width="14" height="${h}" fill="${brand.colors.primary}"/>
    <text x="${pad - 10}" y="${startY - fitted.size * 1.1}" font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(fitted.size * 2.2)}" fill="${brand.colors.primary}" fill-opacity="0.28">&#8220;</text>
    ${body.svg}
    ${attribution}
  </svg>`;
}

function statSvg(w: number, h: number, inputs: ComposeInputs, brand: BrandGuidelines): string {
  const pad = Math.round(w * 0.09);
  const boxW = w - pad * 2;
  const value = inputs.value ?? '';
  const valueFit = fitText(value, boxW, 1, [200, 170, 140, 110, 90]);
  const label = inputs.label ?? '';
  const labelFit = fitText(label, boxW, 2, [52, 44, 38, 32]);
  const valueY = Math.round(h * 0.46);
  const labelBlock = textLines(
    labelFit.lines, pad, valueY + 76, labelFit.size, brand.colors.foreground, brand.fonts.heading, 600,
  );
  const context = inputs.context
    ? `<text x="${pad}" y="${labelBlock.endY + 18}" font-family="${escapeXml(brand.fonts.body)}" font-size="30" fill="${brand.colors.muted}">${escapeXml(inputs.context)}</text>`
    : '';
  return `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${brand.colors.background}"/>
    <rect x="${pad}" y="${Math.round(h * 0.18)}" width="120" height="10" rx="5" fill="${brand.colors.accent}"/>
    <text x="${pad}" y="${valueY}" font-family="${escapeXml(brand.fonts.heading)}" font-size="${valueFit.size}" font-weight="800" fill="${brand.colors.primary}">${escapeXml(valueFit.lines[0] ?? '')}</text>
    ${labelBlock.svg}
    ${context}
  </svg>`;
}

function headlineSvg(w: number, h: number, inputs: ComposeInputs, brand: BrandGuidelines): string {
  const pad = Math.round(w * 0.09);
  const boxW = w - pad * 2;
  // Top-down stack: accent bar, kicker (optional), title, subtitle (optional).
  const barY = Math.round(h * 0.17);
  const kickerY = barY + 72;
  const kicker = inputs.kicker
    ? `<text x="${pad}" y="${kickerY}" font-family="${escapeXml(brand.fonts.body)}" font-size="30" font-weight="700" letter-spacing="4" fill="${brand.colors.primary}">${escapeXml(inputs.kicker.toUpperCase())}</text>`
    : '';
  const title = inputs.title ?? '';
  const titleFit = fitText(title, boxW, 4, [88, 76, 64, 54, 46]);
  const titleStartY = (inputs.kicker ? kickerY : barY) + Math.round(titleFit.size * 1.3);
  const titleBlock = textLines(
    titleFit.lines, pad, titleStartY, titleFit.size,
    brand.colors.foreground, brand.fonts.heading, 700, 1.18,
  );
  const subtitle = inputs.subtitle
    ? `<text x="${pad}" y="${titleBlock.endY + 24}" font-family="${escapeXml(brand.fonts.body)}" font-size="34" fill="${brand.colors.muted}">${escapeXml(inputs.subtitle)}</text>`
    : '';
  return `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="${brand.colors.background}"/>
    <rect x="${pad}" y="${barY}" width="120" height="10" rx="5" fill="${brand.colors.accent}"/>
    ${kicker}
    ${titleBlock.svg}
    ${subtitle}
  </svg>`;
}

export async function composeImage(opts: ComposeOptions): Promise<ComposedImage> {
  const width = opts.width ?? 1600;
  const height = opts.height ?? 900;
  const { template, inputs, brand } = opts;

  let svg: string;
  if (template === 'quote') svg = quoteSvg(width, height, inputs, brand);
  else if (template === 'stat') svg = statSvg(width, height, inputs, brand);
  else svg = headlineSvg(width, height, inputs, brand);

  let image = sharp(Buffer.from(svg));

  if (brand.logoPath) {
    const logoH = Math.round(height * 0.055);
    const logo = await sharp(brand.logoPath).resize({ height: logoH }).png().toBuffer();
    const meta = await sharp(logo).metadata();
    image = sharp(await image.png().toBuffer()).composite([
      {
        input: logo,
        left: width - (meta.width ?? logoH) - Math.round(width * 0.045),
        top: height - logoH - Math.round(height * 0.07),
      },
    ]);
  }

  const buffer = await image.png().toBuffer();
  return { buffer, width, height };
}
