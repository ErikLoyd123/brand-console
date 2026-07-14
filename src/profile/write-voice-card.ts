// src/profile/write-voice-card.ts
// CLI the `voice` skill invokes to persist the voice card to
// profile/voice-card.md — the voice-axis analogue of write-register.ts. The voice
// card is freeform markdown, so there is no per-field write like register's --note:
// the skill reads the current card, composes the full edited markdown, and hands the
// whole thing back here on stdin (or as argv[2] for small edits).
//
//   npx tsx src/profile/write-voice-card.ts < new-card.md
//   cat new-card.md | npx tsx src/profile/write-voice-card.ts
//
// An empty card is rejected (an empty voice-card.md reads as "missing" to
// checkCompleteness and would break every drafter/reviewer that loads it): the error
// exits non-zero with the message on stderr so the skill can surface it verbatim.

import { readFileSync } from 'node:fs';
import { writeVoiceCard, voiceCardPath } from './loader';

function readInput(): string {
  const arg = process.argv[2];
  if (arg && arg.trim() !== '') return arg;
  // Fall back to stdin (fd 0) so a full card need not be shell-escaped.
  return readFileSync(0, 'utf8');
}

try {
  const markdown = readInput();
  writeVoiceCard(markdown);
  const lines = markdown.trim().split('\n').length;
  console.log(`Saved voice card to ${voiceCardPath()} (${lines} line${lines === 1 ? '' : 's'}).`);
} catch (e) {
  console.error(`write-voice-card: ${(e as Error).message}`);
  process.exit(1);
}
