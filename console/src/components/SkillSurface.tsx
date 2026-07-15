import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import { Textarea } from './ui/input'
import { Markdown } from './Markdown'
import { cn } from '../lib/cn'
import { api } from '../lib/api'
import { useSkillSession } from '../lib/useSkillSession'
import type { AskChoice, AskImage, AskText, DownstreamFrame, Result } from '../lib/skill-protocol'

// The reusable host that turns any console view into a live skill surface. It
// renders the four downstream protocol message types, owns the AI/plain toggle,
// the liveness indicator, and the session lifecycle, and steps aside to the
// page's own `fallback` whenever the engine is unreachable or a run dies. It
// hardcodes no skill logic — Spark→spark is only its first tenant.
// Design: 03-skill-surface-component.md.

export interface SkillSurfaceProps {
  /** Skill to run headless, e.g. "spark". Matches a name from GET /api/skills. */
  skillName: string
  /**
   * The plain, always-works form. Rendered in plain mode and whenever the surface
   * auto-falls-back. Receives a `start` fn: calling it with the user's raw input
   * opens the AI conversation (lazy — no session until the user submits).
   */
  fallback: (args: { start: (initialInput: string) => void; disabled: boolean }) => ReactNode
  /**
   * The page's dumb write — the permanent floor. Called when the user submits in
   * plain mode, when the engine is not live, or after a mid-run fallback. e.g.
   * Spark's `api.addSpark`. This is what makes the plain path never depend on AI.
   */
  onPlainSubmit: (input: string) => void | Promise<void>
  /** Optional seed opened immediately on mount (callers that already hold input). */
  initialInput?: string
  /** Fired once on the terminal `result`. */
  onResult?: (result: { summary: string; link?: string }) => void
  /**
   * Fired on each step boundary mid-run (a new question, or a status beat). Lets a page
   * refresh side state the skill is writing as it goes — e.g. the Register editor refetching
   * so each note fills its box during the walk, not only at the end. Cheap and idempotent by
   * contract; the page should tolerate being called several times.
   */
  onProgress?: () => void
  /** Fired when the surface hard-falls-back to plain (engine down / mid-run error). */
  onFallback?: (reason: string) => void
  /** Default mode. Defaults to "ai". */
  defaultMode?: 'ai' | 'plain'
  /**
   * Ambient hints cycled in the working state between asks. Per-tenant flavor;
   * defaults to spark's ("Reading your spark", …) so the Spark surface is unchanged.
   */
  workingHints?: string[]
  /**
   * Result-card button copy. `linkLabel` labels the deep-link button (only shown when
   * the result carries a link); `resetLabel` labels the start-over button. Defaults to
   * spark's ("Open in Queue" / "New spark").
   */
  resultActions?: { linkLabel?: string; resetLabel?: string }
  /**
   * AI-only surface: suppress the AI/plain toggle, and when the engine is unreachable or a
   * run errors, render a one-line "edit directly below" note instead of a fallback form.
   * For pages whose own content (e.g. the Register editor) is the permanent plain floor,
   * always visible beneath this surface. Defaults to false (Spark's toggle behavior).
   */
  aiOnly?: boolean
}

// spark-flavored ambient copy for the open-ended "thinking" waits, the default when a
// tenant passes no `workingHints`. Honest to what spark does so the wait reads as
// intentional. Cycled only while the engine is between asks.
const RIFF_WORKING_HINTS = ['Reading your spark', 'Finding the real thought', 'Turning it over', 'Shaping the angle']

type Phase =
  | { kind: 'idle' } // AI mode, no session yet (lazy)
  | { kind: 'connecting' } // socket opening; awaiting `ready`
  | { kind: 'asking'; turn: AskChoice | AskText } // a blocking ask is on screen
  | { kind: 'status'; message: string } // non-blocking narration between asks
  | { kind: 'resolved'; result: Result } // terminal outcome card
  | { kind: 'error'; reason: string } // fell back to plain (transient view)

export function SkillSurface({
  skillName,
  fallback,
  onPlainSubmit,
  initialInput,
  onResult,
  onProgress,
  onFallback,
  defaultMode = 'ai',
  workingHints = RIFF_WORKING_HINTS,
  resultActions,
  aiOnly = false,
}: SkillSurfaceProps) {
  const [mode, setMode] = useState<'ai' | 'plain'>(defaultMode)
  const [live, setLive] = useState<boolean | null>(null) // null = not yet probed
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  // Live streaming reasoning shown during the wait; cleared when a turn resolves.
  const [thought, setThought] = useState('')
  // "A session was started and should be aborted if the user toggles to Plain."
  // Reset by cancel/reset — it tracks live-session state, NOT whether we've auto-opened.
  const startedRef = useRef(false)
  // One-shot guard for the initialInput auto-open, set once per mount and never reset.
  // Distinct from startedRef: cancelling or finishing a run must NOT re-arm the auto-open,
  // or the surface relaunches itself the moment it returns to idle (Esc/Cancel/Done would
  // be instantly undone). Each new trigger remounts the surface (surfaceKey), which is what
  // legitimately re-arms this.
  const autoOpenedRef = useRef(false)

  const onMessage = useCallback(
    (msg: DownstreamFrame) => {
      switch (msg.type) {
        case 'ready':
          setThought('')
          setPhase({ kind: 'status', message: 'Thinking…' })
          break
        case 'status':
          setPhase({ kind: 'status', message: msg.message })
          onProgress?.()
          break
        case 'thought':
          setThought(msg.text)
          break
        case 'ask_choice':
        case 'ask_text':
          setThought('')
          setPhase({ kind: 'asking', turn: msg })
          onProgress?.()
          break
        case 'result':
          setThought('')
          setPhase({ kind: 'resolved', result: msg })
          onResult?.({ summary: msg.summary, link: msg.link })
          break
        case 'error':
          setThought('')
          setPhase({ kind: 'error', reason: msg.message })
          onFallback?.(msg.message)
          break
      }
    },
    [onResult, onProgress, onFallback],
  )

  const session = useSkillSession({ skillName, onMessage })

  // Liveness probe: cheap, non-spawning, polled slowly and on window focus.
  useEffect(() => {
    let alive = true
    const probe = () => {
      api.checkSkillSurface().then((ok) => {
        if (alive) setLive(ok)
      })
    }
    probe()
    const iv = setInterval(probe, 30_000)
    window.addEventListener('focus', probe)
    return () => {
      alive = false
      clearInterval(iv)
      window.removeEventListener('focus', probe)
    }
  }, [])

  // Safety net: if `ready` never arrives (engine hung, proxy misconfigured), don't
  // strand the user on "Connecting…" — abort and drop to the plain form.
  useEffect(() => {
    if (phase.kind !== 'connecting') return
    const t = setTimeout(() => {
      session.abort('connect-timeout')
      setPhase({ kind: 'error', reason: 'Could not reach the skill engine.' })
      onFallback?.('connect-timeout')
    }, 8000)
    return () => clearTimeout(t)
  }, [phase.kind, session, onFallback])

  // Opens the live AI session (lazy — only ever called on a real submit).
  const openAi = useCallback(
    (input: string) => {
      startedRef.current = true
      setThought('')
      setPhase({ kind: 'connecting' })
      session.open(input)
    },
    [session],
  )

  // Routes a submit from the page's fallback form: live AI conversation when AI
  // mode is on and reachable, otherwise the page's dumb write (the floor).
  const handleStart = useCallback(
    (input: string) => {
      if (mode === 'ai' && live !== false && phase.kind !== 'error') openAi(input)
      else void onPlainSubmit(input)
    },
    [mode, live, phase.kind, openAi, onPlainSubmit],
  )

  // If a caller passed initialInput and the surface mounts live in AI mode, open
  // immediately (e.g. a "spark on this" button elsewhere).
  useEffect(() => {
    if (mode === 'ai' && live === true && initialInput && !autoOpenedRef.current) {
      autoOpenedRef.current = true
      openAi(initialInput)
    }
  }, [mode, live, initialInput, openAi])

  const backToPlain = useCallback(
    (reason: string) => {
      session.abort(reason)
      startedRef.current = false
      setMode('plain')
      setPhase({ kind: 'idle' })
    },
    [session],
  )

  const resetToIdle = useCallback(() => {
    startedRef.current = false
    setThought('')
    setPhase({ kind: 'idle' })
  }, [])

  // Cancel the live conversation and return to the idle form — via the Cancel
  // button or Esc, mirroring the "stop" people expect from a chat.
  const cancel = useCallback(() => {
    session.abort('cancel')
    resetToIdle()
  }, [session, resetToIdle])

  // Esc cancels while a conversation is live (any working/asking phase).
  useEffect(() => {
    const live =
      phase.kind === 'connecting' || phase.kind === 'status' || phase.kind === 'asking'
    if (!live) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase.kind, cancel])

  // Stall watchdog: if a working phase gets no new frame for a long stretch, the
  // session is wedged (or its socket silently dropped) — fall back rather than
  // spin the ambient rotation forever. Resets whenever a new status arrives, and
  // on streamed thought frames too: a session quietly writing files while it
  // thinks out loud is alive, not stalled (`thought` is in the deps for that).
  useEffect(() => {
    if (phase.kind !== 'status') return
    const t = setTimeout(() => {
      session.abort('stall-timeout')
      setPhase({ kind: 'error', reason: 'The session stopped responding.' })
      onFallback?.('stall-timeout')
    }, 90_000)
    return () => clearTimeout(t)
  }, [phase, thought, session, onFallback])

  // --- Plain mode / auto-fallback: render the page's own form ----------------
  // Plain when: the user chose plain, the probe came back not-live, or a run
  // errored. The plain `start` runs the page's own dumb path.
  const showPlain = mode === 'plain' || live === false || phase.kind === 'error'
  if (showPlain) {
    // AI-only surfaces own no fallback form — the page's editor below is the permanent
    // floor (and no toggle: there is no plain mode to switch to on this surface).
    if (aiOnly) {
      // A run that died while the engine is still reachable must not dead-end the
      // surface: offer the page's start card again so the user can relaunch — skills
      // are idempotent, so a rerun picks up where the dead one left off. `openAi`
      // directly, not `handleStart`: its error-phase guard would route the retry to
      // the plain submit, which is a no-op on an AI-only surface.
      if (phase.kind === 'error' && live !== false) {
        return (
          <div className="flex flex-col gap-3">
            {fallback({ start: openAi, disabled: false })}
            <p className="text-center text-xs text-text-muted">
              The AI run stopped — starting again picks up where it left off.
            </p>
          </div>
        )
      }
      // The engine is genuinely unreachable: a compact note, not a form.
      return (
        <p className="text-center text-xs text-text-muted">
          AI setup unavailable — edit directly below.
        </p>
      )
    }
    return (
      <div className="flex flex-col gap-3">
        <SurfaceBar
          mode={mode}
          setMode={(m) => {
            if (m === 'plain' && startedRef.current) session.abort('toggled-plain')
            setMode(m)
            if (m === 'ai') resetToIdle()
          }}
          live={live}
          disabledAi={live === false}
        />
        {fallback({ start: handleStart, disabled: false })}
        {phase.kind === 'error' && (
          <p className="text-center text-xs text-text-muted">
            The AI stopped — your spark is still here. Save it below, or switch back to AI to retry.
          </p>
        )}
      </div>
    )
  }

  // --- AI mode ---------------------------------------------------------------
  return (
    <div className="flex flex-col gap-4">
      {!aiOnly && (
        <SurfaceBar
          mode={mode}
          setMode={(m) => {
            if (m === 'plain' && startedRef.current) session.abort('toggled-plain')
            setMode(m)
            if (m === 'ai') resetToIdle()
          }}
          live={live}
          disabledAi={false}
        />
      )}

      {phase.kind === 'idle' && fallback({ start: handleStart, disabled: live === null })}

      {phase.kind === 'connecting' && <WorkingState message="Connecting…" hints={workingHints} />}

      {phase.kind === 'status' && (
        <WorkingState message={phase.message} thought={thought} hints={workingHints} />
      )}

      {phase.kind === 'asking' && phase.turn.type === 'ask_text' && (
        <AskTextTurn
          turn={phase.turn}
          onSubmit={(value) => {
            session.sendText(phase.turn.id, value)
            setPhase({ kind: 'status', message: 'Thinking…' })
          }}
        />
      )}

      {phase.kind === 'asking' && phase.turn.type === 'ask_choice' && (
        <AskChoiceTurn
          turn={phase.turn}
          onChoice={(selected) => {
            session.sendChoice(phase.turn.id, selected)
            setPhase({ kind: 'status', message: 'Thinking…' })
          }}
          onFreeText={(value) => {
            session.sendText(phase.turn.id, value)
            setPhase({ kind: 'status', message: 'Thinking…' })
          }}
        />
      )}

      {phase.kind === 'resolved' && (
        <ResultCard result={phase.result} onReset={resetToIdle} actions={resultActions} />
      )}

      {(phase.kind === 'connecting' || phase.kind === 'status' || phase.kind === 'asking') && (
        <button
          type="button"
          onClick={cancel}
          className="mx-auto text-xs text-text-subtle transition-colors hover:text-text-muted"
        >
          Cancel <span className="opacity-60">· Esc</span>
        </button>
      )}
    </div>
  )
}

// --- Liveness dot + AI/plain toggle -----------------------------------------

function SurfaceBar({
  mode,
  setMode,
  live,
  disabledAi,
}: {
  mode: 'ai' | 'plain'
  setMode: (m: 'ai' | 'plain') => void
  live: boolean | null
  disabledAi: boolean
}) {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="inline-flex overflow-hidden rounded-lg bg-surface-sunken p-0.5">
        <button
          type="button"
          disabled={disabledAi}
          onClick={() => setMode('ai')}
          title={disabledAi ? 'AI unavailable — Claude is not reachable' : undefined}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            mode === 'ai' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text',
            disabledAi && 'cursor-not-allowed opacity-50',
          )}
        >
          <Sparkles className="size-3" />
          AI
        </button>
        <button
          type="button"
          onClick={() => setMode('plain')}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            mode === 'plain' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text',
          )}
        >
          Plain
        </button>
      </div>
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-text-subtle">
        <span
          className={cn(
            'size-1.5 rounded-full',
            live === true ? 'bg-success-fg' : 'bg-text-subtle/50',
          )}
        />
        {live === true ? 'Claude live' : live === false ? 'AI unavailable' : 'checking…'}
      </span>
    </div>
  )
}

// --- Per-message-type render helpers ----------------------------------------

function WorkingState({
  message,
  thought,
  hints,
}: {
  message: string
  thought?: string
  hints: string[]
}) {
  // Rotate ambient hints only in the quiet stretches — when the model is actually
  // streaming its reasoning, that real text is the star and the rotation stops.
  const ambient = (message === 'Working…' || message === 'Thinking…') && !thought
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!ambient) return
    const t = setInterval(() => setI((n) => (n + 1) % hints.length), 2600)
    return () => clearInterval(t)
  }, [ambient, hints.length])
  const headline = ambient ? hints[i % hints.length] : message

  // Keep the streaming transcript pinned to its latest line as tokens arrive.
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [thought])

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      {/* Signature: the spark charging — a soft halo pulses out from the AI mark. */}
      <div className="relative flex size-12 items-center justify-center">
        <span className="absolute inline-flex size-12 rounded-full bg-primary-soft opacity-60 [animation-duration:1.8s] motion-safe:animate-ping" />
        <span className="relative flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
          <Sparkles className="size-5 motion-safe:animate-pulse" />
        </span>
      </div>
      {/* key re-mounts on change so each line gently fades in. */}
      <p key={headline} className="animate-fade-in font-serif text-lg text-text-heading">
        {headline}
      </p>
      {thought && (
        <div
          ref={scrollRef}
          className="max-h-64 w-full max-w-xl overflow-y-auto rounded-lg bg-surface-sunken px-5 py-4 text-left [mask-image:linear-gradient(to_bottom,transparent,black_2rem)]"
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{thought}</p>
        </div>
      )}
    </div>
  )
}

// The visual a question is about — a rendered preview awaiting the user's approval.
// Shown at natural size up to a sane height so the user judges the actual image,
// never a description of one.
function AskImageFigure({ image }: { image: AskImage }) {
  return (
    <img
      src={image.src}
      alt={image.alt ?? ''}
      className="max-h-96 w-full rounded-lg border border-border bg-surface-sunken object-contain"
    />
  )
}

function toggle(label: string, picked: string[], setPicked: (v: string[]) => void) {
  setPicked(picked.includes(label) ? picked.filter((l) => l !== label) : [...picked, label])
}

function AskChoiceTurn({
  turn,
  onChoice,
  onFreeText,
}: {
  turn: AskChoice
  onChoice: (selected: string[]) => void
  onFreeText: (value: string) => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [freeText, setFreeText] = useState('')
  return (
    <div className="flex flex-col gap-3">
      {/* Through the shared renderer: a skill's prompt may carry markdown, which
          must never surface as literal asterisks (repo markdown rule). */}
      <div className="flex flex-col gap-2">
        <Markdown variant="prompt">{turn.prompt}</Markdown>
      </div>
      {turn.image && <AskImageFigure image={turn.image} />}
      <div className="flex flex-col gap-2">
        {turn.options.map((o) => (
          <Button
            key={o.label}
            variant="outline"
            title={o.preview}
            onClick={() =>
              turn.multiSelect ? toggle(o.label, picked, setPicked) : onChoice([o.label])
            }
            className={cn(
              'h-auto flex-col items-start gap-0.5 px-4 py-3 text-left',
              turn.multiSelect && picked.includes(o.label) && 'shadow-control-hover',
            )}
          >
            <span className="text-sm font-medium text-text">{o.label}</span>
            <span className="text-xs font-normal text-text-muted">{o.description}</span>
          </Button>
        ))}
      </div>
      {turn.multiSelect && (
        <Button size="lg" disabled={picked.length === 0} onClick={() => onChoice(picked)}>
          Use {picked.length} selected
        </Button>
      )}
      {/* Always offered, whatever the frame says: the user must never be boxed
          into the skill's options — an off-menu answer is a first-class reply. */}
      <div className="flex items-start gap-2">
        <Textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Or type your own…"
          className="min-h-0"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && freeText.trim())
              onFreeText(freeText)
          }}
        />
        <Button variant="ghost" disabled={!freeText.trim()} onClick={() => onFreeText(freeText)}>
          Use this
        </Button>
      </div>
    </div>
  )
}

function AskTextTurn({ turn, onSubmit }: { turn: AskText; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState('')
  const submit = () => {
    if (value.trim() !== '') onSubmit(value.trim())
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Markdown variant="prompt">{turn.prompt}</Markdown>
      </div>
      {turn.image && <AskImageFigure image={turn.image} />}
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={turn.placeholder ?? 'Your answer…'}
        className="min-h-24"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
        }}
      />
      <div className="flex items-center gap-3">
        <Button size="lg" disabled={value.trim() === ''} onClick={submit}>
          Send
        </Button>
        <span className="font-mono text-xs text-text-subtle">⌘ / Ctrl + Enter</span>
      </div>
    </div>
  )
}

function ResultCard({
  result,
  onReset,
  actions,
}: {
  result: Result
  onReset: () => void
  actions?: { linkLabel?: string; resetLabel?: string }
}) {
  // Every content run ends on the Queue (the review phase), so the unconfigured label
  // says so; a tenant with a different destination passes its own linkLabel.
  const derivedLabel = 'Open in Queue'
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg bg-surface p-6 text-center shadow-sm">
      <div className="flex size-11 items-center justify-center rounded-full bg-success-bg text-success-fg">
        <Check className="size-5" />
      </div>
      <p className="text-sm text-text">{result.summary}</p>
      <div className="flex items-center gap-2">
        {result.link && (
          <Button asChild variant="outline">
            <a href={result.link}>{actions?.linkLabel ?? derivedLabel}</a>
          </Button>
        )}
        <Button variant="ghost" onClick={onReset}>
          {actions?.resetLabel ?? 'New spark'}
        </Button>
      </div>
    </div>
  )
}
