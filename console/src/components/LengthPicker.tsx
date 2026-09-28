import type { PostLength, Silo } from '../lib/api'
import { LENGTH_BANDS, defaultLengthFor, lengthMeta } from '../lib/lengths'
import { AlignLeft } from 'lucide-react'

// The length band picker on a queue card: how long the post should run. Sits with the
// silo, pillar, and tag badges because it is the fourth axis of a post's shape. An unset
// item shows the silo's default band in parentheses, so what the drafter will do is
// visible before anyone picks. Writes straight to the item (POST /api/queue/:id/length),
// the same field spark and the queue skill set.
export function LengthPicker({
  value,
  silo,
  onChange,
}: {
  value: PostLength | null
  silo: Silo
  onChange: (length: PostLength | null) => void | Promise<void>
}) {
  const fallback = defaultLengthFor(silo)
  const shown = value ?? fallback
  const meta = shown ? lengthMeta(shown) : null
  return (
    <label
      className="inline-flex items-center gap-1 rounded-full bg-surface-sunken py-0.5 pl-1.5 pr-1 text-xs font-medium text-text-muted"
      title={
        meta
          ? `${meta.label}: ${meta.min} to ${meta.max} characters. ${meta.hint}${value ? '' : ' (silo default; pick one to override)'}`
          : 'How long the post should run'
      }
    >
      <AlignLeft className="size-3" strokeWidth={2.25} />
      <select
        value={value ?? ''}
        onChange={(e) => void onChange(e.target.value === '' ? null : (e.target.value as PostLength))}
        className="cursor-pointer bg-transparent pr-1 text-xs font-medium text-text-muted focus:outline-none"
        aria-label="Post length"
      >
        <option value="">{fallback ? `${lengthMeta(fallback).label} (default)` : 'Length'}</option>
        {LENGTH_BANDS.map((b) => (
          <option key={b.key} value={b.key}>
            {b.label} · {b.min}-{b.max}
          </option>
        ))}
      </select>
    </label>
  )
}
