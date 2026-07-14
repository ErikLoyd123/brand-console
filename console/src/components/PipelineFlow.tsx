// The signature element: the content pipeline rendered as a flow, with the
// human-in-the-loop gate made visible. Discovery and drafting are done by
// agents; the gate between them is where the owner's take enters. That is the
// product's whole thesis, so the layout says it out loud.
import { Fragment } from 'react'
import { ChevronRight, Inbox, ListChecks, PenLine, Send, UserRound } from 'lucide-react'
import type { FunnelStage } from '../lib/api'

const ICONS: Record<string, typeof Inbox> = {
  discovery: Inbox,
  queue: ListChecks,
  drafts: PenLine,
  published: Send,
}

// A quiet directional hairline: line into a chevron, pointing downstream.
function Flow() {
  return (
    <span className="flex flex-1 items-center text-border-strong">
      <span className="h-px flex-1 bg-current" />
      <ChevronRight className="-ml-1 size-3.5 shrink-0" strokeWidth={2} />
    </span>
  )
}

// Plain step-to-step connector. The gate connector adds the "your take" pill —
// the human-in-the-loop moment, the one place the flow passes through a person.
function Connector({ gate }: { gate?: boolean }) {
  if (gate) {
    return (
      <div className="hidden shrink-0 items-center gap-1.5 px-1 md:flex md:w-32" aria-hidden>
        <Flow />
        <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-fg shadow-sm">
          <UserRound className="size-3" />
          your review
        </span>
        <Flow />
      </div>
    )
  }
  return (
    <div className="hidden shrink-0 items-center px-1 md:flex md:w-14" aria-hidden>
      <Flow />
    </div>
  )
}

function Stage({
  stage,
  onClick,
}: {
  stage: FunnelStage
  onClick: () => void
}) {
  const Icon = ICONS[stage.key] ?? Inbox
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-lift group flex min-w-[7.5rem] flex-1 flex-col items-start gap-2 rounded-lg bg-surface-nested px-4 py-4 text-left outline-none"
    >
      <span className="flex items-center gap-2 text-text-subtle">
        <Icon className="size-4" />
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em]">{stage.label}</span>
      </span>
      <span className="font-mono text-3xl font-medium tabular-nums text-text-strong">{stage.count}</span>
    </button>
  )
}

export function PipelineFlow({
  stages,
  onNavigate,
}: {
  stages: FunnelStage[]
  onNavigate: (key: string) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-sm md:flex-row md:items-center md:gap-0">
      {stages.map((stage, i) => (
        <Fragment key={stage.key}>
          <div className="md:flex-1">
            <Stage stage={stage} onClick={() => onNavigate(stage.key)} />
          </div>
          {/* The gate sits before Published: the queue is where the owner's take and
              review happen, and nothing ships without passing through them. */}
          {i < stages.length - 1 && <Connector gate={stages[i + 1].key === 'published'} />}
        </Fragment>
      ))}
    </div>
  )
}
