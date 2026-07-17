import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Copy, ImageIcon, Search, Terminal as TerminalIcon, X } from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { api, type Skill } from '../lib/api'
import { isAcceptedImage, prepareTerminalImage } from '../lib/terminal-images'
import { readAll } from '../lib/terminal-buffer'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './ui/dropdown-menu'
import { Input } from './ui/input'

interface TerminalDrawerProps {
  open: boolean
  onClose: () => void
  // Called by the drawer when it must fall back to clipboard copy (backend
  // offline). Lets App.tsx reuse its existing toast.
  onFallback: (message: string) => void
}

// --- Floating-window geometry -------------------------------------------------
// The terminal is a movable, resizable window (not a full-width drawer). Its
// position/size live here and persist across opens so it reappears where you
// left it.

type Geom = { x: number; y: number; width: number; height: number }
// Interaction modes: 'move' drags the whole window; the compass directions are
// resize edges/corners ('se' = bottom-right corner, etc.).
type Mode = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const GEOM_STORAGE_KEY = 'brand-console.terminalGeometry'
const MIN_W = 360
const MIN_H = 240

// A comfortable default: centered horizontally, resting near the bottom.
function defaultGeom(): Geom {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(880, vw - 80)
  const height = Math.min(520, vh - 120)
  return {
    width,
    height,
    x: Math.max(16, Math.round((vw - width) / 2)),
    y: Math.max(16, Math.round(vh - height - 48)),
  }
}

// Keep the window on-screen and above the minimum size. Applied on every move,
// resize, and viewport change so a shrunken viewport can't strand it offscreen.
function clampGeom(g: Geom): Geom {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(Math.max(g.width, MIN_W), vw - 16)
  const height = Math.min(Math.max(g.height, MIN_H), vh - 16)
  const x = Math.min(Math.max(g.x, 0), Math.max(0, vw - width))
  const y = Math.min(Math.max(g.y, 0), Math.max(0, vh - height))
  return { x, y, width, height }
}

function loadGeom(): Geom {
  try {
    const raw = localStorage.getItem(GEOM_STORAGE_KEY)
    if (raw) return clampGeom(JSON.parse(raw) as Geom)
  } catch {
    // corrupt/absent — fall through to default
  }
  return defaultGeom()
}

// Resize handles: thin edges plus larger corners. Corners sit on top (z-10) so
// they win where they overlap an edge. Edges are inset so they never reach into
// a corner's footprint.
const HANDLES: { mode: Mode; className: string }[] = [
  { mode: 'n', className: 'top-0 inset-x-4 h-2 cursor-ns-resize' },
  { mode: 's', className: 'bottom-0 inset-x-4 h-2 cursor-ns-resize' },
  { mode: 'e', className: 'right-0 inset-y-4 w-2 cursor-ew-resize' },
  { mode: 'w', className: 'left-0 inset-y-4 w-2 cursor-ew-resize' },
  { mode: 'ne', className: 'top-0 right-0 z-10 size-4 cursor-nesw-resize' },
  { mode: 'nw', className: 'top-0 left-0 z-10 size-4 cursor-nwse-resize' },
  { mode: 'se', className: 'bottom-0 right-0 z-10 size-4 cursor-nwse-resize' },
  { mode: 'sw', className: 'bottom-0 left-0 z-10 size-4 cursor-nesw-resize' },
]

// Copy an invocation to the clipboard and toast through the hoisted handler.
// Mirrors the old runPass() pattern: writeText guarded by try/catch, toast either way.
async function copyToClipboard(text: string, onFallback: (m: string) => void) {
  try {
    await navigator.clipboard.writeText(text)
    onFallback('Terminal backend offline — command copied. Paste it into Claude Code.')
  } catch {
    onFallback(`Couldn't copy — run "${text}" in Claude Code.`)
  }
}

// Copy text lifted out of the terminal (the header's copy buttons). Separate from
// copyToClipboard above because none of this is about the backend being offline —
// it needs its own toasts.
async function copyTerminalText(text: string, label: string, onFallback: (m: string) => void) {
  if (!text) {
    onFallback(`Nothing to copy — ${label} is empty.`)
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    onFallback(`Copied ${label} to the clipboard.`)
  } catch {
    onFallback("Couldn't copy — the browser blocked clipboard access.")
  }
}

export function TerminalDrawer({ open, onClose, onFallback }: TerminalDrawerProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const [skills, setSkills] = useState<Skill[] | null>(null)
  const [skillsError, setSkillsError] = useState(false)
  const [termError, setTermError] = useState<string | null>(null)

  // Images pasted/dropped into this session. Display-only: the path is already in the
  // prompt and is the user's to edit, so dismissing a chip retracts nothing.
  const [attachments, setAttachments] = useState<{ id: string; name: string; url: string }[]>([])
  const [dragging, setDragging] = useState(false)

  // Skills dropdown is controlled so we can focus the search box on open and
  // clear the query on close. `query` filters the list by name/invocation.
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // On open, move focus from Radix's default (first item) to the search box so
  // the user can type immediately. Deferred a tick so it wins after Radix's own
  // open-focus. (This Radix version doesn't expose onOpenAutoFocus.)
  useEffect(() => {
    if (!menuOpen) return
    const id = setTimeout(() => searchRef.current?.focus(), 0)
    return () => clearTimeout(id)
  }, [menuOpen])

  // Window position/size. geomRef mirrors it so a drag can read the latest
  // geometry without re-subscribing its pointer listeners on every frame.
  const [geom, setGeom] = useState<Geom>(() => loadGeom())
  const geomRef = useRef(geom)
  useEffect(() => {
    geomRef.current = geom
  }, [geom])

  // Persist geometry so the window reopens where the user left it.
  useEffect(() => {
    try {
      localStorage.setItem(GEOM_STORAGE_KEY, JSON.stringify(geom))
    } catch {
      // storage unavailable (private mode, quota) — non-fatal
    }
  }, [geom])

  // Begin a drag (mode 'move') or resize. Listeners live on document so the
  // gesture keeps tracking even when the cursor outruns the window, and
  // preventDefault on mousedown stops the terminal from text-selecting under it.
  function startInteraction(e: React.MouseEvent, mode: Mode) {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const start = geomRef.current

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      let { x, y, width, height } = start
      if (mode === 'move') {
        x = start.x + dx
        y = start.y + dy
      } else {
        if (mode.includes('e')) width = start.width + dx
        if (mode.includes('s')) height = start.height + dy
        // West/north edges move the origin as they resize; guard the minimum so
        // dragging past it pins the far edge instead of inverting the window.
        if (mode.includes('w')) {
          width = start.width - dx
          x = width < MIN_W ? start.x + (start.width - MIN_W) : start.x + dx
        }
        if (mode.includes('n')) {
          height = start.height - dy
          y = height < MIN_H ? start.y + (start.height - MIN_H) : start.y + dy
        }
      }
      setGeom(clampGeom({ x, y, width, height }))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // Header drag — but let clicks on the chips/close button through untouched.
  function onHeaderMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    startInteraction(e, 'move')
  }

  // Fetch the repo skill/agent list on drawer-open. Server-scanned, never hardcoded.
  useEffect(() => {
    if (!open) return
    setSkills(null)
    setSkillsError(false)
    api
      .getSkills()
      .then(setSkills)
      .catch(() => setSkillsError(true))
  }, [open])

  // Mount xterm + WebSocket on open, tear both down on close. Keeps create/destroy
  // in lockstep with visibility so term.open() never runs against a null mount node.
  useEffect(() => {
    if (!open || !mountRef.current) return
    const term = new Terminal({ convertEol: true, fontFamily: 'ui-monospace, monospace', fontSize: 13 })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(mountRef.current)
    fit.fit()
    termRef.current = term
    fitRef.current = fit
    setTermError(null)

    const ws = new WebSocket(`ws://${location.host}/api/terminal`)
    wsRef.current = ws

    // On connect, send the pty its true dimensions once, then focus.
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      term.focus()
    }
    ws.onmessage = (e) => {
      const data = typeof e.data === 'string' ? e.data : ''
      // The server sends a JSON control frame {type:'error',reason} when it can't
      // spawn the pty (claude missing, not logged in, …). Surface it as an error
      // state instead of dumping the raw JSON into the terminal.
      if (data.startsWith('{"type":"error"')) {
        try {
          const msg = JSON.parse(data)
          if (msg && msg.type === 'error') {
            setTermError(typeof msg.reason === 'string' ? msg.reason : 'unknown error')
            return
          }
        } catch {
          // Not our control frame — fall through and render as terminal output.
        }
      }
      term.write(data)
    }
    ws.onerror = () => onFallback('Terminal backend unavailable — copied the command instead.')
    ws.onclose = () => {
      /* session ended; drawer close handles teardown */
    }

    // Keystrokes → WS (as if typed at the pty).
    const dataSub = term.onData((d) => ws.readyState === WebSocket.OPEN && ws.send(d))

    // Size changes → WS resize control frame. Fires whenever fit() changes dims.
    const resizeSub = term.onResize(
      ({ cols, rows }) =>
        ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'resize', cols, rows })),
    )

    return () => {
      dataSub.dispose()
      resizeSub.dispose()
      ws.close()
      term.dispose()
      termRef.current = null
      fitRef.current = null
      wsRef.current = null
    }
  }, [open, onFallback])

  // Re-fit xterm whenever the window changes size (drag-resize or viewport
  // resize). rAF lets the DOM apply the new geometry before fit() measures it.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => fitRef.current?.fit())
    return () => cancelAnimationFrame(id)
  }, [open, geom.width, geom.height])

  // Viewport resize: pull the window back on-screen, then re-fit.
  useEffect(() => {
    if (!open) return
    const onResize = () => {
      setGeom((g) => clampGeom(g))
      fitRef.current?.fit()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open])

  // Send the invocation + newline over the WS, exactly as if the user typed it and
  // pressed Enter. Backend down → clipboard fallback so the chip never silently fails.
  function runChip(skill: Skill) {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(skill.invocation + '\n')
      termRef.current?.focus()
    } else {
      copyToClipboard(skill.invocation, onFallback)
    }
  }

  // The window closed: the pty is gone, so the chips describe nothing. Revoke the object
  // URLs so the blobs can be collected. (Revoking twice is a no-op, so React's
  // StrictMode double-invoking the updater is harmless.)
  useEffect(() => {
    if (open) return
    setAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.url))
      return []
    })
  }, [open])

  // Paste and drop both land here.
  //
  // Note this reconstructs what a native terminal gets for free: dragging a file into
  // iTerm inserts its real path and claude reads that path off disk. A browser hands us
  // bytes and a bare filename, never a path — so we write a copy server-side and type
  // *that* path in. For a screenshot nothing is lost (there's no original that matters).
  // For repo files it would be a downgrade, which is why they're rejected below: typing
  // a path or using @file already reaches the live file.
  //
  // Invariant: either a chip appears AND the path is in the prompt, or neither happens.
  async function attachImage(file: File | Blob, name: string) {
    if (!isAcceptedImage(file.type)) {
      onFallback('Only images can be dropped here — type the path, or use @file for repo files.')
      return
    }
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      onFallback("Terminal isn't connected — nothing was attached.")
      return
    }
    try {
      const { dataBase64, mimeType } = await prepareTerminalImage(file)
      const { path } = await api.uploadTerminalImage(dataBase64, mimeType)
      // The upload was in flight for a while; the session may have ended meanwhile.
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        onFallback('Terminal closed before the image landed — nothing was attached.')
        return
      }
      setAttachments((prev) => [...prev, { id: path, name, url: URL.createObjectURL(file) }])
      // Trailing space so whatever gets typed next doesn't run into the path.
      ws.send(path + ' ')
      termRef.current?.focus()
    } catch (e) {
      // Never retry un-downscaled as a fallback — that reintroduces the size cliff
      // the downscale exists to avoid.
      onFallback(`Couldn't attach the image — ${(e as Error).message}`)
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find(
      (i) => i.kind === 'file' && isAcceptedImage(i.type),
    )
    // Text paste: leave it entirely to xterm.
    if (!item) return
    const file = item.getAsFile()
    if (!file) return
    e.preventDefault()
    void attachImage(file, file.name || 'pasted-image.png')
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void attachImage(file, file.name)
  }

  function onDragOver(e: React.DragEvent) {
    // Without preventDefault the browser navigates away to the dropped file.
    e.preventDefault()
    setDragging(true)
  }

  function onDragLeave(e: React.DragEvent) {
    // Ignore crossings between the window's own children; only a real exit clears it.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setDragging(false)
  }

  function dismissAttachment(id: string) {
    setAttachments((prev) => {
      prev.filter((a) => a.id === id).forEach((a) => URL.revokeObjectURL(a.url))
      return prev.filter((a) => a.id !== id)
    })
  }

  function copyEverything() {
    const term = termRef.current
    if (!term) return
    void copyTerminalText(readAll(term), 'the terminal', onFallback)
  }

  if (!open) return null

  // Filter the skill list by name/invocation for the dropdown search.
  const q = query.trim().toLowerCase()
  const filteredSkills = skills?.filter(
    (s) => s.name.toLowerCase().includes(q) || s.invocation.toLowerCase().includes(q),
  )

  return (
    // Full-screen layer is click-through (pointer-events-none) so the app behind
    // the floating window stays usable; only the window itself catches events.
    <div className="pointer-events-none fixed inset-0 z-50">
      <section
        // Capture phase, not bubble: xterm's own paste listener on its helper textarea
        // calls stopPropagation(), so a bubbling handler here would never fire. Capture
        // runs on the way down, before xterm sees the event. Text pastes fall straight
        // through to xterm untouched.
        onPasteCapture={onPaste}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`pointer-events-auto absolute flex flex-col overflow-hidden rounded-xl border bg-sidebar text-sidebar-fg shadow-lg animate-fade-in ${
          dragging ? 'border-primary ring-2 ring-primary/40' : 'border-border'
        }`}
        style={{ left: geom.x, top: geom.y, width: geom.width, height: geom.height }}
      >
        {/* Resize handles line the edges and corners of the window */}
        {HANDLES.map((h) => (
          <div
            key={h.mode}
            onMouseDown={(e) => startInteraction(e, h.mode)}
            className={`absolute ${h.className}`}
          />
        ))}
        <header
          onMouseDown={onHeaderMouseDown}
          className="flex h-12 shrink-0 cursor-move select-none items-center gap-2 border-b border-sidebar-border px-4"
        >
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-sidebar-muted">
            <TerminalIcon className="size-3.5" />
            terminal
          </div>

          <DropdownMenu
            open={menuOpen}
            onOpenChange={(o) => {
              setMenuOpen(o)
              if (!o) setQuery('') // reset the filter each time the menu closes
            }}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                // The header is the drag surface; keep mousedown here from
                // starting a window drag so the menu opens cleanly.
                onMouseDown={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-md border border-sidebar-border px-2.5 py-1 font-mono text-[11px] text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg data-[state=open]:bg-sidebar-hover data-[state=open]:text-sidebar-fg"
              >
                Skills
                <ChevronDown className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[360px]">
              {/* Pinned heading + search — stay put while the list below scrolls. */}
              <div className="px-2 pb-1.5 pt-1">
                <p className="text-xs font-medium text-text">Skills &amp; agents</p>
                <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
                  Pick one to run it in the terminal. Each drops its command into the session.
                </p>
              </div>
              <div className="relative px-1 pb-1.5">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-subtle" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search skills…"
                  className="h-8 pl-8 text-xs"
                  // Keep keystrokes in the field: stop Radix's menu typeahead and
                  // space-to-select from hijacking them. Escape still bubbles so
                  // it closes the menu; Enter runs the top match.
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') return
                    e.stopPropagation()
                    if (e.key === 'Enter' && filteredSkills && filteredSkills.length > 0) {
                      runChip(filteredSkills[0])
                      setMenuOpen(false)
                    }
                  }}
                />
              </div>
              <div className="mb-1 h-px bg-border" />
              {/* Fixed-height, scrollable skill list. */}
              <div className="h-64 overflow-y-auto">
                {skills === null && !skillsError && (
                  <p className="px-2 py-1.5 text-xs text-text-muted">Loading skills…</p>
                )}
                {skillsError && (
                  <p className="px-2 py-1.5 text-xs text-warning-fg">Couldn't load skills</p>
                )}
                {skills?.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-text-muted">No repo skills found</p>
                )}
                {skills && skills.length > 0 && filteredSkills?.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-text-muted">
                    No skills match “{query}”
                  </p>
                )}
                {filteredSkills?.map((skill) => (
                  <DropdownMenuItem
                    key={skill.name}
                    onSelect={() => runChip(skill)}
                    className="group flex-col items-start gap-0.5"
                  >
                    <span className="font-mono text-xs font-medium">{skill.invocation}</span>
                    <span className="text-[11px] leading-snug text-text-muted group-data-[highlighted]:text-selected-strong-fg">
                      {skill.description}
                    </span>
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Copy affordances — the terminal renders text you can't otherwise lift out
              without hand-selecting it. */}
          <div className="ml-auto flex items-center gap-1">
            {/* Only a whole-session copy. A 'last reply' button was tried and removed:
                Claude Code's input box is anchored, so the cursor sits in the same place
                before and after a reply and never advances past it — there's no
                cursor-derived range that spans the response. Recovering one means
                anchoring on Claude's own output markers, which silently breaks whenever
                it reformats. Drag-select + Cmd+C covers picking out one block. */}
            <button
              type="button"
              onClick={copyEverything}
              onMouseDown={(e) => e.stopPropagation()}
              title="Copy the whole session, scrollback included"
              className="inline-flex items-center gap-1.5 rounded-md border border-sidebar-border px-2.5 py-1 font-mono text-[11px] text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
            >
              <Copy className="size-3" />
              Copy all
            </button>
            <button
              type="button"
              onClick={onClose}
              onMouseDown={(e) => e.stopPropagation()}
              className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg"
              aria-label="Close terminal"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        {/* Attached images. The path is already in the prompt — these chips exist so you
            can see what you actually attached, which the bare path can't tell you. */}
        {attachments.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-sidebar-border px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wide text-sidebar-muted">
              Attached
            </span>
            {attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-sidebar-border bg-sidebar-hover py-1 pl-1 pr-1.5"
              >
                <img src={a.url} alt="" className="size-6 rounded object-cover" />
                <span className="max-w-[140px] truncate font-mono text-[11px] text-sidebar-fg">
                  {a.name}
                </span>
                <button
                  type="button"
                  onClick={() => dismissAttachment(a.id)}
                  className="rounded p-0.5 text-sidebar-muted hover:text-sidebar-fg"
                  aria-label={`Dismiss ${a.name}`}
                  title="Dismiss this chip (the path stays in the prompt — edit it there)"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {/* xterm mount point; the error overlay covers it if the pty couldn't start */}
        <div className="relative min-h-0 flex-1">
          <div ref={mountRef} className="absolute inset-0 px-3 py-2" />
          {dragging && (
            // pointer-events-none so the drop still reaches the section's handler.
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-sidebar/90 text-center">
              <ImageIcon className="size-5 text-sidebar-muted" />
              <p className="text-sm text-sidebar-fg">Drop an image to attach it</p>
              <p className="max-w-xs text-[11px] leading-snug text-sidebar-muted">
                PNG, JPEG, or WebP. For files already in the repo, type the path or use{' '}
                <code className="font-mono">@file</code> instead.
              </p>
            </div>
          )}
          {termError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-sidebar px-6 text-center">
              <p className="text-sm text-warning-fg">Terminal couldn't start</p>
              <p className="max-w-md font-mono text-[11px] text-sidebar-muted">{termError}</p>
              <p className="max-w-md text-xs text-sidebar-muted">
                Make sure the <code className="font-mono">claude</code> CLI is installed and you're
                logged in. You can still click a command above to copy it and run it in your own terminal.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
