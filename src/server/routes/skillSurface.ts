import { Router } from 'express';
import { probeClaudeAvailable } from '../skill-engine';

// GET /api/skill-surface/health -> { available }. A cheap, non-spawning capability
// probe the console polls to decide whether to default a skill surface to AI mode.
// It reports whether a session *could* start (Claude auth present), never whether
// one is running. Design: 02-headless-engine.md "Liveness capability check".
const router = Router();

router.get('/health', (_req, res) => {
  res.json({ available: probeClaudeAvailable() });
});

export default router;
