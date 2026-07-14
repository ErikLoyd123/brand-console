// LinkedIn feed heuristics: the "…see more" fold and body rich-token styling.
// Pure, DOM-free, and shared by PostPreview and the editor's fold cue so there
// is a single source of truth for where a post gets cut.

export const FOLD_CHARS = 210

// Index of the nth '\n' in text, or Infinity when there are fewer than n.
function indexOfNthNewline(text: string, n: number): number {
  let count = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      count += 1
      if (count === n) return i
    }
  }
  return Infinity
}

// Split the assembled post into the slice LinkedIn shows before the fold and the
// slice hidden behind "…see more". `folded` is false when the whole post fits.
export function foldTruncation(text: string): { visible: string; hidden: string; folded: boolean } {
  const charBound = FOLD_CHARS
  const lineBound = indexOfNthNewline(text, 3)
  const bound = Math.min(charBound, lineBound)

  if (text.length <= bound) {
    return { visible: text, hidden: '', folded: false }
  }

  let cut = bound
  // Word-boundary nicety: only the char bound can land mid-word; the line bound
  // is already break-aligned. Back up to the previous space when it helps.
  if (bound === charBound) {
    const prevSpace = text.lastIndexOf(' ', cut)
    if (prevSpace > 0) cut = prevSpace
  }

  return { visible: text.slice(0, cut), hidden: text.slice(cut), folded: true }
}

export type BodyToken = { type: 'text' | 'tag' | 'mention' | 'url'; value: string }

// Split body text into ordered tokens: hashtags (#\w+), mentions (@\w+), URLs
// (https?://\S+), and the plain text between them. Order is preserved so the
// caller can re-render the string faithfully as React nodes (never as HTML).
export function tokenizeBody(text: string): BodyToken[] {
  const pattern = /(https?:\/\/\S+)|(#\w+)|(@\w+)/g
  const tokens: BodyToken[] = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      tokens.push({ type: 'text', value: text.slice(last, match.index) })
    }
    if (match[1]) tokens.push({ type: 'url', value: match[1] })
    else if (match[2]) tokens.push({ type: 'tag', value: match[2] })
    else if (match[3]) tokens.push({ type: 'mention', value: match[3] })
    last = match.index + match[0].length
  }
  if (last < text.length) {
    tokens.push({ type: 'text', value: text.slice(last) })
  }
  return tokens
}
