import type { Silo } from '../lib/api'
import { siloMeta } from '../lib/silos'

// The silo (post intent) badge. Icon-led so it reads as a different axis from the
// icon-less pillar (topic) and tag (routing-state) pills sitting next to it.
export function SiloBadge({ silo }: { silo: Silo }) {
  const m = siloMeta(silo)
  const Icon = m.icon
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full py-0.5 pl-1.5 pr-2 text-xs font-medium"
      style={{ backgroundColor: m.bg, color: m.fg }}
      title={m.hint}
    >
      <Icon className="size-3" strokeWidth={2.25} />
      {m.label}
    </span>
  )
}
