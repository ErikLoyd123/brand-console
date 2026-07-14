import { Router } from 'express';
import { readVoiceCard, tryLoadIdentity, tryReadVoiceCard, writeVoiceCard } from '../../profile/loader';
import { getPlatforms, getRegister } from '../../core/registers';
import { writePillars, writePlatforms, ValidationError } from '../../profile/write-identity';

// Config routes: read and write the editable sections of the profile's identity.yaml (pillars,
// register selection). Writes go through the comment-preserving writer in
// src/profile/write-identity.ts. The register *menu* is read-only committed structure
// (src/core/registers.ts); only the *selection* is editable, per the structural/nuance
// split. identity.yaml holds no secrets, so exposing it over the local API respects the
// server-only-secrets boundary.
const router = Router();

// GET /api/config/pillars — full pillar records (key, label, weight) for editing.
// Empty for a skeleton profile awaiting setup (no identity.yaml yet).
router.get('/pillars', (_req, res) => {
  res.json({ pillars: tryLoadIdentity()?.pillars ?? [] });
});

// PUT /api/config/pillars — replace the pillar list. Body: { pillars: [{key,label,weight}] }.
router.put('/pillars', (req, res) => {
  try {
    const pillars = writePillars(req.body?.pillars);
    res.json({ pillars });
  } catch (e) {
    if (e instanceof ValidationError) {
      res.status(400).json({ error: e.message });
    } else {
      console.error('PUT /api/config/pillars failed:', e);
      res.status(500).json({ error: 'Failed to write pillars.' });
    }
  }
});

// GET /api/config/register — the shipped menu (read-only) plus the user's selection.
router.get('/register', (_req, res) => {
  const menu = getPlatforms().map((key) => {
    const r = getRegister(key)!;
    return { key: r.key, label: r.label, format: r.format, tones: r.tones, themes: r.themes };
  });
  res.json({ menu, selection: tryLoadIdentity()?.platforms ?? [] });
});

// PUT /api/config/register — replace the platforms selection. Body: { platforms: [...] }.
router.put('/register', (req, res) => {
  try {
    const platforms = writePlatforms(req.body?.platforms);
    res.json({ platforms });
  } catch (e) {
    if (e instanceof ValidationError) {
      res.status(400).json({ error: e.message });
    } else {
      console.error('PUT /api/config/register failed:', e);
      res.status(500).json({ error: 'Failed to write register selection.' });
    }
  }
});

// GET /api/config/voice-card — the raw voice-card.md markdown for the console's
// manual editor. (The Voice page also gets the card via /api/profile; this dedicated
// read lets the editor pull the freshest source after an AI edit without the rest of
// the profile payload.) The voice card holds no secrets — it's distilled voice prose.
router.get('/voice-card', (_req, res) => {
  res.json({ voiceCard: tryReadVoiceCard() });
});

// PUT /api/config/voice-card — overwrite voice-card.md. Body: { voiceCard: "<md>" }.
// Mirrors the pillars/register writers: an empty card is rejected (400) since an empty
// card reads as "missing" to completeness and would break every drafter/reviewer.
router.put('/voice-card', (req, res) => {
  try {
    const md = req.body?.voiceCard;
    writeVoiceCard(md);
    res.json({ voiceCard: readVoiceCard() });
  } catch (e) {
    // writeVoiceCard throws a plain Error on empty/invalid input — treat as a 400 the
    // console can surface, mirroring how ValidationError is handled above.
    const message = (e as Error).message;
    if (message === 'Voice card cannot be empty.') {
      res.status(400).json({ error: message });
    } else {
      console.error('PUT /api/config/voice-card failed:', e);
      res.status(500).json({ error: 'Failed to write voice card.' });
    }
  }
});

export default router;
