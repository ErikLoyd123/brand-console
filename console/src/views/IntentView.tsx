import { api } from '../lib/api'
import { useResource } from '../lib/useResource'
import { PageHeader, SectionHeading, Eyebrow } from '../components/kit'
import { getConsoleSilos, type SiloMeta } from '../lib/silos'
import type { Silo } from '../lib/api'
import { SilosInfoLink } from '../components/SilosInfoLink'
import { Check, Minus } from 'lucide-react'

// The intent axis (silo) as a first-class, browsable reference. Unlike Pillars and Tags,
// the silo roster is FIXED in code (src/core/silos.ts) — it drives how draft shapes a
// post and how content-reviewer grades it — so this view explains and counts the intents
// rather than editing them. The roster is platform-keyed: LinkedIn, Reddit, and Web
// (long-form piece kinds) each get their own group, `curate` shared by the two social
// platforms. You still SET an item's silo in Discovery and filter by it in Queue. See
// how-it-fits-together.md and design 2026-07-03-reddit-publishing-channel/01-content-axes.

// The per-silo rule summary shown as chips. Mirrors draft's per-silo shaping and the
// content-reviewer's silo rules; kept short and factual. `ask` (the boolean field) tracks
// product-adjacency, true only for the teach-shaped silo of each platform (teach on
// LinkedIn, help on Reddit), matching siloMayBeProductAdjacent in src/core/silos.ts.
interface SiloRules {
  ask: boolean
  questionHook: boolean
  lengthFloor: boolean
  note: string
}

const RULES: Record<Silo, SiloRules> = {
  conversation: {
    ask: false,
    questionHook: true,
    lengthFloor: false,
    note: 'Opens a loop instead of closing one — built to pull replies, not deliver a takeaway.',
  },
  teach: {
    ask: true,
    questionHook: false,
    lengthFloor: true,
    note: 'Leads with the useful, specific thing. The only LinkedIn silo that may carry a product ask.',
  },
  win: {
    ask: false,
    questionHook: false,
    lengthFloor: false,
    note: 'A short, warm story where someone else is the hero — the owner is never the aggressive hero.',
  },
  discuss: {
    ask: false,
    questionHook: true,
    lengthFloor: false,
    note: "Opens a genuine discussion instead of closing one — pose the real question you're chewing on and invite disagreement.",
  },
  help: {
    ask: true,
    questionHook: false,
    lengthFloor: true,
    note: 'Answers a concrete problem as a service. The teach-analog: the only Reddit silo that may be product-adjacent.',
  },
  share: {
    ask: false,
    questionHook: false,
    lengthFloor: false,
    note: 'A first-person experience or result, told plainly, no flex — where a LinkedIn win relocates, stripped of the brag.',
  },
  ask: {
    ask: false,
    questionHook: true,
    lengthFloor: false,
    note: "Solicits the community's input, recommendations, or gut-check, and ends on the question — no ask beyond it.",
  },
  curate: {
    ask: false,
    questionHook: false,
    lengthFloor: false,
    note: 'A generous pointer to someone else’s work, credited explicitly. The owner is a node passing something good along.',
  },
  'how-to': {
    ask: true,
    questionHook: false,
    lengthFloor: true,
    note: 'Walks the reader through one task in ordered steps until they can do it themselves. The web teach-analog: the only web intent that may be product-adjacent.',
  },
  explainer: {
    ask: false,
    questionHook: false,
    lengthFloor: true,
    note: 'Makes one concept clear from the ground up — define it, show why it matters, leave the reader able to reason about it.',
  },
  comparison: {
    ask: false,
    questionHook: false,
    lengthFloor: true,
    note: 'Weighs two or more options against stated criteria, plainly and fairly, so the reader can choose for themselves.',
  },
  'thought-piece': {
    ask: false,
    questionHook: false,
    lengthFloor: true,
    note: 'Stakes a considered position on where the field is heading and defends it with reasoning, not hype.',
  },
  whitepaper: {
    ask: false,
    questionHook: false,
    lengthFloor: true,
    note: 'Makes a thorough, evidence-backed case on a substantial topic, structured with sections and a short summary.',
  },
}

function RuleChip({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-text-muted">
      {on ? (
        <Check className="size-3 text-success-fg" />
      ) : (
        <Minus className="size-3 text-text-subtle" />
      )}
      {label}
    </span>
  )
}

function SiloCard({ meta, count }: { meta: SiloMeta; count: number }) {
  const Icon = meta.icon
  const rules = RULES[meta.key]
  return (
    <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: meta.bg, color: meta.fg }}
          >
            <Icon className="size-4" />
          </span>
          <h3 className="font-serif text-lg text-text-strong">{meta.label}</h3>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-mono text-xl font-medium tabular-nums text-text-strong">{count}</span>
          <Eyebrow>in queue</Eyebrow>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-text-muted">{rules.note}</p>

      <div className="flex flex-wrap gap-1.5">
        <RuleChip on={rules.ask} label={rules.ask ? 'Can carry an ask' : 'No ask'} />
        <RuleChip on={rules.questionHook} label="Question hook" />
        <RuleChip on={rules.lengthFloor} label="Length floor" />
      </div>
    </div>
  )
}

function PlatformGroup({
  title,
  hint,
  silos,
  countBySilo,
}: {
  title: string
  hint: string
  silos: SiloMeta[]
  countBySilo: (silo: Silo) => number
}) {
  return (
    <section className="flex flex-col gap-3">
      <SectionHeading title={title} hint={hint} />
      <div className="grid gap-4 md:grid-cols-2">
        {silos.map((meta) => (
          <SiloCard key={meta.key} meta={meta} count={countBySilo(meta.key)} />
        ))}
      </div>
    </section>
  )
}

export function IntentView() {
  const { data, loading, error } = useResource(() => api.getQueue())
  const items = data ?? []
  const countBySilo = (silo: Silo) => items.filter((i) => i.silo === silo).length
  const linkedinSilos = getConsoleSilos('linkedin')
  const redditSilos = getConsoleSilos('reddit')
  const webSilos = getConsoleSilos('web')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Insights"
        title="Intent"
        description="Why a piece exists — its silo. A fixed roster per platform — four for LinkedIn, five for Reddit (sharing curate), five piece kinds for Web long-form — running alongside your pillars (what a piece is about). The silo decides a piece's shape, its hook rule, and whether it can carry an ask."
        actions={<SilosInfoLink />}
      />

      {loading ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-44 skeleton rounded-lg" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-44 skeleton rounded-lg" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-44 skeleton rounded-lg" />
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">
          Couldn't load queue counts. {error}
        </div>
      ) : (
        <>
          <PlatformGroup
            title="LinkedIn intents"
            hint="fixed roster · set an item's silo in Discovery"
            silos={linkedinSilos}
            countBySilo={countBySilo}
          />
          <PlatformGroup
            title="Reddit intents"
            hint="fixed roster · curate is shared with LinkedIn"
            silos={redditSilos}
            countBySilo={countBySilo}
          />
          <PlatformGroup
            title="Web (long-form) intents"
            hint="fixed roster · the piece kinds — set by spark or when a piece starts"
            silos={webSilos}
            countBySilo={countBySilo}
          />
          <p className="text-sm text-text-subtle">
            The intents are a fixed product roster, not an editable list — they drive how every draft is
            shaped and reviewed. You choose a post's intent when you promote it in Discovery (or pick a
            piece kind on the Spark screen for a web piece), and filter by it in Queue.
          </p>
        </>
      )}
    </div>
  )
}
