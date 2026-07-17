// console/src/lib/terminal-buffer.ts
// Reads text back out of a live xterm instance for the drawer's copy button.
//
// This reads xterm's *rendered* buffer rather than the raw pty stream, and that
// distinction matters. Claude Code is a TUI: it redraws in place with cursor moves, so
// the byte stream is every intermediate frame concatenated. Stripping ANSI from it
// yields a pile of half-drawn duplicates. The rendered buffer is the settled result —
// already plain text, already deduplicated.
//
// There is deliberately no "copy the last reply" helper here. Claude Code anchors its
// input box: the cursor sits in the same place before and after a reply rather than
// advancing past it, so no cursor-derived row range spans a response. Recovering one
// means anchoring on Claude's own output markers (❯, ⏺, the ─── borders), which breaks
// silently whenever it reformats. Whole-session copy plus xterm's built-in drag-select
// covers the need without that coupling.

import type { Terminal } from '@xterm/xterm';

function trimBlankEdges(lines: string[]): string {
  // Drop blank leading/trailing lines but never touch the first line's indentation —
  // a plain .trim() would eat the leading spaces off copied code.
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') start += 1;
  while (end > start && lines[end - 1].trim() === '') end -= 1;
  return lines.slice(start, end).join('\n');
}

// Rows `from`..`to` inclusive, as plain text. translateToString(true) trims trailing
// whitespace that padding cells would otherwise contribute.
function readRows(term: Terminal, from: number, to: number): string {
  const buf = term.buffer.active;
  const lines: string[] = [];
  for (let i = Math.max(0, from); i <= to; i += 1) {
    lines.push(buf.getLine(i)?.translateToString(true) ?? '');
  }
  return trimBlankEdges(lines);
}

// Everything the terminal still remembers: scrollback plus the current screen.
export function readAll(term: Terminal): string {
  const buf = term.buffer.active;
  return readRows(term, 0, buf.baseY + term.rows - 1);
}
