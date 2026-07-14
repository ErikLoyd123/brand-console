import { Router } from 'express';
import { runVoiceChecks, type Finding } from '../../review/voice-checks';
import type { Silo } from '../../core/silos';
import { loadIdentity } from '../../profile/loader';

const router = Router();

// POST /api/review — run the mechanical voice checks over caller-supplied draft
// text. Body: { text, isProductAdjacent, silo? }. Returns Finding[] (empty = clean).
// POST so draft prose never lands in a URL. products and protectedRelationships
// are injected from the active profile, not the client (the checker never reads
// the profile itself). When a silo rides along, the module derives adjacency from
// it (only the teach-shaped intents may be adjacent), overriding the flag.
router.post('/', (req, res) => {
  const body = (req.body ?? {}) as { text?: unknown; isProductAdjacent?: unknown; silo?: unknown };
  const text = typeof body.text === 'string' ? body.text : '';
  const isProductAdjacent = body.isProductAdjacent === true;
  const silo = typeof body.silo === 'string' && body.silo.trim() !== '' ? body.silo.trim() : undefined;
  const identity = loadIdentity();
  const findings: Finding[] = runVoiceChecks(text, {
    isProductAdjacent,
    silo: silo as Silo | undefined,
    products: identity.products,
    protectedRelationships: identity.protected_relationships,
  });
  res.json(findings);
});

export default router;
