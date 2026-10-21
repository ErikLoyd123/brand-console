import type { PostLength, Silo } from './api'

// Presentation for the length axis (how long a post runs). Mirrors src/core/lengths.ts:
// the band keys, labels, body character ranges, and hints are the same roster the
// drafting procedure and the reviewer read, so the card's picker and the server agree.
export interface LengthMeta {
  key: PostLength
  label: string
  min: number
  max: number
  hint: string
}

export const LENGTH_BANDS: LengthMeta[] = [
  { key: 'short', label: 'Short', min: 300, max: 600, hint: 'One claim, one specific, one line to land it. No sections.' },
  {
    key: 'medium',
    label: 'Medium',
    min: 700,
    max: 1100,
    hint: 'The claim, the mechanism in two or three paragraphs, and the one thing to do.',
  },
  {
    key: 'long',
    label: 'Long',
    min: 1300,
    max: 1900,
    hint: 'The full mechanism plus the mistake plus the fix. Only when the idea needs all three.',
  },
]

export function lengthMeta(key: PostLength): LengthMeta {
  return LENGTH_BANDS.find((b) => b.key === key) ?? LENGTH_BANDS[1]
}

// The band a silo leans to when the item has no pick. Mirrors getDefaultLength in
// src/core/lengths.ts; web piece kinds carry their own lengthTarget and return null.
export function defaultLengthFor(silo: Silo): PostLength | null {
  switch (silo) {
    case 'teach':
    case 'help':
      return 'medium'
    case 'conversation':
    case 'win':
    case 'curate':
    case 'promote':
    case 'discuss':
    case 'share':
    case 'ask':
      return 'short'
    default:
      return null
  }
}
