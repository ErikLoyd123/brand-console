// src/server/terminal-images.ts
// Scratch storage for images pasted or dropped into the console's embedded terminal.
// These are chat input, not attachments: the pty gets a path, Claude Code reads the
// file at prompt time and embeds the pixels into the conversation, and the file is
// dead weight from then on. So no DB row, no profile, no idea, no alt text.
//
// Deliberately not routed through src/images/store.ts: that module is the single
// writer for *attachments* and couples every write to a profileId/ideaId and an
// `images` row. Storing a terminal paste through it would mean inventing a fake idea
// to satisfy a foreign key.

import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { nanoid } from 'nanoid';
import { REPO_ROOT } from '../profile/loader';

// Sits beside data/images/; covered by the existing gitignore rule on data/.
export const TERMINAL_IMAGES_ROOT = resolve(REPO_ROOT, 'data', 'terminal-images');

export type TerminalImageExt = 'png' | 'jpg' | 'webp';

export interface WrittenTerminalImage {
  // Absolute: the pty resolves it from whatever cwd claude was launched in.
  absPath: string;
  name: string;
}

export function writeTerminalImage(buffer: Buffer, ext: TerminalImageExt): WrittenTerminalImage {
  mkdirSync(TERMINAL_IMAGES_ROOT, { recursive: true });
  const name = `${nanoid()}.${ext}`;
  const absPath = resolve(TERMINAL_IMAGES_ROOT, name);
  writeFileSync(absPath, buffer);
  return { absPath, name };
}

// Age-based sweep rather than delete-on-session-end: a crashed server never orphans
// files, and there's no race where a file vanishes between the paste and the Enter
// that sends it. Called once on server start.
export const TERMINAL_IMAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function sweepTerminalImages(maxAgeMs: number = TERMINAL_IMAGE_MAX_AGE_MS): number {
  if (!existsSync(TERMINAL_IMAGES_ROOT)) return 0;
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  for (const name of readdirSync(TERMINAL_IMAGES_ROOT)) {
    const abs = resolve(TERMINAL_IMAGES_ROOT, name);
    try {
      if (statSync(abs).mtimeMs >= cutoff) continue;
      unlinkSync(abs);
      removed += 1;
    } catch {
      // Raced with another delete, or unreadable — the next sweep retries.
    }
  }
  return removed;
}
