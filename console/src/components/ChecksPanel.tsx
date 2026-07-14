import type { ReviewFinding } from '../lib/api'
import { cn } from '../lib/cn'

// The complete mechanical rule set from src/review/voice-checks.ts. Every
// rule renders a row regardless of whether it fired, so the panel represents
// exactly what the engine checks, no more, no less.
const RULES: { rule: string; label: string }[] = [
  { rule: 'no-em-dashes', label: 'No em dashes' },
  { rule: 'ai-tells', label: 'AI tells' },
  { rule: 'cta-rule', label: 'CTA rule' },
  { rule: 'protected-relationship-risk', label: 'Protected relationships' },
]

export function ChecksPanel({
  findings,
  loading,
}: {
  findings: ReviewFinding[]
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="rounded-lg bg-surface p-4 shadow-sm">
        <p className="font-mono text-xs text-text-subtle">checking…</p>
      </div>
    )
  }

  const failCount = findings.filter((f) => f.severity === 'fail').length
  const warnCount = findings.filter((f) => f.severity === 'warn').length
  const summary =
    failCount === 0 && warnCount === 0
      ? '4 checks · all clear'
      : `4 checks · ${failCount} fail · ${warnCount} warn`

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-sm">
      <p className="font-mono text-xs text-text-subtle">{summary}</p>
      <div className="flex flex-col gap-3">
        {RULES.map(({ rule, label }) => {
          const finding = findings.find((f) => f.rule === rule)
          if (!finding) {
            return (
              <div key={rule} className="flex items-start gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" />
                <div className="min-w-0">
                  <span className="font-mono text-[11px] uppercase tracking-wide text-text-subtle">{label}</span>
                  <p className="font-sans text-sm text-success-fg">clear</p>
                </div>
              </div>
            )
          }
          return (
            <div key={rule} className="flex items-start gap-2.5">
              <span
                className={cn(
                  'mt-1.5 size-1.5 shrink-0 rounded-full',
                  finding.severity === 'fail' ? 'bg-error' : 'bg-warning',
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={cn(
                      'font-mono text-[11px] uppercase tracking-wide',
                      finding.severity === 'fail' ? 'text-error-fg' : 'text-warning-fg',
                    )}
                  >
                    {label}
                  </span>
                  {finding.matches.length > 0 && (
                    <span className="font-mono text-[11px] text-text-subtle">
                      {finding.matches.length} {finding.matches.length === 1 ? 'hit' : 'hits'}
                    </span>
                  )}
                </div>
                <p className="font-sans text-sm text-text-muted">{finding.message}</p>
                {finding.matches.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {finding.matches.map((m, i) => (
                      <span
                        key={`${rule}-match-${i}`}
                        className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-text-muted"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
