import type { ContentPlatform, Silo } from '../lib/api'
import { getConsoleSilos } from '../lib/silos'
import { cn } from '../lib/cn'

// A compact segmented control for choosing a post's intent at promote time. The
// selected silo expands to icon + label in its hue; the rest collapse to icons, so the
// whole control stays the width of one label plus three or four glyphs. Feed promotes
// default to Teach; the writer can retarget before it lands in the queue. `platform`
// picks which roster renders (LinkedIn vs Reddit); it defaults to LinkedIn so every
// existing call site keeps behaving exactly as before.
export function SiloPicker({
  value,
  onChange,
  platform = 'linkedin',
}: {
  value: Silo
  onChange: (silo: Silo) => void
  platform?: ContentPlatform
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Post intent"
      className="inline-flex items-center gap-0.5 rounded-lg bg-surface-sunken p-0.5"
    >
      {getConsoleSilos(platform).map((m) => {
        const Icon = m.icon
        const on = m.key === value
        return (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={m.label}
            title={`${m.label} — ${m.hint}`}
            onClick={() => onChange(m.key)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-primary/40',
              !on && 'text-text-subtle hover:bg-row-hover hover:text-text',
            )}
            style={on ? { backgroundColor: m.bg, color: m.fg } : undefined}
          >
            <Icon className="size-3.5" strokeWidth={2.25} />
            {on && <span>{m.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
