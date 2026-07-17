// src/server/routes/terminalImages.ts
// Receives images pasted or dropped into the console terminal and hands back a path
// the drawer types into the pty. Mirrors the /api/images/upload shape (base64 JSON
// body) minus the attachment concerns — these images belong to no idea and get no row.
//
// No collision with the /api/terminal WebSocket: registerUpgrade (ws-upgrade.ts)
// dispatches HTTP *upgrade* requests only, while express serves the normal verbs.

import { Router } from 'express';
import { writeTerminalImage } from '../terminal-images';

const router = Router();

// POST /api/terminal/images — Body: { dataBase64, mimeType }. Returns { path, name }.
router.post('/images', (req, res) => {
  const { dataBase64, mimeType } = req.body as { dataBase64?: string; mimeType?: string };

  if (typeof dataBase64 !== 'string' || dataBase64 === '') {
    return res.status(400).json({ error: 'dataBase64 is required' });
  }
  const ext =
    mimeType === 'image/jpeg'
      ? 'jpg'
      : mimeType === 'image/webp'
        ? 'webp'
        : mimeType === 'image/png'
          ? 'png'
          : null;
  if (!ext) {
    return res.status(400).json({ error: 'mimeType must be image/png, image/jpeg, or image/webp' });
  }

  try {
    const { absPath, name } = writeTerminalImage(Buffer.from(dataBase64, 'base64'), ext);
    res.status(201).json({ path: absPath, name });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
