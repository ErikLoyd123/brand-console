import { Badge } from './ui/badge'
import type { QueueTag } from '../lib/api'

// Queue routing state, set at ingest/capture time: opinion content waits for the
// owner's take; factual/curation content can draft straight away.
const TAG: Record<QueueTag, { label: string; cls: string; hint: string }> = {
  'needs-your-take': {
    label: 'Needs your take',
    cls: 'bg-[#fbf1e3] text-[#b45309]',
    hint: 'Queue routing state — opinion content that needs your one-to-two-sentence take before it can draft',
  },
  'ready-to-draft': {
    label: 'Ready to draft',
    cls: 'bg-[#eaf4ee] text-[#15803d]',
    hint: 'Queue routing state — factual or curation content that can be drafted without a seeded take',
  },
}

export function TagBadge({ tag }: { tag: QueueTag }) {
  const v = TAG[tag]
  return (
    <Badge className={v.cls} title={v.hint}>
      {v.label}
    </Badge>
  )
}
