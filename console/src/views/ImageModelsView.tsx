import { useState } from 'react'
import { PageHeader, SectionHeading } from '../components/kit'
import {
  CATEGORIES,
  FAMILY_LABEL,
  MODELS,
  TOTALS,
  exampleImage,
  type ExampleCategory,
  type ModelId,
} from '../lib/model-examples'
import { Trophy, Type, ImageIcon, ExternalLink } from 'lucide-react'

// The image-model bake-off, shown rather than described. Every model got the SAME prompt
// at the same size; the images below are the raw output, not cherry-picked. The routing
// rule the imagery skill follows ("does the reader have to READ it?") is an observation
// about these images, so this page is the evidence and the doc is the conclusion.
//
// Provenance (per the repo's design rule): the renders are committed assets described in
// lib/model-examples.ts, the reasoning lives in the Choosing an image model doc, and the
// models themselves are managed on Connections. All three are linked from this page.

type Filter = 'all' | 'readable' | 'pictorial'

function winnerLabel(cat: ExampleCategory): string {
  if (cat.winner === 'tie-composed') return 'Both Claude tiers'
  return MODELS.find((m) => m.id === cat.winner)?.label ?? cat.winner
}

function isWinner(cat: ExampleCategory, model: ModelId): boolean {
  if (cat.winner === 'tie-composed') return model === 'claude-opus' || model === 'claude-sonnet'
  return cat.winner === model
}

function Tile({ cat, model }: { cat: ExampleCategory; model: (typeof MODELS)[number] }) {
  const src = exampleImage(cat.id, model.id)
  const won = isWinner(cat, model.id)
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <div
        className={
          'relative overflow-hidden rounded-lg ring-1 ' +
          (won ? 'ring-2 ring-primary-ink' : 'ring-border')
        }
      >
        {src ? (
          <img
            src={src}
            alt={`${model.label} — ${cat.title}`}
            loading="lazy"
            className="aspect-square w-full bg-surface-2 object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-surface-2 text-xs text-text-muted">
            no render
          </div>
        )}
        {won && (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-primary-ink px-1.5 py-0.5 text-[10px] font-semibold text-white">
            <Trophy className="size-3" />
            Best
          </span>
        )}
      </div>
      <figcaption className="flex items-center justify-between gap-2">
        <span
          className={'truncate text-xs ' + (won ? 'font-semibold text-text' : 'text-text-muted')}
        >
          {model.label}
        </span>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-text-muted">
          {model.family === 'diffusion' ? 'diffusion' : 'composed'}
        </span>
      </figcaption>
    </figure>
  )
}

function CategoryRow({ cat }: { cat: ExampleCategory }) {
  const [showPrompt, setShowPrompt] = useState(false)
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-text">{cat.title}</h3>
        <span
          className={
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ' +
            (cat.readable
              ? 'bg-warning-bg text-warning-fg ring-warning-fg/25'
              : 'bg-surface-2 text-text-muted ring-border')
          }
        >
          {cat.readable ? <Type className="size-3" /> : <ImageIcon className="size-3" />}
          {cat.readable ? 'Reader must read it' : 'Pictorial'}
        </span>
        <span className="text-xs text-text-muted">
          Best: <span className="font-medium text-text">{winnerLabel(cat)}</span>
        </span>
        <button
          type="button"
          onClick={() => setShowPrompt((v) => !v)}
          className="ml-auto shrink-0 text-xs text-primary-ink underline-offset-2 hover:underline"
        >
          {showPrompt ? 'Hide prompt' : 'Show prompt'}
        </button>
      </div>

      <p className="max-w-4xl text-sm text-text-muted">{cat.verdict}</p>

      {showPrompt && (
        <p className="max-w-4xl rounded-md bg-surface-2 p-3 font-mono text-xs leading-relaxed text-text-muted">
          {cat.prompt}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MODELS.map((m) => (
          <Tile key={m.id} cat={cat} model={m} />
        ))}
      </div>
    </section>
  )
}

export function ImageModelsView() {
  const [filter, setFilter] = useState<Filter>('all')
  const shown = CATEGORIES.filter((c) =>
    filter === 'all' ? true : filter === 'readable' ? c.readable : !c.readable,
  )

  const tabs: { id: Filter; label: string }[] = [
    { id: 'all', label: `All ${TOTALS.categories}` },
    { id: 'readable', label: 'Reader must read it' },
    { id: 'pictorial', label: 'Pictorial' },
  ]

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="System"
        title="Image model examples"
        description={`The same prompt through every model — ${TOTALS.images} images across ${TOTALS.categories} kinds of image. This is the evidence behind the model the imagery skill picks for you.`}
        actions={
          <a
            href="#docs/choosing-an-image-model"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary-ink px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Read the guidance
            <ExternalLink className="size-3.5" />
          </a>
        }
      />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-4">
        <SectionHeading title="The rule these images produced" />
        <p className="max-w-4xl text-sm text-text">
          <span className="font-semibold">Diffusion cannot spell. Claude cannot photograph.</span>{' '}
          Neither failure can be fixed by re-writing the prompt, so the only question that
          matters is whether the reader has to <em>read</em> anything in the image. If yes, use a
          Claude model — it typesets real text in a browser. If no, use a local diffusion model —
          it&rsquo;s the only thing here that can photograph.
        </p>
        <dl className="grid gap-2 sm:grid-cols-2">
          {(['diffusion', 'composed'] as const).map((f) => (
            <div key={f} className="rounded-md bg-surface p-3 ring-1 ring-inset ring-border">
              <dt className="text-xs font-semibold text-text">
                {MODELS.filter((m) => m.family === f)
                  .map((m) => m.label)
                  .join(' · ')}
              </dt>
              <dd className="mt-0.5 text-xs text-text-muted">{FAMILY_LABEL[f]}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-text-muted">
          Renders are stored in the repo (<code className="font-mono">console/src/assets/</code>) —
          they describe the models, not your profile, so every install sees the same comparison.
          Models are managed on{' '}
          <a
            href="#/connections"
            className="font-medium text-primary-ink underline-offset-2 hover:underline"
          >
            Connections
          </a>
          .
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={
              'h-7 rounded-md px-2.5 text-xs font-medium transition-colors ' +
              (filter === t.id
                ? 'bg-primary-ink text-white'
                : 'text-text-muted ring-1 ring-inset ring-border hover:bg-surface-2')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        {shown.map((c) => (
          <CategoryRow key={c.id} cat={c} />
        ))}
      </div>
    </div>
  )
}
