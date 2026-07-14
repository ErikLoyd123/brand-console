import { useEffect, useState } from 'react'
import { Badge } from './ui/badge'
import { api, type Tag } from '../lib/api'
import { TAG_NEUTRAL, autoPair, pairForColor } from '../lib/tagColors'

// Module-level cache so every badge shares a single fetch of the tag vocabulary
// rather than each badge hitting the API separately.
let cache: Tag[] | null = null
let inflight: Promise<Tag[]> | null = null

function loadTags(): Promise<Tag[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = api.getTags().then((t) => {
      cache = t
      return t
    })
  }
  return inflight
}

function useTags(): Tag[] {
  const [tags, setTags] = useState<Tag[]>(cache ?? [])
  useEffect(() => {
    let active = true
    loadTags().then((loaded) => {
      if (active) setTags(loaded)
    })
    return () => {
      active = false
    }
  }, [])
  return tags
}

// Turn an unknown tag slug into a readable label: split on - and _ and
// capitalize each word (e.g. "cost-anomaly" -> "Cost Anomaly").
function prettify(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function TagChip({ tag }: { tag: string }) {
  const tags = useTags()
  const index = tags.findIndex((t) => t.slug === tag)
  const found = index >= 0 ? tags[index] : null
  const label = found ? found.name : prettify(tag)

  // Resolve to a pastel {bg,text} pair so every chip reads the same way:
  //  - explicit color that's one of our hues -> its matching pastel pair
  //  - explicit but unrecognized/legacy hex  -> solid bg + white text
  //  - no color -> the auto hue for this tag's vocabulary position
  //  - unknown slug -> neutral
  if (found?.color) {
    const pair = pairForColor(found.color)
    if (pair) return <Badge style={{ backgroundColor: pair.bg, color: pair.text }}>{label}</Badge>
    return (
      <Badge className="text-white" style={{ backgroundColor: found.color }}>
        {label}
      </Badge>
    )
  }
  const pair = found ? autoPair(index) : TAG_NEUTRAL
  return <Badge style={{ backgroundColor: pair.bg, color: pair.text }}>{label}</Badge>
}
