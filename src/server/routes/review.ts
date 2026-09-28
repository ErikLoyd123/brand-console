import { Router } from 'express';
import { runVoiceChecks, type Finding } from '../../review/voice-checks';
import type { Silo } from '../../core/silos';
import type { PostLength } from '../../core/lengths';
import { loadIdentity } from '../../profile/loader';

const router = Router();

// POST /api/review — run the mechanical voice checks over caller-supplied draft
// text. Body: { text, isProductAdjacent, silo?, seed?, points?, close?, length? }. Returns
// Finding[] (empty = clean). POST so draft prose never lands in a URL. products and
// protectedRelationships are injected from the active profile, not the client (the
// checker never reads the profile itself). When a silo rides along, the module derives
// adjacency from it. seed/points enable seed retention; close enables the aphorism
// check; length enables the band check. See design
// 2026-09-28-strategy-pillars-anti-slop/03-anti-slop-checks.
router.post('/', (req, res) => {
  const body = (req.body ?? {}) as {
    text?: unknown;
    isProductAdjacent?: unknown;
    silo?: unknown;
    seed?: unknown;
    points?: unknown;
    close?: unknown;
    length?: unknown;
  };
  const text = typeof body.text === 'string' ? body.text : '';
  const isProductAdjacent = body.isProductAdjacent === true;
  const silo = typeof body.silo === 'string' && body.silo.trim() !== '' ? body.silo.trim() : undefined;
  const seed = typeof body.seed === 'string' && body.seed.trim() !== '' ? body.seed : undefined;
  const points = Array.isArray(body.points)
    ? body.points.filter((p): p is string => typeof p === 'string')
    : undefined;
  const close = typeof body.close === 'string' && body.close.trim() !== '' ? body.close : undefined;
  const length = typeof body.length === 'string' && body.length.trim() !== '' ? (body.length.trim() as PostLength) : undefined;
  const identity = loadIdentity();
  const findings: Finding[] = runVoiceChecks(text, {
    isProductAdjacent,
    silo: silo as Silo | undefined,
    seed,
    points,
    close,
    length,
    products: identity.products,
    protectedRelationships: identity.protected_relationships,
  });
  res.json(findings);
});

export default router;
