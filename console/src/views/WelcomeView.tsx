import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import { cn } from '../lib/cn'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

// First-run screen, shown instead of the whole shell when the API is live but the
// profiles table is empty (a fresh clone). Creating the first profile here is the same
// createProfile call the sidebar switcher uses — the server makes it active, and the
// reload lands on the Voice page's setup surface (the App on-ramp), where the setup
// interview runs in the embedded terminal. After `make dev`, everything happens here.
export function WelcomeView() {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'personal' | 'brand'>('personal')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function create() {
    const trimmed = name.trim()
    if (trimmed === '' || busy) return
    setBusy(true)
    setError(null)
    api
      .createProfile({ name: trimmed, kind })
      .then(() => window.location.reload())
      .catch(() => {
        setBusy(false)
        setError('Could not create the profile — is the API still running?')
      })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col gap-6 rounded-lg bg-surface p-8 shadow-sm">
          <div className="flex flex-col gap-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
              <Sparkles className="size-5" />
            </div>
            <h1 className="mt-2 text-lg font-semibold tracking-tight text-text-strong">
              Welcome to your content engine
            </h1>
            <p className="text-sm leading-relaxed text-text-muted">
              It discovers source material, drafts posts in your voice, and reviews them
              before anything ships. Start by creating your first profile — the identity
              your content is written as.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-strong">Profile name</span>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                placeholder="e.g. your name, or a brand"
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-text-strong">Kind</span>
              <div className="flex gap-2">
                {(
                  [
                    ['personal', 'Personal', 'You, posting as yourself'],
                    ['brand', 'Brand', 'A company or product voice'],
                  ] as const
                ).map(([key, label, hint]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setKind(key)}
                    className={cn(
                      'flex flex-1 flex-col gap-0.5 rounded-md px-3 py-2 text-left ring-1 ring-inset transition-colors',
                      kind === key
                        ? 'bg-primary-soft ring-primary text-text-strong'
                        : 'ring-border text-text-muted hover:text-text-strong',
                    )}
                  >
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-[11px] leading-snug text-text-subtle">{hint}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-warning-fg">{error}</p>}

          <Button disabled={name.trim() === '' || busy} onClick={create}>
            {busy ? 'Creating…' : 'Create profile'}
          </Button>

          <p className="text-xs leading-relaxed text-text-subtle">
            Next: a guided setup interview builds your voice card and identity — it runs
            right here in the console. Profiles live in{' '}
            <code className="font-mono text-[11px]">profiles/&lt;slug&gt;/</code> on your
            machine and are never committed.
          </p>
        </div>
      </div>
    </div>
  )
}
