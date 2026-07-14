import { useEffect, useState } from 'react'
import { Badge } from './ui/badge'
import { api, type Pillar, type PillarInfo } from '../lib/api'

// Neutral palette assigned by pillar index, so arbitrary user-defined pillar
// keys always render with a stable color instead of requiring a hardcoded map.
const PALETTE = [
  'bg-[#e6f1ef] text-[#0b544e]',
  'bg-[#eaf4ee] text-[#15803d]',
  'bg-[#e8edfb] text-[#1d4ed8]',
  'bg-[#fbf1e3] text-[#b45309]',
  'bg-[#f4f2ee] text-[#4a453c]',
  'bg-[#f3e8f6] text-[#7e22ce]',
]
const NEUTRAL = 'bg-[#f4f2ee] text-[#4a453c]'

// Module-level cache so every badge shares a single fetch of the active
// profile's pillars rather than each badge hitting the API separately.
let cache: PillarInfo[] | null = null
let inflight: Promise<PillarInfo[]> | null = null

function loadPillars(): Promise<PillarInfo[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = api.getPillars().then((pillars) => {
      cache = pillars
      return pillars
    })
  }
  return inflight
}

function usePillars(): PillarInfo[] {
  const [pillars, setPillars] = useState<PillarInfo[]>(cache ?? [])
  useEffect(() => {
    let active = true
    loadPillars().then((loaded) => {
      if (active) setPillars(loaded)
    })
    return () => {
      active = false
    }
  }, [])
  return pillars
}

// Turn an unknown pillar key into a readable label: split on - and _ and
// capitalize each word (e.g. "home_coffee" -> "Home Coffee").
function prettify(key: string): string {
  return key
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function PillarBadge({ pillar }: { pillar: Pillar }) {
  const pillars = usePillars()
  const index = pillars.findIndex((p) => p.key === pillar)
  const label = index >= 0 ? pillars[index].label : prettify(pillar)
  const cls = index >= 0 ? PALETTE[index % PALETTE.length] : NEUTRAL
  return <Badge className={cls}>{label}</Badge>
}
