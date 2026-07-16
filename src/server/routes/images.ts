// src/server/routes/images.ts
// Image attachments for queue ideas. The console lists a card's images, previews
// them (the file route), uploads one by hand, searches Unsplash (key stays
// server-side per the secrets boundary — the browser only ever sees this proxy),
// attaches an Unsplash pick, and deletes. The composed/screenshot producers write
// through the CLIs in src/images/ (invoked by the imagery procedure), not here;
// all of them meet in the same images table + data/images/ files.

import { Router } from 'express';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { images } from '../../db/schema';
import {
  deleteImage,
  getImage,
  imageAbsPath,
  listImagesForIdea,
  previewDirForIdea,
  requireIdea,
  storeImage,
} from '../../images/store';
import { downloadUnsplashPhoto, searchUnsplash, unsplashConfigured } from '../../images/unsplash';
import { generatorConfigured, loadGeneratorConfig } from '../../images/generate';

const router = Router();

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

// GET /api/images?ideaId=… — the images riding with one queue idea.
router.get('/', (req, res) => {
  const ideaId = req.query.ideaId as string | undefined;
  if (!ideaId) return res.status(400).json({ error: 'ideaId query param is required' });
  res.json(listImagesForIdea(ideaId));
});

// GET /api/images/generator-status — whether local image generation is set up.
// Reports the config's whole named-model roster with per-model availability (mflux
// command installed / Draw Things API reachable), plus the flat {backend,
// configured} of the DEFAULT model for existing consumers. No secret is involved —
// generation is local and key-free. Lets the console surface setup state + the
// how-to. Registered before the /:id routes; a single, literal path so it never
// shadows them.
router.get('/generator-status', async (_req, res) => {
  try {
    const config = loadGeneratorConfig();
    const models = await Promise.all(
      Object.entries(config.models).map(async ([name, entry]) => ({
        name,
        backend: entry.backend,
        model: entry.model ?? null,
        available: await generatorConfigured(config, name),
        default: name === config.default,
      })),
    );
    const def = models.find((m) => m.default);
    res.json({
      backend: def?.backend ?? 'mflux',
      configured: def?.available ?? false,
      defaultModel: config.default,
      models,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Candidate previews: transient PNGs the imagery skill writes under
// data/images/previews/<ideaId>/ while it generates, so the card's Images strip can
// show candidates live instead of the session looking stalled. No DB rows — the
// folder IS the state; the skill deletes it after the owner's pick is attached.
// Both path params are validated to one safe filename segment (no separators, no
// dotfiles), so nothing outside the previews tree is ever listed or served.
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// GET /api/images/previews?ideaId=… — the candidates so far, oldest first.
router.get('/previews', (req, res) => {
  const ideaId = req.query.ideaId as string | undefined;
  if (!ideaId || !SAFE_SEGMENT.test(ideaId)) {
    return res.status(400).json({ error: 'a valid ideaId query param is required' });
  }
  const dir = previewDirForIdea(ideaId);
  if (!existsSync(dir)) return res.json([]);
  const rows = readdirSync(dir)
    .filter((name) => SAFE_SEGMENT.test(name) && /\.(png|jpe?g|webp)$/i.test(name))
    .map((name) => ({ name, mtimeMs: statSync(join(dir, name)).mtimeMs }))
    .sort((a, b) => a.mtimeMs - b.mtimeMs);
  res.json(rows);
});

// POST /api/images/previews/attach — promote a candidate into a real attachment:
// { ideaId, name, alt }. Reads the preview file, stores it through the shared
// writer (row + data/images/ file), then removes the preview so the candidate and
// the attachment never show side by side. Lets the owner keep a candidate from the
// strip even after the session that generated it is gone.
router.post('/previews/attach', async (req, res) => {
  const { ideaId, name, alt } = req.body as { ideaId?: string; name?: string; alt?: string };
  if (!ideaId || !SAFE_SEGMENT.test(ideaId) || !name || !SAFE_SEGMENT.test(name)) {
    return res.status(400).json({ error: 'valid ideaId and name are required' });
  }
  if (typeof alt !== 'string' || alt.trim() === '') {
    return res.status(400).json({ error: 'alt text is required — every image ships with alt text' });
  }
  const abs = join(previewDirForIdea(ideaId), name);
  if (!existsSync(abs)) return res.status(404).json({ error: 'preview not found' });
  const extRaw = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  const ext = extRaw === 'jpeg' ? 'jpg' : extRaw;
  if (ext !== 'png' && ext !== 'jpg' && ext !== 'webp') {
    return res.status(400).json({ error: 'preview must be png, jpg, or webp' });
  }
  try {
    const idea = requireIdea(ideaId);
    const buffer = readFileSync(abs);
    const meta = await sharp(buffer).metadata();
    const row = storeImage({
      profileId: idea.profileId,
      ideaId: idea.id,
      source: 'generated',
      buffer,
      ext,
      alt: alt.trim(),
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      params: { attachedFrom: 'session-candidate', file: name },
    });
    try {
      unlinkSync(abs);
    } catch {
      /* candidate already gone — the attachment is what matters */
    }
    res.status(201).json(row);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// DELETE /api/images/previews?ideaId=… — discard ALL of an idea's candidates
// (e.g. leftovers from a session that ended without attaching).
router.delete('/previews', (req, res) => {
  const ideaId = req.query.ideaId as string | undefined;
  if (!ideaId || !SAFE_SEGMENT.test(ideaId)) {
    return res.status(400).json({ error: 'a valid ideaId query param is required' });
  }
  rmSync(previewDirForIdea(ideaId), { recursive: true, force: true });
  res.status(204).end();
});

// DELETE /api/images/previews/:ideaId/:name — discard one candidate.
router.delete('/previews/:ideaId/:name', (req, res) => {
  const { ideaId, name } = req.params;
  if (!SAFE_SEGMENT.test(ideaId) || !SAFE_SEGMENT.test(name)) {
    return res.status(400).json({ error: 'invalid preview path' });
  }
  const abs = join(previewDirForIdea(ideaId), name);
  if (!existsSync(abs)) return res.status(404).json({ error: 'preview not found' });
  unlinkSync(abs);
  res.status(204).end();
});

// GET /api/images/previews/:ideaId/:name — one candidate's bytes.
router.get('/previews/:ideaId/:name', (req, res) => {
  const { ideaId, name } = req.params;
  if (!SAFE_SEGMENT.test(ideaId) || !SAFE_SEGMENT.test(name)) {
    return res.status(400).json({ error: 'invalid preview path' });
  }
  const abs = join(previewDirForIdea(ideaId), name);
  if (!existsSync(abs)) return res.status(404).json({ error: 'preview not found' });
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  res.setHeader('Content-Type', CONTENT_TYPES[ext] ?? 'application/octet-stream');
  // Candidates are regenerated under the same folder; never let the browser cache one.
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(abs);
});

// GET /api/images/:id/file — the bytes, for previews and the publish flow.
router.get('/:id/file', (req, res) => {
  const row = getImage(req.params.id);
  if (!row) return res.status(404).json({ error: 'image not found' });
  const abs = imageAbsPath(row.path);
  if (!existsSync(abs)) return res.status(410).json({ error: 'image file is missing on disk' });
  const ext = row.path.slice(row.path.lastIndexOf('.') + 1).toLowerCase();
  res.setHeader('Content-Type', CONTENT_TYPES[ext] ?? 'application/octet-stream');
  res.sendFile(abs);
});

// POST /api/images/upload — hand-attach an image to an idea.
// Body: { ideaId, dataBase64, mimeType, alt }.
router.post('/upload', async (req, res) => {
  const { ideaId, dataBase64, mimeType, alt } = req.body as {
    ideaId?: string;
    dataBase64?: string;
    mimeType?: string;
    alt?: string;
  };
  if (!ideaId) return res.status(400).json({ error: 'ideaId is required' });
  if (typeof dataBase64 !== 'string' || dataBase64 === '') {
    return res.status(400).json({ error: 'dataBase64 is required' });
  }
  if (typeof alt !== 'string' || alt.trim() === '') {
    return res.status(400).json({ error: 'alt text is required — every image ships with alt text' });
  }
  const ext =
    mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : null;
  if (!ext) return res.status(400).json({ error: 'mimeType must be image/png, image/jpeg, or image/webp' });

  try {
    const idea = requireIdea(ideaId);
    const buffer = Buffer.from(dataBase64, 'base64');
    const meta = await sharp(buffer).metadata();
    const row = storeImage({
      profileId: idea.profileId,
      ideaId: idea.id,
      source: 'upload',
      buffer,
      ext,
      alt: alt.trim(),
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      params: { mimeType },
    });
    res.status(201).json(row);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

// GET /api/images/unsplash/search?query=…&page=…&orientation=… — server-side
// proxy so UNSPLASH_ACCESS_KEY never reaches the browser. 503 when unconfigured
// (the console shows "add UNSPLASH_ACCESS_KEY to .env").
router.get('/unsplash/search', async (req, res) => {
  if (!unsplashConfigured()) {
    return res.status(503).json({ error: 'Unsplash not configured. Add UNSPLASH_ACCESS_KEY to .env.' });
  }
  const query = req.query.query as string | undefined;
  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'query is required' });
  }
  const orientationRaw = req.query.orientation as string | undefined;
  const orientation =
    orientationRaw === 'landscape' || orientationRaw === 'portrait' || orientationRaw === 'squarish'
      ? orientationRaw
      : undefined;
  try {
    const results = await searchUnsplash(query, {
      page: req.query.page ? Number(req.query.page) : undefined,
      orientation,
    });
    res.json(results);
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

// POST /api/images/unsplash/attach — download a chosen photo (through the
// required download_location flow, crediting the photographer) and attach it.
// Body: { ideaId, photoId, alt? } — alt falls back to the photo's own.
router.post('/unsplash/attach', async (req, res) => {
  if (!unsplashConfigured()) {
    return res.status(503).json({ error: 'Unsplash not configured. Add UNSPLASH_ACCESS_KEY to .env.' });
  }
  const { ideaId, photoId, alt } = req.body as { ideaId?: string; photoId?: string; alt?: string };
  if (!ideaId || !photoId) return res.status(400).json({ error: 'ideaId and photoId are required' });
  try {
    const idea = requireIdea(ideaId);
    const photo = await downloadUnsplashPhoto(photoId);
    const resolvedAlt = (alt ?? photo.alt).trim();
    if (resolvedAlt === '') {
      return res.status(400).json({ error: 'the photo has no alt text — provide "alt"' });
    }
    const row = storeImage({
      profileId: idea.profileId,
      ideaId: idea.id,
      source: 'unsplash',
      buffer: photo.buffer,
      ext: photo.ext,
      alt: resolvedAlt,
      width: photo.width,
      height: photo.height,
      params: photo.params,
    });
    res.status(201).json(row);
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

// PATCH /api/images/:id — edit alt text (the one mutable field; everything else
// is provenance).
router.patch('/:id', (req, res) => {
  const { alt } = req.body as { alt?: string };
  if (typeof alt !== 'string' || alt.trim() === '') {
    return res.status(400).json({ error: 'alt text cannot be empty' });
  }
  const updated = db
    .update(images)
    .set({ alt: alt.trim() })
    .where(eq(images.id, req.params.id))
    .returning()
    .all();
  if (updated.length === 0) return res.status(404).json({ error: 'image not found' });
  res.json(updated[0]);
});

// DELETE /api/images/:id — remove row + file together.
router.delete('/:id', (req, res) => {
  const ok = deleteImage(req.params.id);
  if (!ok) return res.status(404).json({ error: 'image not found' });
  res.status(204).end();
});

export default router;
