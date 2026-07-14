import { Router } from 'express';
import { captureSpark } from '../../ingest/capture';

const router = Router();

// Capturing a spark from the console must do exactly what the `/capture` skill
// does: store the raw one-liner AND drop a seeded needs-your-take idea into the
// queue (captureSpark owns both writes). A bare insert into the sparks table
// left the queue untouched, so the "it lands in the queue" promise the Spark
// view makes was a lie. Reuse the one code path instead.
router.post('/', async (req, res) => {
  const { text } = req.body ?? {};
  if (typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({ error: 'text is required' });
  }
  try {
    const { sparkId, ideaId } = await captureSpark(text);
    res.status(201).json({ id: sparkId, ideaId });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
