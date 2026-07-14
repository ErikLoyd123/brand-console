// src/server/routes/brand.ts
// The Brand page's API: read and edit the active profile's brand/ folder — the
// visual look the imagery pipeline reads before producing any image. Everything
// here operates on gitignored profiles/<slug>/brand/ files, never the database:
// brand.yaml (colors/fonts/logo/style notes), refs/ (example images), and brand
// documents (.md/.html dropped in brand/). The `brand` skill edits the same
// files from the terminal; this route is the console's hand editor.

import { Router } from 'express';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, resolve } from 'node:path';
import { stringify } from 'yaml';
import { brandDir, loadBrand, type BrandGuidelines } from '../../profile/brand';
import { composeImage } from '../../images/compose';

const router = Router();

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const DOC_EXTS = new Set(['.md', '.html', '.htm']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

// Uploaded names become disk paths inside brand/: strip any directory part and
// refuse anything that isn't a plain filename, so a crafted name can't escape
// the folder.
function safeName(raw: string): string | null {
  const name = basename(raw).trim();
  if (name === '' || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
    return null;
  }
  return name;
}

// GET /api/brand — the full state the page renders: resolved guidelines plus the
// on-disk file lists (names only; bytes come from the file routes below).
router.get('/', (_req, res) => {
  try {
    const dir = brandDir();
    const brand = loadBrand();
    res.json({
      brandDir: dir,
      exists: existsSync(resolve(dir, 'brand.yaml')),
      colors: brand.colors,
      fonts: brand.fonts,
      logo: brand.logoPath ? basename(brand.logoPath) : null,
      styleNotes: brand.styleNotes,
      refs: brand.refPaths.map((p) => basename(p)),
      docs: brand.docPaths.map((p) => basename(p)),
    });
  } catch (e) {
    res.status(409).json({ error: (e as Error).message });
  }
});

// Serialize the current guidelines back to brand.yaml. The console editor owns
// the file's data; hand-written comments are replaced by this generated header
// (the yaml is data, the judgment prose lives in style_notes and the docs).
function writeBrandYaml(brand: Pick<BrandGuidelines, 'colors' | 'fonts' | 'styleNotes'>, logo: string | null) {
  const dir = brandDir();
  mkdirSync(resolve(dir, 'refs'), { recursive: true });
  const data: Record<string, unknown> = {
    colors: brand.colors,
    fonts: brand.fonts,
    ...(logo ? { logo } : {}),
    ...(brand.styleNotes.trim() !== '' ? { style_notes: brand.styleNotes } : {}),
  };
  const header = [
    '# Brand guidelines for this profile — read by the imagery pipeline before it',
    '# produces anything. Edited on the console Brand page or by the `brand` skill;',
    '# see profile.example/brand/brand.yaml for the documented shape. Reference',
    '# images live in refs/; drop .md/.html brand documents beside this file.',
    '',
  ].join('\n');
  writeFileSync(resolve(dir, 'brand.yaml'), header + stringify(data), 'utf8');
}

// PUT /api/brand — save colors / fonts / style notes (logo is managed by its own
// routes; the current value is preserved).
router.put('/', (req, res) => {
  const { colors, fonts, styleNotes } = req.body as {
    colors?: Record<string, string>;
    fonts?: Record<string, string>;
    styleNotes?: string;
  };
  try {
    const current = loadBrand();
    const merged = {
      colors: { ...current.colors, ...(colors ?? {}) },
      fonts: { ...current.fonts, ...(fonts ?? {}) },
      styleNotes: typeof styleNotes === 'string' ? styleNotes : current.styleNotes,
    };
    for (const value of Object.values(merged.colors)) {
      if (!/^#[0-9a-fA-F]{3,8}$/.test(value)) {
        return res.status(400).json({ error: `"${value}" is not a hex color` });
      }
    }
    writeBrandYaml(merged, current.logoPath ? basename(current.logoPath) : null);
    res.json({ ok: true });
  } catch (e) {
    res.status(409).json({ error: (e as Error).message });
  }
});

// GET /api/brand/preview.png — a live test card in the saved look, so edits can
// be judged on a real render. Never stored; regenerated per request.
router.get('/preview.png', async (_req, res) => {
  try {
    const brand = loadBrand();
    const card = await composeImage({
      template: 'headline',
      inputs: {
        kicker: 'Preview',
        title: 'This is your brand look',
        subtitle: 'Colors, fonts, and spacing from brand.yaml',
      },
      brand,
      width: 1200,
      height: 675,
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(card.buffer);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// POST /api/brand/logo — save the logo file into brand/ and point brand.yaml at
// it. Body: { filename, dataBase64 }.
router.post('/logo', (req, res) => {
  const { filename, dataBase64 } = req.body as { filename?: string; dataBase64?: string };
  const name = filename ? safeName(filename) : null;
  if (!name || !IMAGE_EXTS.has(extOf(name))) {
    return res.status(400).json({ error: 'logo needs an image filename (png/jpg/webp/gif/svg)' });
  }
  if (typeof dataBase64 !== 'string' || dataBase64 === '') {
    return res.status(400).json({ error: 'dataBase64 is required' });
  }
  const buffer = Buffer.from(dataBase64, 'base64');
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return res.status(400).json({ error: 'logo is too large; keep it under 10 MB' });
  }
  try {
    const current = loadBrand();
    const dir = brandDir();
    mkdirSync(dir, { recursive: true });
    // A replaced logo's old file is removed so brand/ doesn't collect strays.
    if (current.logoPath && basename(current.logoPath) !== name && existsSync(current.logoPath)) {
      unlinkSync(current.logoPath);
    }
    writeFileSync(resolve(dir, name), buffer);
    writeBrandYaml(current, name);
    res.status(201).json({ ok: true, logo: name });
  } catch (e) {
    res.status(409).json({ error: (e as Error).message });
  }
});

// DELETE /api/brand/logo — remove the file and clear the yaml field.
router.delete('/logo', (_req, res) => {
  try {
    const current = loadBrand();
    if (current.logoPath && existsSync(current.logoPath)) unlinkSync(current.logoPath);
    writeBrandYaml(current, null);
    res.status(204).end();
  } catch (e) {
    res.status(409).json({ error: (e as Error).message });
  }
});

// GET /api/brand/logo/file — the logo bytes for the page's preview.
router.get('/logo/file', (_req, res) => {
  const brand = loadBrand();
  if (!brand.logoPath || !existsSync(brand.logoPath)) {
    return res.status(404).json({ error: 'no logo set' });
  }
  res.setHeader('Content-Type', CONTENT_TYPES[extOf(brand.logoPath).slice(1)] ?? 'application/octet-stream');
  res.sendFile(brand.logoPath);
});

// POST /api/brand/refs — upload a reference image. Body: { filename, dataBase64 }.
router.post('/refs', (req, res) => {
  const { filename, dataBase64 } = req.body as { filename?: string; dataBase64?: string };
  const name = filename ? safeName(filename) : null;
  if (!name || !IMAGE_EXTS.has(extOf(name))) {
    return res.status(400).json({ error: 'refs take image files (png/jpg/webp/gif/svg)' });
  }
  if (typeof dataBase64 !== 'string' || dataBase64 === '') {
    return res.status(400).json({ error: 'dataBase64 is required' });
  }
  const buffer = Buffer.from(dataBase64, 'base64');
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return res.status(400).json({ error: 'image is too large; keep it under 10 MB' });
  }
  try {
    const refsDir = resolve(brandDir(), 'refs');
    mkdirSync(refsDir, { recursive: true });
    writeFileSync(resolve(refsDir, name), buffer);
    res.status(201).json({ ok: true, name });
  } catch (e) {
    res.status(409).json({ error: (e as Error).message });
  }
});

// GET /api/brand/refs/:name — one reference image's bytes.
router.get('/refs/:name', (req, res) => {
  const name = safeName(req.params.name);
  if (!name) return res.status(400).json({ error: 'bad filename' });
  const abs = resolve(brandDir(), 'refs', name);
  if (!existsSync(abs)) return res.status(404).json({ error: 'ref not found' });
  res.setHeader('Content-Type', CONTENT_TYPES[extOf(name).slice(1)] ?? 'application/octet-stream');
  res.sendFile(abs);
});

// DELETE /api/brand/refs/:name
router.delete('/refs/:name', (req, res) => {
  const name = safeName(req.params.name);
  if (!name) return res.status(400).json({ error: 'bad filename' });
  const abs = resolve(brandDir(), 'refs', name);
  if (!existsSync(abs)) return res.status(404).json({ error: 'ref not found' });
  unlinkSync(abs);
  res.status(204).end();
});

// POST /api/brand/docs — save a brand document (.md/.html, plain text). Body:
// { filename, content }.
router.post('/docs', (req, res) => {
  const { filename, content } = req.body as { filename?: string; content?: string };
  const name = filename ? safeName(filename) : null;
  if (!name || !DOC_EXTS.has(extOf(name))) {
    return res.status(400).json({ error: 'brand documents are .md or .html files' });
  }
  if (name.toLowerCase() === 'brand.yaml') {
    return res.status(400).json({ error: 'brand.yaml is edited through the form, not uploaded' });
  }
  if (typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'content is required' });
  }
  try {
    const dir = brandDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, name), content, 'utf8');
    res.status(201).json({ ok: true, name });
  } catch (e) {
    res.status(409).json({ error: (e as Error).message });
  }
});

// GET /api/brand/docs/:name — one document's text (for the page's viewer).
router.get('/docs/:name', (req, res) => {
  const name = safeName(req.params.name);
  if (!name || !DOC_EXTS.has(extOf(name))) return res.status(400).json({ error: 'bad filename' });
  const abs = resolve(brandDir(), name);
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    return res.status(404).json({ error: 'document not found' });
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(readFileSync(abs, 'utf8'));
});

// DELETE /api/brand/docs/:name
router.delete('/docs/:name', (req, res) => {
  const name = safeName(req.params.name);
  if (!name || !DOC_EXTS.has(extOf(name))) return res.status(400).json({ error: 'bad filename' });
  const abs = resolve(brandDir(), name);
  if (!existsSync(abs)) return res.status(404).json({ error: 'document not found' });
  unlinkSync(abs);
  res.status(204).end();
});

export default router;
