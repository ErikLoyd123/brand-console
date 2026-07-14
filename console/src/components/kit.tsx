// Shared layout kit. Small, composable pieces the redesigned views build from.
// Numbers render in mono (the machine's output); prose renders in sans/serif.
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-text-subtle', className)}>
      {children}
    </span>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="font-serif text-2xl font-semibold leading-none text-text-heading">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionHeading({
  title,
  hint,
  action,
  className,
}: {
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-text-strong">{title}</h2>
        {hint && <span className="text-xs text-text-subtle">{hint}</span>}
      </div>
      {action}
    </div>
  )
}

export function StatTile({
  label,
  value,
  unit,
  delta,
  hint,
}: {
  label: string
  value: string | number
  unit?: string
  delta?: { value: string; positive: boolean }
  // What the number measures and over what window — shown as a hover tooltip so no
  // stat sits on the page as a bare, unexplained value.
  hint?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-sm', hint && 'cursor-help')} title={hint}>
      <div className="flex items-center justify-between">
        <Eyebrow>{label}</Eyebrow>
        {delta && (
          <span
            className={cn(
              'font-mono text-xs tabular-nums',
              delta.positive ? 'text-success-fg' : 'text-error-fg',
            )}
          >
            {delta.positive ? '↑' : '↓'} {delta.value}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-3xl font-medium tabular-nums text-text-strong">{value}</span>
        {unit && <span className="text-sm text-text-subtle">{unit}</span>}
      </div>
    </div>
  )
}

export function ScoreChip({ score }: { score: number }) {
  const tone =
    score >= 75
      ? 'bg-primary-soft text-primary-ink'
      : score >= 55
        ? 'bg-warning-bg text-warning-fg'
        : 'bg-surface-sunken text-text-muted'
  return (
    <span
      className={cn(
        'inline-flex h-6 min-w-9 items-center justify-center rounded-md px-1.5 font-mono text-xs font-semibold tabular-nums',
        tone,
      )}
      title="Relevance score"
    >
      {score}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-surface px-6 py-16 text-center shadow-sm">
      {icon && <div className="flex size-11 items-center justify-center rounded-full bg-surface-sunken text-text-subtle">{icon}</div>}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-text-strong">{title}</p>
        {hint && <p className="max-w-sm text-sm text-text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  )
}
