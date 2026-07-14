import { useEffect, useRef, useState } from 'react'
import { api, type ContentPlatform, type Silo } from '../lib/api'
import { Button } from '../components/ui/button'
import { Eyebrow } from '../components/kit'
import { SkillSurface } from '../components/SkillSurface'
import { getConsoleSilos } from '../lib/silos'
import { cn } from '../lib/cn'
import { Check, Zap } from 'lucide-react'

// The Spark page: the first tenant of SkillSurface. In AI mode it hosts a live
// `spark` conversation (interview → angle pick → seeded take); in plain mode — or
// whenever Claude is unreachable — it is exactly the old dumb form, which POSTs to
// /api/sparks via api.addSpark. Capturing a raw idea never depends on AI being up.
// Design: 04-spark-tenant.md.

// The owner's up-front call on where the spark is headed. It rides into the AI session
// as leading directive lines the spark skill honors — `[platform: …]` picks the register
// platform (web → the long-form pipeline), and an optional `[kind: …]` pre-picks a web
// piece kind so the interview skips the silo proposal. The plain path strips them — a
// raw save is destination-free.
const DIRECTIVES = /^(\[(platform|kind): [a-z-]+\]\n)+\n/

const PLATFORMS: Array<{ key: ContentPlatform; label: string; hint: string }> = [
  { key: 'linkedin', label: 'LinkedIn', hint: 'A LinkedIn post, via the queue' },
  { key: 'reddit', label: 'Reddit', hint: 'A Reddit post, via the queue (manual copy-paste channel)' },
  {
    key: 'web',
    label: 'Web',
    hint: 'A long-form web piece — written in full and reviewed on its Queue card, published as an exported Markdown file',
  },
]

export function SparkView() {
  const [text, setText] = useState('')

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-10 text-center sm:py-16">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
        <Zap className="size-5" />
      </div>
      <div className="flex flex-col gap-2">
        <Eyebrow>Capture a spark</Eyebrow>
        <h1 className="font-serif text-3xl font-semibold text-text-heading">What's on your mind?</h1>
        <p className="text-sm text-text-muted">
          Drop a raw idea. One line is enough. Shape it into a sharp take, or just save it — it lands
          in the queue either way.
        </p>
      </div>

      <div className="w-full">
        <SkillSurface
          skillName="spark"
          onPlainSubmit={(input) => {
            void api.addSpark(input.replace(DIRECTIVES, '').trim())
          }}
          onResult={() => setText('')}
          fallback={({ start, disabled }) => (
            <SparkForm text={text} setText={setText} onSave={start} disabled={disabled} />
          )}
        />
      </div>
    </div>
  )
}

// The plain form — today's Spark capture, verbatim in behavior. `onSave` is the
// `start` SkillSurface hands in: it opens the live spark session in AI mode, or
// runs the dumb api.addSpark POST in plain mode. The "Saved" flash only makes
// sense for the plain path, so it fires on save and clears shortly after.
function SparkForm({
  text,
  setText,
  onSave,
  disabled,
}: {
  text: string
  setText: (v: string) => void
  onSave: (input: string) => void
  disabled: boolean
}) {
  const [saved, setSaved] = useState(false)
  const [platform, setPlatform] = useState<ContentPlatform>('linkedin')
  // Web only: '' = let the spark interview propose the piece kind (the default).
  const [kind, setKind] = useState<Silo | ''>('')
  // Seed the platform from the profile's register default — but never stomp a choice
  // the owner already made while the fetch was in flight.
  const touchedRef = useRef(false)
  useEffect(() => {
    let alive = true
    api
      .getRegisterConfig()
      .then((cfg) => {
        if (!alive || touchedRef.current) return
        const def = cfg.selection.find((p) => p.default && p.active) ?? cfg.selection.find((p) => p.active)
        if (def && PLATFORMS.some((p) => p.key === def.key)) setPlatform(def.key as ContentPlatform)
      })
      .catch(() => {
        // No config (fresh profile) — the LinkedIn default stands.
      })
    return () => {
      alive = false
    }
  }, [])

  function save() {
    if (text.trim() === '') return
    const directives =
      `[platform: ${platform}]\n` + (platform === 'web' && kind !== '' ? `[kind: ${kind}]\n` : '')
    onSave(`${directives}\n${text.trim()}`)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full rounded-lg bg-surface p-2 shadow-sm">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          placeholder="A thought, a hot take, a thing you noticed today..."
          className="min-h-40 w-full resize-none rounded-md bg-transparent p-4 font-serif text-lg leading-relaxed text-text outline-none placeholder:text-text-subtle"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save()
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Shape it for</span>
          <div className="inline-flex overflow-hidden rounded-lg bg-surface-sunken p-0.5">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                type="button"
                title={p.hint}
                onClick={() => {
                  touchedRef.current = true
                  setPlatform(p.key)
                }}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  platform === p.key
                    ? 'bg-surface text-text shadow-sm'
                    : 'text-text-muted hover:text-text',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {platform === 'web' && (
          <div className="flex items-center gap-2">
            <label htmlFor="spark-kind" className="text-xs text-text-muted">
              as a
            </label>
            <select
              id="spark-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as Silo | '')}
              className="rounded-lg bg-surface-sunken px-2.5 py-1.5 text-xs font-medium text-text outline-none transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <option value="">Let spark propose</option>
              {getConsoleSilos('web').map((m) => (
                <option key={m.key} value={m.key} title={m.hint}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button size="lg" disabled={disabled || text.trim() === ''} onClick={save}>
          Save spark
        </Button>
        <span className="font-mono text-xs text-text-subtle">⌘ / Ctrl + Enter</span>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-success-fg">
            <Check className="size-4" /> Saved
          </span>
        )}
      </div>
    </div>
  )
}
