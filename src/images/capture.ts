// src/images/capture.ts
// Playwright screenshot capture, ported from the proven marketing-shots recipe:
// Chromium headless at deviceScaleFactor 2 (retina-crisp pixels), a parked mouse so
// no hover tooltips leak in, optional element hiding (strip dev badges / banners),
// and PNG output — the lossless intermediate annotations bake into before the one
// and only compression pass. Also provides the vertical stitcher behind
// scroll-composite shots (several viewport captures joined into one tall image).

import sharp from 'sharp';
import { chromium } from 'playwright';

export interface CaptureOptions {
  url: string;
  // CSS-pixel viewport; the PNG comes out at 2x this (deviceScaleFactor).
  viewport?: { width: number; height: number };
  deviceScaleFactor?: number;
  // Capture the whole scrollable page instead of one viewport.
  fullPage?: boolean;
  // Crop (CSS px, pre-scale) — e.g. isolate one panel.
  clip?: { x: number; y: number; width: number; height: number };
  // Selectors to hide (visibility loss, layout kept) before shooting.
  hideSelectors?: string[];
  // Selector to wait for before shooting (beyond load + network idle).
  waitForSelector?: string;
  // Extra settle time in ms (animations, fonts, charts).
  waitMs?: number;
  // Scroll target before shooting: a y offset in px, or a selector to bring into view.
  scrollTo?: number | string;
}

export interface CapturedImage {
  buffer: Buffer; // PNG
  width: number; // real pixels (viewport x deviceScaleFactor)
  height: number;
}

export async function captureUrl(opts: CaptureOptions): Promise<CapturedImage> {
  const viewport = opts.viewport ?? { width: 1600, height: 1000 };
  const deviceScaleFactor = opts.deviceScaleFactor ?? 2;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport, deviceScaleFactor });
    await page.goto(opts.url, { waitUntil: 'networkidle', timeout: 45_000 });

    if (opts.waitForSelector) {
      await page.waitForSelector(opts.waitForSelector, { timeout: 20_000 });
    }
    if (opts.hideSelectors && opts.hideSelectors.length > 0) {
      const css = opts.hideSelectors.map((s) => `${s} { visibility: hidden !important; }`).join('\n');
      await page.addStyleTag({ content: css });
    }
    if (typeof opts.scrollTo === 'number') {
      await page.evaluate((y) => window.scrollTo(0, y), opts.scrollTo);
    } else if (typeof opts.scrollTo === 'string') {
      await page.locator(opts.scrollTo).first().scrollIntoViewIfNeeded();
    }
    // Park the mouse so nothing renders a hover state into the shot.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(opts.waitMs ?? 400);

    const buffer = await page.screenshot({
      type: 'png',
      fullPage: opts.fullPage ?? false,
      ...(opts.clip ? { clip: opts.clip } : {}),
    });

    const meta = await sharp(buffer).metadata();
    return { buffer, width: meta.width ?? 0, height: meta.height ?? 0 };
  } finally {
    await browser.close();
  }
}

// Join several captures vertically into one tall composite (the scroll-story
// technique: shoot a page at a few scroll positions, stack the moments). All
// slices are normalized to the narrowest width — downscale only, never up.
export async function stitchVertical(
  buffers: Buffer[],
  options?: { gap?: number; background?: string },
): Promise<CapturedImage> {
  if (buffers.length === 0) throw new Error('stitchVertical needs at least one image');
  const gap = options?.gap ?? 0;
  const background = options?.background ?? '#ffffff';

  const metas = await Promise.all(buffers.map((b) => sharp(b).metadata()));
  const width = Math.min(...metas.map((m) => m.width ?? 0));
  if (width <= 0) throw new Error('stitchVertical: could not read slice dimensions');

  const slices: { input: Buffer; height: number }[] = [];
  for (let i = 0; i < buffers.length; i++) {
    const m = metas[i];
    if ((m.width ?? 0) === width) {
      slices.push({ input: buffers[i], height: m.height ?? 0 });
    } else {
      const resized = await sharp(buffers[i]).resize({ width }).png().toBuffer();
      const rMeta = await sharp(resized).metadata();
      slices.push({ input: resized, height: rMeta.height ?? 0 });
    }
  }

  const totalHeight = slices.reduce((sum, s) => sum + s.height, 0) + gap * (slices.length - 1);
  let top = 0;
  const composites = slices.map((s) => {
    const layer = { input: s.input, left: 0, top };
    top += s.height + gap;
    return layer;
  });

  const buffer = await sharp({
    create: { width, height: totalHeight, channels: 4, background },
  })
    .composite(composites)
    .png()
    .toBuffer();

  return { buffer, width, height: totalHeight };
}
