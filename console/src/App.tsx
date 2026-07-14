import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard,
  Inbox,
  ListChecks,
  PenLine,
  Send,
  Calendar,
  Layers,
  Target,
  SlidersHorizontal,
  Tags,
  Rss,
  Zap,
  Database,
  BookOpen,
  Plug2,
  Code,
  BookText,
  FileText,
  TriangleAlert,
} from 'lucide-react'
import { AppShell, type NavGroup } from './components/AppShell'
import { api, type Profile } from './lib/api'
import { OverviewView } from './views/OverviewView'
import { QueueView } from './views/QueueView'
import { SparkView } from './views/SparkView'
import { FeedsView } from './views/FeedsView'
import { DiscoveryView } from './views/DiscoveryView'
import { DraftsView } from './views/DraftsView'
import { ArticlesView } from './views/ArticlesView'
import { PublishedView } from './views/PublishedView'
import { CalendarView } from './views/CalendarView'
import { PillarsView } from './views/PillarsView'
import { IntentView } from './views/IntentView'
import { RegisterView } from './views/RegisterView'
import { TagsView } from './views/TagsView'
import { DatabaseView } from './views/DatabaseView'
import { ConnectionsView } from './views/ConnectionsView'
import { ApiReferenceView } from './views/ApiReferenceView'
import { VoiceView } from './views/VoiceView'
import { DocsView } from './views/DocsView'
import { TerminalDrawer } from './components/TerminalDrawer'

// Every nav item's key. Used to validate `#/<key>` hashes so a stray/typo'd hash
// falls back to Overview instead of rendering nothing.
const NAV_KEYS = [
  'overview',
  'discovery',
  'queue',
  'drafts',
  'articles',
  'published',
  'calendar',
  'pillars',
  'intent',
  'register',
  'tags',
  'voice',
  'feeds',
  'spark',
  'connections',
  'database',
  'apiref',
  'docs',
] as const

// Map the current URL hash to an active nav key so a refresh (or a shared link)
// restores the right view instead of snapping back to Overview.
//
// Our routes are namespaced `#/<key>`. The API Reference view (Scalar) owns bare
// `#tag/...` / `#operation/...` hashes for its own deep links, so any non-empty
// hash that isn't one of ours is treated as Scalar's and routes to apiref — that's
// why a refresh on the API docs used to land back on Overview.
function keyFromHash(): string {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return 'overview'
  if (raw.startsWith('/')) {
    // Strip any `?query` (e.g. #/queue?item=<id> deep links) before matching the key.
    const key = raw.slice(1).split('?')[0]
    return (NAV_KEYS as readonly string[]).includes(key) ? key : 'overview'
  }
  // DocsView owns `#docs/<slug>` deep links (e.g. the intents "what's this?" link).
  if (raw.startsWith('docs/')) return 'docs'
  return 'apiref'
}

// Full-width strip under the topbar shown on every view (except Voice, which is the
// setup surface itself) while the active profile is incomplete. Self-describing per
// the provenance rule: it names why content is gated and links to where to fix it.
function SetupBanner({ name, onSetup }: { name: string; onSetup: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-warning-bg px-4 py-2.5 sm:px-6 lg:px-10">
      <TriangleAlert className="size-4 shrink-0 text-warning-fg" />
      <p className="min-w-0 flex-1 text-sm text-warning-fg">
        <span className="font-semibold">{name} isn&rsquo;t set up yet</span> — drafting and review
        stay gated until its voice card and identity exist.
      </p>
      <button
        type="button"
        onClick={onSetup}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2.5 text-sm font-medium text-warning-fg outline-none ring-1 ring-inset ring-warning-fg/30 transition-colors hover:bg-warning-fg/10"
      >
        Set up voice →
      </button>
    </div>
  )
}

export default function App() {
  const [active, setActive] = useState(keyFromHash)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [backend, setBackend] = useState<'checking' | 'live' | 'offline'>('checking')
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)

  // Honest topbar signal: probe the local API once on load. checkHealth reads the
  // raw fetch result, so a down or unreachable server reports 'offline' and a live
  // server reports 'live'.
  useEffect(() => {
    api.checkHealth().then(setBackend)
  }, [])

  // Track the active profile so the shell knows when it is incomplete. Refetched on
  // every view change — a cheap local GET — so finishing setup on the Voice page and
  // navigating anywhere clears the setup banner without a hard reload.
  useEffect(() => {
    api
      .getProfiles()
      .then((profiles) => setActiveProfile(profiles.find((p) => p.active) ?? null))
      .catch(() => setActiveProfile(null))
  }, [active])

  // Setup on-ramp: when the active profile is incomplete (fresh clone, or a profile
  // just created from the switcher), land on the Voice page — it doubles as the setup
  // surface until the profile is populated. Only fires when the user hasn't deep-linked
  // somewhere specific (no hash / the default Overview), so explicit navigation wins.
  useEffect(() => {
    api
      .getProfiles()
      .then((profiles) => {
        const activeProfile = profiles.find((p) => p.active)
        if (!activeProfile || activeProfile.complete) return
        const raw = window.location.hash.replace(/^#/, '')
        if (!raw || raw === '/' || raw === '/overview') navigate('voice')
      })
      .catch(() => {})
  }, [])

  // Keep the active view in sync with the URL hash. Covers browser back/forward and
  // any hash the API Reference (Scalar) writes while the user reads the docs.
  useEffect(() => {
    const onHashChange = () => setActive(keyFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Navigating writes the hash; the hashchange listener above updates `active`. This
  // keeps the URL the single source of truth so refresh/deep-links stay honest.
  function navigate(key: string) {
    window.location.hash = `/${key}`
  }

  // Sidebar + pipeline counts come from the real list endpoints so the chrome
  // reflects actual state. A failed probe yields a missing badge count, never a
  // fabricated one.
  useEffect(() => {
    Promise.all([
      api.getInbox({ state: 'inbox' }).catch(() => []),
      api.getQueue().catch(() => []),
      api.getDrafts().catch(() => []),
      api.getArticles().catch(() => []),
      api.getPosts().catch(() => []),
    ]).then(([inbox, queue, drafts, articles, posts]) => {
      setCounts({
        discovery: inbox.length,
        queue: queue.length,
        drafts: drafts.length,
        articles: articles.length,
        published: posts.length,
      })
    })
  }, [active])

  const groups: NavGroup[] = useMemo(
    () => [
      {
        label: 'Pipeline',
        items: [
          { key: 'overview', label: 'Overview', icon: <LayoutDashboard /> },
          { key: 'discovery', label: 'Discovery', icon: <Inbox />, count: counts.discovery },
          { key: 'queue', label: 'Queue', icon: <ListChecks />, count: counts.queue },
          { key: 'drafts', label: 'Drafts', icon: <PenLine />, count: counts.drafts },
          { key: 'articles', label: 'Articles', icon: <FileText />, count: counts.articles },
          { key: 'published', label: 'Published', icon: <Send />, count: counts.published },
        ],
      },
      {
        label: 'Insights',
        items: [
          { key: 'calendar', label: 'Calendar', icon: <Calendar /> },
          { key: 'pillars', label: 'Pillars', icon: <Layers /> },
          { key: 'intent', label: 'Intent', icon: <Target /> },
          { key: 'register', label: 'Register', icon: <SlidersHorizontal /> },
          { key: 'tags', label: 'Tags', icon: <Tags /> },
        ],
      },
      {
        label: 'Inputs',
        items: [
          { key: 'voice', label: 'Voice', icon: <BookOpen /> },
          { key: 'feeds', label: 'Feeds', icon: <Rss /> },
          { key: 'spark', label: 'Spark', icon: <Zap /> },
        ],
      },
      {
        label: 'System',
        items: [
          { key: 'connections', label: 'Connections', icon: <Plug2 /> },
          { key: 'database', label: 'Database', icon: <Database /> },
          { key: 'apiref', label: 'API Reference', icon: <Code /> },
        ],
      },
      {
        label: 'Docs',
        items: [{ key: 'docs', label: 'Docs', icon: <BookText /> }],
      },
    ],
    [counts],
  )

  // Fallback surfaced by the terminal drawer when the backend is offline: show the
  // message it hands up, reusing the toast machinery the old runPass() used.
  function showFallback(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 3200)
  }

  return (
    <AppShell
      groups={groups}
      active={active}
      onNavigate={navigate}
      onToggleTerminal={() => setTerminalOpen((o) => !o)}
      backend={backend}
      wide={active === 'database' || active === 'apiref'}
      notice={
        activeProfile && !activeProfile.complete && active !== 'voice' ? (
          <SetupBanner name={activeProfile.name} onSetup={() => navigate('voice')} />
        ) : undefined
      }
    >
      {active === 'overview' && <OverviewView onNavigate={navigate} counts={counts} />}
      {active === 'discovery' && <DiscoveryView />}
      {active === 'queue' && <QueueView />}
      {active === 'drafts' && <DraftsView />}
      {active === 'articles' && <ArticlesView />}
      {active === 'published' && <PublishedView />}
      {active === 'calendar' && <CalendarView />}
      {active === 'pillars' && <PillarsView />}
      {active === 'intent' && <IntentView />}
      {active === 'register' && <RegisterView />}
      {active === 'tags' && <TagsView />}
      {active === 'feeds' && <FeedsView />}
      {active === 'spark' && <SparkView />}
      {active === 'database' && <DatabaseView />}
      {active === 'connections' && <ConnectionsView onNavigate={navigate} />}
      {active === 'apiref' && <ApiReferenceView />}
      {active === 'voice' && <VoiceView />}
      {active === 'docs' && <DocsView />}

      <TerminalDrawer
        open={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        onFallback={showFallback}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-up rounded-lg bg-sidebar px-4 py-2.5 text-sm text-sidebar-fg shadow-lg lg:left-auto lg:right-8 lg:translate-x-0">
          {toast}
        </div>
      )}
    </AppShell>
  )
}
