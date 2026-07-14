import { Router } from 'express';
import { runVoiceChecks, type Finding } from '../../review/voice-checks';
import { loadIdentity } from '../../profile/loader';

const router = Router();

// POST /api/review — run the mechanical voice checks over caller-supplied draft
// text. Body: { text, isProductAdjacent }. Returns Finding[] (empty = clean).
// POST so draft prose never lands in a URL. products and protectedRelationships
// are injected from the active profile, not the client (the checker never reads
// the profile itself).
router.post('/', (req, res) => {
  const body = (req.body ?? {}) as { text?: unknown; isProductAdjacent?: unknown };
  const text = typeof body.text === 'string' ? body.text : '';
  const isProductAdjacent = body.isProductAdjacent === true;
  const identity = loadIdentity();
  const findings: Finding[] = runVoiceChecks(text, {
    isProductAdjacent,
    products: identity.products,
    protectedRelationships: identity.protected_relationships,
  });
  res.json(findings);
});

export default router;
