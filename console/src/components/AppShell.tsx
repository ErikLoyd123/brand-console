import { useEffect, useState, type ReactNode } from 'react'
import { Menu, X, PanelLeftClose, PanelLeft, TerminalSquare, ChevronsUpDown, Check, Plus, Trash2 } from 'lucide-react'
import { cn } from '../lib/cn'
import { api, type Profile } from '../lib/api'

export interface NavItem {
  key: string
  label: string
  icon: ReactNode
  count?: number
}
export interface NavGroup {
  label: string
  items: NavItem[]
}

interface AppShellProps {
  groups: NavGroup[]
  active: string
  onNavigate: (key: string) => void
  onToggleTerminal?: () => void
  // Topbar honesty badge: 'live' when the local API health probe answered,
  // 'offline' when the local API is unreachable and screens show their error
  // state, 'checking' before the probe resolves.
  backend?: 'checking' | 'live' | 'offline'
  // Data-dense views (the database browser) use the full content width; the
  // editorial dashboards stay capped for readable line lengths.
  wide?: boolean
  // App-level notice rendered full-width between the topbar and the content on
  // every view (e.g. the incomplete-profile setup banner). Absent = no strip.
  notice?: ReactNode
  children: ReactNode
}

function KindPill({ kind }: { kind: 'personal' | 'brand' }) {
  return (
    <span className="rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-sidebar-subtle ring-1 ring-inset ring-sidebar-border">
      {kind}
    </span>
  )
}

// Sidebar-top profile switcher. Lists every profile (getProfiles), shows the active one as
// the trigger, and on select PUTs the active profile then hard-reloads so every profile-
// scoped view refetches. "New profile" creates an empty profile (name + kind) via
// createProfile — the server makes it active, so the reload lands in the new profile and
// the onboarding gate offers setup. Self-describing per the provenance rule: it names
// where profiles live and how they are populated.
function ProfileSwitcher({ collapsed }: { collapsed: boolean }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<'personal' | 'brand'>('brand')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Profile | null>(null)

  function loadProfiles() {
    api.getProfiles().then(setProfiles).catch(() => setProfiles([]))
  }

  useEffect(loadProfiles, [])

  const active = profiles.find((p) => p.active) ?? null
  const initial = (active?.name ?? '?').trim().charAt(0).toUpperCase() || '?'

  function select(id: string) {
    if (active && id === active.id) {
      setOpen(false)
      return
    }
    api.setActiveProfile(id).then(() => window.location.reload())
  }

  function create() {
    const name = newName.trim()
    if (name === '' || busy) return
    setBusy(true)
    api
      .createProfile({ name, kind: newKind })
      .then(() => window.location.reload())
      .catch(() => setBusy(false))
  }

  function destroy(profile: Profile) {
    if (busy) return
    setBusy(true)
    api
      .deleteProfile(profile.id)
      .then(() => {
        setDeleting(null)
        setBusy(false)
        loadProfiles()
      })
      .catch(() => setBusy(false))
  }

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={collapsed ? active?.name ?? 'Profile' : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md py-1.5 text-left outline-none transition-colors hover:bg-sidebar-hover',
          collapsed ? 'justify-center px-0' : 'px-2',
        )}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-active-bg text-xs font-semibold text-sidebar-fg">
          {initial}
        </span>
        {!collapsed && (
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold tracking-tight">{active?.name ?? 'No profile'}</span>
              {active && <KindPill kind={active.kind} />}
            </span>
            <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-sidebar-subtle">
              content engine
            </span>
          </span>
        )}
        {!collapsed && <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-sidebar-subtle" />}
      </button>

      {open && deleting && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-lg border border-sidebar-border bg-sidebar p-3 shadow-lg">
          <p className="text-sm font-medium text-sidebar-fg">Delete {deleting.name}?</p>
          <p className="mt-1 text-[11px] leading-snug text-sidebar-subtle">
            Removes everything it owns — queue, drafts, articles, feeds, tags — and its{' '}
            <code className="font-mono">profiles/&lt;slug&gt;/</code> folder from disk. This cannot
            be undone.
          </p>
          <div className="mt-2 flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className="rounded-md px-2 py-1 text-xs text-sidebar-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => destroy(deleting)}
              className="rounded-md px-2 py-1 text-xs font-medium text-warning-fg transition-colors hover:bg-sidebar-hover disabled:opacity-40"
            >
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}

      {open && !deleting && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-lg border border-sidebar-border bg-sidebar p-1 shadow-lg">
          {profiles.map((p) => (
            <div key={p.id} className="group flex items-center rounded-md transition-colors hover:bg-sidebar-hover">
              <button
                type="button"
                onClick={() => select(p.id)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-sidebar-muted outline-none transition-colors group-hover:text-sidebar-fg"
              >
                <span className="flex size-5 shrink-0 items-center justify-center">
                  {p.active && <Check className="size-3.5 text-sidebar-rail" />}
                </span>
                <span className="truncate">{p.name}</span>
                <KindPill kind={p.kind} />
                {!p.complete && (
                  <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-warning-fg">setup</span>
                )}
              </button>
              {!p.active && (
                <button
                  type="button"
                  onClick={() => setDeleting(p)}
                  title={`Delete ${p.name}`}
                  className="mr-1 hidden shrink-0 rounded p-1 text-sidebar-subtle transition-colors hover:text-warning-fg group-hover:block"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          {creating ? (
            <div className="flex flex-col gap-1.5 border-t border-sidebar-border px-2 pb-1 pt-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                placeholder="Profile name"
                className="w-full rounded-md border border-sidebar-border bg-transparent px-2 py-1 text-sm text-sidebar-fg outline-none placeholder:text-sidebar-subtle"
              />
              <div className="flex items-center gap-1">
                {(['brand', 'personal'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setNewKind(k)}
                    className={cn(
                      'rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ring-1 ring-inset transition-colors',
                      newKind === k
                        ? 'bg-sidebar-active-bg text-sidebar-fg ring-sidebar-rail'
                        : 'text-sidebar-subtle ring-sidebar-border hover:text-sidebar-fg',
                    )}
                  >
                    {k}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={create}
                  disabled={newName.trim() === '' || busy}
                  className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-sidebar-fg transition-colors hover:bg-sidebar-hover disabled:opacity-40"
                >
                  {busy ? 'Creating…' : 'Create'}
                </button>
              </div>
              <p className="text-[11px] leading-snug text-sidebar-subtle">
                Created empty and made active — run <code className="font-mono">setup</code> to give it a
                voice and pillars.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 rounded-md border-t border-sidebar-border px-2 py-1.5 text-left text-sm text-sidebar-muted outline-none transition-colors hover:bg-sidebar-hover hover:text-sidebar-fg"
            >
              <span className="flex size-5 shrink-0 items-center justify-center">
                <Plus className="size-3.5" />
              </span>
              New profile
            </button>
          )}
          <p className="border-t border-sidebar-border px-2 pb-1 pt-2 text-[11px] leading-snug text-sidebar-subtle">
            Profiles live in <code className="font-mono">profiles/&lt;slug&gt;/</code> and are populated with
            the <code className="font-mono">setup</code> skill.
          </p>
        </div>
      )}
    </div>
  )
}

function NavButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-md py-2 text-sm outline-none transition-colors',
        collapsed ? 'justify-center px-0' : 'px-3',
        active
          ? 'bg-sidebar-active-bg font-medium text-sidebar-fg shadow-[inset_2px_0_0_var(--color-sidebar-rail)]'
          : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg',
      )}
    >
      <span className={cn('flex size-4 shrink-0 items-center justify-center [&_svg]:size-4', active && 'text-sidebar-rail')}>
        {item.icon}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && item.count != null && item.count > 0 && (
        <span className="ml-auto font-mono text-[11px] tabular-nums text-sidebar-subtle">{item.count}</span>
      )}
    </button>
  )
}

function SidebarBody({
  groups,
  active,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[]
  active: string
  collapsed: boolean
  onNavigate: (key: string) => void
}) {
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          {!collapsed && (
            <p className="px-3 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-subtle">
              {group.label}
            </p>
          )}
          {group.items.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              active={active === item.key}
              collapsed={collapsed}
              onClick={() => onNavigate(item.key)}
            />
          ))}
        </div>
      ))}
    </nav>
  )
}

function BackendBadge({ status }: { status: 'checking' | 'live' | 'offline' }) {
  if (status === 'live') {
    return (
      <span
        title="Connected to the local API."
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-success-fg"
      >
        <span className="size-1.5 rounded-full bg-success" />
        BACKEND LIVE
      </span>
    )
  }
  if (status === 'offline') {
    return (
      <span
        title="Local API not reachable — screens show their error state. Run `npm run server`."
        className="inline-flex items-center gap-1.5 rounded-md bg-warning-bg px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-warning-fg"
      >
        <span className="size-1.5 rounded-full bg-warning" />
        BACKEND OFFLINE
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-subtle">
      <span className="size-1.5 rounded-full bg-text-subtle" />
      …
    </span>
  )
}

export function AppShell({ groups, active, onNavigate, onToggleTerminal, backend, wide, notice, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('console-sidebar-collapsed') === '1',
  )
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('console-sidebar-collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  // Close the mobile drawer whenever the active view changes.
  useEffect(() => setMobileOpen(false), [active])

  const railWidth = collapsed ? 'lg:w-16' : 'lg:w-60'
  const contentPad = collapsed ? 'lg:pl-16' : 'lg:pl-60'

  return (
    <div className="min-h-full bg-background">
      {/* Sidebar (fixed on lg+) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-fg transition-[width] duration-300 lg:flex',
          railWidth,
        )}
      >
        <div className={cn('flex h-14 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'px-3')}>
          <ProfileSwitcher collapsed={collapsed} />
        </div>
        <SidebarBody groups={groups} active={active} collapsed={collapsed} onNavigate={onNavigate} />
        <div className={cn('flex items-center border-t border-sidebar-border py-3', collapsed ? 'justify-center px-0' : 'px-4')}>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-2 rounded-md p-1.5 text-sidebar-muted outline-none transition-colors hover:bg-sidebar-hover hover:text-sidebar-fg"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-overlay-scrim animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar text-sidebar-fg">
            <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
              <div className="min-w-0 flex-1">
                <ProfileSwitcher collapsed={false} />
              </div>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-fg">
                <X className="size-4" />
              </button>
            </div>
            <SidebarBody groups={groups} active={active} collapsed={false} onNavigate={onNavigate} />
          </aside>
        </div>
      )}

      {/* Content column */}
      <div className={cn('flex min-h-full flex-col transition-[padding] duration-300', contentPad)}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-text-muted hover:bg-row-hover lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <p className="hidden font-mono text-xs uppercase tracking-[0.14em] text-text-subtle sm:block">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <div className="ml-auto flex items-center gap-2">
            {backend && <BackendBadge status={backend} />}
            <button
              type="button"
              onClick={onToggleTerminal}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-fg shadow-sm outline-none transition-all hover:bg-primary-hover hover:shadow-md active:scale-[0.98]"
            >
              <TerminalSquare className="size-3.5" />
              Terminal
            </button>
          </div>
        </header>
        {notice}
        <main className={cn('mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8', wide ? 'max-w-none' : 'max-w-[100rem]')}>
          {children}
        </main>
      </div>
    </div>
  )
}
