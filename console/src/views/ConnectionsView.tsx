import { useEffect, useState, type ReactNode } from 'react'
import { api, LINKEDIN_CONNECT_PATH, type Connection, type PillarInfo } from '../lib/api'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from '../components/ui/select'
import { PageHeader } from '../components/kit'
import { cn } from '../lib/cn'
import { getCapabilities, capabilityAvailable, toggleOn, setToggle, type Capability } from '../lib/capabilities'
import { Linkedin, MessageCircle, Twitter, Rss, Loader2, AlertCircle, ExternalLink } from 'lucide-react'

const SIDEBAR_KEY = 'console-sidebar-collapsed'
const PILLAR_KEY = 'console-default-pillar'
const ALL_PILLARS = '__all__'

// Relative-time formatter for connectedAt, matching how the rest of the console
// renders machine timestamps (mono, "N days ago").
function relativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

// Initials fallback so a missing/broken avatar never breaks the layout.
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

type LinkedInState = 'not-connected' | 'connected' | 'error'

// The numbered steps to get a working LinkedIn app before Connect will succeed.
// Kept short and secondary — this is not a substitute for the full Docs guide.
const SETUP_STEPS = [
  'Create an app at developer.linkedin.com.',
  'Associate the app with a Company Page (LinkedIn requires one).',
  'Add the "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn" products.',
  'Add the redirect URL http://localhost:5174/api/auth/linkedin/callback.',
  'Put all three in the root .env — LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REDIRECT_URI (the redirect URL above). Connect stays off until all three are set.',
  'Restart the server, then hit Connect LinkedIn.',
]

// One capability row: its label + description, and either an on/off switch (when
// the connection's scopes grant it) or an "unavailable"/"needs scope" pill. Driven
// entirely by the capabilities registry, so it is not LinkedIn-specific.
function CapabilityRow({ platform, cap, available }: { platform: string; cap: Capability; available: boolean }) {
  const [on, setOn] = useState(() => toggleOn(platform, cap.key))
  function flip(next: boolean) {
    setToggle(platform, cap.key, next)
    setOn(next)
  }
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text-strong">{cap.label}</span>
        <span className="text-sm text-text-muted">{cap.description}</span>
      </div>
      {cap.unavailable ? (
        <span
          title={cap.unavailable}
          className="mt-0.5 shrink-0 rounded-full bg-surface-sunken px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-text-subtle"
        >
          Unavailable
        </span>
      ) : !available ? (
        <span className="mt-0.5 shrink-0 rounded-full bg-surface-sunken px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-text-subtle">
          Needs scope
        </span>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={cap.label}
          onClick={() => flip(!on)}
          className={cn(
            'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
            on ? 'bg-primary' : 'bg-surface-sunken',
          )}
        >
          <span
            className={cn(
              'inline-block size-5 rounded-full bg-surface shadow-sm transition-transform',
              on ? 'translate-x-5' : 'translate-x-0.5',
            )}
          />
        </button>
      )}
    </div>
  )
}

// "What you can do" — the capability list for any connected platform. Renders
// nothing for a platform with no registry entry, so it is safe to drop into any
// platform card as more integrations land.
function CapabilityList({ platform, scopes }: { platform: string; scopes: string[] }) {
  const caps = getCapabilities(platform)
  if (caps.length === 0) return null
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
      <p className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">What you can do</p>
      <div className="flex flex-col gap-3">
        {caps.map((cap) => (
          <CapabilityRow key={cap.key} platform={platform} cap={cap} available={capabilityAvailable(cap, scopes)} />
        ))}
      </div>
    </div>
  )
}

function LinkedInCard({
  connection,
  onRefetch,
  hadError,
  onNavigate,
}: {
  connection: Connection | undefined
  onRefetch: () => void
  hadError: boolean
  onNavigate?: (key: string) => void
}) {
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const isConnected = connection?.connected === true
  const state: LinkedInState = isConnected ? 'connected' : hadError ? 'error' : 'not-connected'

  function onConnect() {
    // A real OAuth handshake, not a fetch: navigate a new tab to the server
    // route, which redirects to LinkedIn's consent screen and closes itself
    // on callback. Status is picked up by the window-focus refresh below.
    window.open(LINKEDIN_CONNECT_PATH, '_blank', 'noopener')
  }

  async function onDisconnect() {
    setDisconnecting(true)
    try {
      await api.disconnectLinkedin()
      onRefetch()
    } finally {
      setDisconnecting(false)
    }
  }

  function openSetupGuide() {
    window.location.hash = '#docs/connect-linkedin'
    onNavigate?.('docs')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <Linkedin className="size-5 text-[#0a66c2]" />
          <CardTitle>LinkedIn</CardTitle>
        </div>
        <CardDescription>
          Link LinkedIn to attach your author identity to drafts and publish previews.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {state === 'connected' && connection && (
          <div className="flex items-center gap-3">
            {connection.avatarUrl && !avatarBroken ? (
              <img
                src={connection.avatarUrl}
                alt={connection.displayName ?? 'LinkedIn avatar'}
                onError={() => setAvatarBroken(true)}
                className="size-11 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-11 items-center justify-center rounded-full bg-surface-sunken font-mono text-sm text-text-muted">
                {initials(connection.displayName ?? 'LI')}
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-text-strong">{connection.displayName}</span>
                <Badge className="bg-success-bg text-success-fg">Connected</Badge>
              </div>
              {connection.headline && (
                <span className="truncate text-sm text-text-muted">{connection.headline}</span>
              )}
              {connection.connectedAt != null && (
                <span className="font-mono text-xs text-text-subtle">
                  connected {relativeTime(connection.connectedAt)}
                </span>
              )}
            </div>
          </div>
        )}

        {state === 'connected' && connection && connection.scopes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {connection.scopes.map((scope) => (
              <Badge key={scope} className="bg-surface-sunken font-mono text-text-muted">
                {scope}
              </Badge>
            ))}
          </div>
        )}

        {state === 'connected' && connection && (
          <CapabilityList platform={connection.platform} scopes={connection.scopes} />
        )}

        {state === 'not-connected' && <p className="text-sm text-text-muted">Not connected.</p>}

        {state === 'error' && (
          <div className="flex items-center gap-2 rounded-lg bg-error-bg p-3 text-sm text-error-fg">
            <AlertCircle className="size-4" /> Couldn't reach the connection service.
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-col items-start gap-4">
        <div className="flex items-center gap-3">
          {state === 'connected' ? (
            <Button type="button" variant="outline" onClick={onDisconnect} disabled={disconnecting}>
              {disconnecting && <Loader2 className="size-4 animate-spin" />} Disconnect
            </Button>
          ) : state === 'error' ? (
            <Button type="button" variant="outline" onClick={onRefetch}>
              Try again
            </Button>
          ) : (
            <Button type="button" onClick={onConnect}>
              Connect LinkedIn
            </Button>
          )}
        </div>

        {state !== 'connected' && (
          <>
            <p className="text-xs text-text-subtle">
              If Connect doesn't work, the app is probably not set up yet — see the checklist below.
            </p>
            <ol className="flex flex-col gap-1 pl-4 text-xs text-text-subtle marker:text-text-subtle" style={{ listStyleType: 'decimal' }}>
              {SETUP_STEPS.map((step, i) => (
                <li key={i} className="pl-1">
                  {step}
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-4">
              <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={openSetupGuide}>
                Full setup guide →
              </Button>
              <a
                href="https://www.linkedin.com/developers/apps/new"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:text-primary-hover"
              >
                Open LinkedIn Developer Portal <ExternalLink className="size-3" />
              </a>
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  )
}

// Reddit is a manual copy-paste channel — no OAuth, no token, nothing to connect.
// This card exists so the surface is self-describing: it names the origin (manual)
// and points at where the actual send happens (the Drafts editor's Copy to publish).
function RedditManualCard({ onNavigate }: { onNavigate?: (key: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <MessageCircle className="size-5 text-[#ff4500]" />
          <CardTitle>Reddit</CardTitle>
        </div>
        <CardDescription>
          Reddit is a manual copy-paste channel — there's nothing to connect. Draft a Reddit post in the
          console, then use <span className="font-medium text-text-strong">Copy to publish</span> in the
          Drafts editor and paste it into your subreddit or profile yourself.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-muted">
          No API, no token, no automation. The console drafts and previews the post in your voice; you post it.
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => {
            window.location.hash = '#docs/publishing'
            onNavigate?.('docs')
          }}
        >
          How publishing works →
        </Button>
        <a
          href="https://www.reddit.com/submit"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink hover:text-primary-hover"
        >
          Open Reddit to post <ExternalLink className="size-3" />
        </a>
      </CardFooter>
    </Card>
  )
}

function ComingSoonCard({
  icon,
  name,
  blurb,
}: {
  icon: ReactNode
  name: string
  blurb: string
}) {
  return (
    <Card className="opacity-60">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          {icon}
          <CardTitle>{name}</CardTitle>
        </div>
        <CardDescription>{blurb}</CardDescription>
      </CardHeader>
      <CardFooter>
        <Button type="button" variant="secondary" disabled className="cursor-not-allowed">
          Coming soon
        </Button>
      </CardFooter>
    </Card>
  )
}

function PreferencesCard({ pillars }: { pillars: PillarInfo[] }) {
  // Sidebar-collapsed default reuses the key AppShell reads on mount, so toggling
  // it here sets the shell's default for the next load. Both values are benign UI
  // flags, so localStorage is the correct store — no secret or PII is involved.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  const [defaultPillar, setDefaultPillar] = useState(
    () => localStorage.getItem(PILLAR_KEY) ?? ALL_PILLARS,
  )

  function toggleCollapsed(next: boolean) {
    setCollapsed(next)
    localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
  }

  function pickPillar(value: string) {
    setDefaultPillar(value)
    localStorage.setItem(PILLAR_KEY, value)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Local UI conveniences, saved on this machine only.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-text-strong">Sidebar collapsed by default</span>
            <span className="text-sm text-text-muted">Start each session with the nav rail collapsed.</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={collapsed}
            onClick={() => toggleCollapsed(!collapsed)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
              collapsed ? 'bg-primary' : 'bg-surface-sunken',
            )}
          >
            <span
              className={cn(
                'inline-block size-5 rounded-full bg-surface shadow-sm transition-transform',
                collapsed ? 'translate-x-5' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-text-strong">Default pillar filter</span>
            <span className="text-sm text-text-muted">The pillar views start filtered to.</span>
          </div>
          <div className="w-48">
            <Select value={defaultPillar} onValueChange={pickPillar}>
              <SelectTrigger>
                <SelectValue placeholder="All pillars" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PILLARS}>All pillars</SelectItem>
                {pillars.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ConnectionsView({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [pillars, setPillars] = useState<PillarInfo[]>([])
  const [hadError, setHadError] = useState(false)

  function loadConnections() {
    setHadError(false)
    api
      .getConnections()
      .then(setConnections)
      .catch(() => setHadError(true))
  }

  useEffect(() => {
    loadConnections()
    api.getPillars().then(setPillars).catch(() => setPillars([]))
  }, [])

  // OAuth happens in a separate tab; when the user finishes there and refocuses
  // this tab, re-poll status so the card flips to connected without a manual
  // refresh.
  useEffect(() => {
    function onFocus() {
      loadConnections()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const linkedin = connections.find((c) => c.platform === 'linkedin')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="System · Connections"
        title="Connections"
        description="Where the console links to your platforms, and a couple of local preferences. Status only — the console never holds a token or password."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-3">
          <LinkedInCard connection={linkedin} onRefetch={loadConnections} hadError={hadError} onNavigate={onNavigate} />
        </div>
        <div className="lg:col-span-3">
          <RedditManualCard onNavigate={onNavigate} />
        </div>
        <ComingSoonCard
          icon={<Twitter className="size-5 text-text-muted" />}
          name="X (Twitter)"
          blurb="Cross-post and reply-guy triage."
        />
        <ComingSoonCard
          icon={<Rss className="size-5 text-text-muted" />}
          name="Newsletter"
          blurb="Long-form companion to the LinkedIn cadence."
        />
      </div>

      <PreferencesCard pillars={pillars} />

      <p className="text-sm text-text-subtle">
        The console holds connection status only. Access tokens and secrets stay server-side and never
        cross the wire to the browser.
      </p>
    </div>
  )
}
