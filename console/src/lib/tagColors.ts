// Single source of truth for tag colors, shared by the Discovery chips (TagChip)
// and the Tags management page. Each entry is a pastel background + a saturated
// text/dot hue. A tag with no explicit `color` gets an auto entry by its index in
// the (name-sorted) vocabulary, so the same tag shows the same color everywhere.

export interface TagPaletteEntry {
  name: string
  bg: string
  text: string
}

export const TAG_PALETTE: TagPaletteEntry[] = [
  { name: 'Teal', bg: '#e6f1ef', text: '#0b544e' },
  { name: 'Green', bg: '#eaf4ee', text: '#15803d' },
  { name: 'Blue', bg: '#e8edfb', text: '#1d4ed8' },
  { name: 'Amber', bg: '#fbf1e3', text: '#b45309' },
  { name: 'Stone', bg: '#f4f2ee', text: '#4a453c' },
  { name: 'Purple', bg: '#f3e8f6', text: '#7e22ce' },
]

// Fallback pair for a slug that isn't in the loaded vocabulary yet.
export const TAG_NEUTRAL: TagPaletteEntry = { name: 'Neutral', bg: '#f4f2ee', text: '#4a453c' }

// The recolor picker offers the saturated hues; a stored color is one of these.
export const TAG_SWATCHES = TAG_PALETTE.map((p) => p.text)

// The auto pair for a vocabulary position.
export function autoPair(index: number): TagPaletteEntry {
  return TAG_PALETTE[((index % TAG_PALETTE.length) + TAG_PALETTE.length) % TAG_PALETTE.length]
}

// The pastel pair for an explicit stored color (one of the swatch hues), or null
// if it's an unrecognized/legacy hex.
export function pairForColor(color: string): TagPaletteEntry | null {
  const c = color.toLowerCase()
  return TAG_PALETTE.find((p) => p.text.toLowerCase() === c) ?? null
}

// The saturated dot color used to represent a tag on the Tags page: its explicit
// color, else the auto hue for its position.
export function tagDotColor(color: string | null | undefined, index: number): string {
  return color ?? autoPair(index).text
}
