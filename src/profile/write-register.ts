// src/profile/write-register.ts
// CLI the `register` skill invokes to persist one platform's register selection to
// profile/identity.yaml — the register-axis analogue of src/ingest/capture.ts for spark.
// Two modes:
//
//   Full upsert (the authoritative write, step 7) — one platform's whole selection as JSON:
//     npx tsx src/profile/write-register.ts '{"key":"reddit","active":true,"default":false,
//       "tones":[{"key":"plain-direct","note":""}],"themes":[{"key":"lessons-learned","note":""}]}'
//
//   Single note (the progressive write, one per tone/theme as the user confirms it, so the
//   console fills that "how it sounds in your voice" box mid-walk):
//     npx tsx src/profile/write-register.ts --note <platform> <tones|themes> <key> "<note text>"
//
// A ValidationError (unknown platform, malformed input, two active defaults) exits non-zero
// with the message on stderr so the skill can surface it verbatim; anything else re-throws.

import { readFileSync } from 'node:fs';
import { writePlatform, writeRegisterNote, ValidationError, type PlatformInput } from './write-identity';

function readJson(): string {
  const arg = process.argv[2];
  if (arg && arg.trim() !== '') return arg;
  // Fall back to stdin (fd 0) so large selections need not be shell-escaped.
  return readFileSync(0, 'utf8');
}

function runNoteMode(): void {
  // argv: [node, script, --note, platform, kind, key, note]
  const [, , , platform, kind, key, ...rest] = process.argv;
  const note = rest.join(' ');
  if (!platform || (kind !== 'tones' && kind !== 'themes') || !key) {
    console.error('write-register --note: expected <platform> <tones|themes> <key> "<note>".');
    process.exit(1);
  }
  try {
    writeRegisterNote(platform, kind, key, note);
    console.log(`Saved ${kind} note for ${platform}/${key}.`);
  } catch (e) {
    if (e instanceof ValidationError) {
      console.error(`ValidationError: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

function runUpsertMode(): void {
  let input: PlatformInput;
  try {
    input = JSON.parse(readJson()) as PlatformInput;
  } catch {
    console.error('write-register: expected a single platform selection as JSON.');
    process.exit(1);
  }
  try {
    const platforms = writePlatform(input);
    const saved = platforms.find((p) => p.key === input.key);
    console.log(
      `Saved register for "${input.key}": ` +
        `active=${saved?.active !== false}, default=${saved?.default === true}, ` +
        `tones=${saved?.tones?.length ?? 0}, themes=${saved?.themes?.length ?? 0}.`,
    );
    console.log(JSON.stringify({ ok: true, platforms }, null, 2));
  } catch (e) {
    if (e instanceof ValidationError) {
      console.error(`ValidationError: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

if (process.argv[2] === '--note') runNoteMode();
else runUpsertMode();
