// src/core/lengths.ts
// A post's length band: how long the piece runs, chosen per post at draft time. Like the
// silo roster this is product behavior (it drives the drafting procedure's shape and the
// reviewer's length rule), so it is a fixed code-level roster, identical for every profile.
// The band is not derived from the silo: the silo sets a default, the material the owner
// gave sets the pick (one gap or one claim is short; a mechanism is medium; a mechanism
// plus the mistake plus the fix is long). Bands are LinkedIn-shaped; Reddit posts use them
// loosely and web articles carry their own lengthTarget instead.

import type { Silo } from './silos';

export type PostLength = 'short' | 'medium' | 'long';

export interface LengthBand {
  key: PostLength;
  label: string;
  /** Body character range the band targets (hook and close excluded). */
  min: number;
  max: number;
  /** One-line guidance: what fits in this band. */
  hint: string;
}

export const LENGTH_BANDS: LengthBand[] = [
  {
    key: 'short',
    label: 'Short',
    min: 300,
    max: 600,
    hint: 'One claim, one specific, one line to land it. No sections.',
  },
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
];

/** The band keys in canonical order. */
export function getLengths(): PostLength[] {
  return LENGTH_BANDS.map((b) => b.key);
}

/** The band definition for a key, or undefined for an unknown key. */
export function getLengthBand(key: string): LengthBand | undefined {
  return LENGTH_BANDS.find((b) => b.key === key);
}

/**
 * The band a silo leans to when the owner has not picked one. Conversation-shaped and
 * lighter intents lean short; the teach-shaped intents lean medium. Web piece kinds have
 * no band (their length lives on the article), so they return null.
 */
export function getDefaultLength(silo: Silo): PostLength | null {
  switch (silo) {
    case 'teach':
    case 'help':
      return 'medium';
    case 'conversation':
    case 'win':
    case 'curate':
    case 'promote':
    case 'discuss':
    case 'share':
    case 'ask':
      return 'short';
    default:
      return null;
  }
}
