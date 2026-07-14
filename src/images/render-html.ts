// src/images/render-html.ts
// The bespoke-graphic renderer: takes a one-off HTML/CSS document authored for a
// specific piece (a diagram, a comparison, a flow — whatever actually depicts the
// idea) and rasterizes it with headless Chromium at deviceScaleFactor 2. HTML/CSS
// is the authoring surface because it typesets properly — real text wrapping,
// flex/grid layout, shadows — which fixed SVG templates never could. Fonts are the
// machine's installed fonts, same as the capture pipeline.

import sharp from 'sharp';
import { chromium } from 'playwright';

export interface RenderHtmlOptions {
  // A full HTML document or a body fragment (fragments get wrapped with a
  // zero-margin shell). Everything must be inline — no network fetches beyond
  // what Chromium resolves itself.
  html: string;
  // CSS-pixel canvas width; the PNG comes out at 2x this. Default 1200.
  width?: number;
  // Fixed CSS-pixel height. Omit to auto-fit the rendered content's height.
  height?: number;
  deviceScaleFactor?: number;
  // Extra settle time (fonts, anything animated) before the shot.
  waitMs?: number;
}

export interface RenderedImage {
  buffer: Buffer; // PNG
  width: number; // real pixels (css x deviceScaleFactor)
  height: number;
}

function wrapFragment(html: string): string {
  if (/<html[\s>]/i.test(html)) return html;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; padding: 0; }
    * { box-sizing: border-box; }
  </style></head><body>${html}</body></html>`;
}

export async function renderHtml(opts: RenderHtmlOptions): Promise<RenderedImage> {
  const width = opts.width ?? 1200;
  const deviceScaleFactor = opts.deviceScaleFactor ?? 2;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width, height: opts.height ?? 800 },
      deviceScaleFactor,
    });
    await page.setContent(wrapFragment(opts.html), { waitUntil: 'networkidle' });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(opts.waitMs ?? 250);

    // Auto-height: fit the viewport to the actual content so the shot carries no
    // dead band at the bottom (the #12 failure mode: a card of mostly empty space).
    if (!opts.height) {
      const contentHeight = await page.evaluate(
        () => Math.ceil(document.documentElement.getBoundingClientRect().height),
      );
      await page.setViewportSize({ width, height: Math.max(contentHeight, 100) });
      await page.waitForTimeout(100);
    }

    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    const meta = await sharp(buffer).metadata();
    return { buffer, width: meta.width ?? 0, height: meta.height ?? 0 };
  } finally {
    await browser.close();
  }
}
