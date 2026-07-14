import { useState } from 'react'
import { api } from '../lib/api'
import { Button } from '../components/ui/button'
import { Eyebrow } from '../components/kit'
import { SkillSurface } from '../components/SkillSurface'
import { Check, Zap } from 'lucide-react'

// The Spark page: the first tenant of SkillSurface. In AI mode it hosts a live
// `spark` conversation (interview → angle pick → seeded take); in plain mode — or
// whenever Claude is unreachable — it is exactly the old dumb form, which POSTs to
// /api/sparks via api.addSpark. Capturing a raw idea never depends on AI being up.
// Design: 04-spark-tenant.md.
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
            void api.addSpark(input.trim())
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

  function save() {
    if (text.trim() === '') return
    onSave(text.trim())
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
