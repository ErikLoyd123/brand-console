import { useEffect, useRef, useState } from 'react'
import { api, type InboxItem, type Source, type Tag, type Silo, type ContentPlatform } from '../lib/api'
import { getConsoleSilos } from '../lib/silos'
import { SiloPicker } from '../components/SiloPicker'
import { SilosInfoLink } from '../components/SilosInfoLink'
import { SkillSurface } from '../components/SkillSurface'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select'
import { PillarBadge } from '../components/PillarBadge'
import { TagPicker, feedItemTagHandlers } from '../components/TagPicker'
import { PageHeader, ScoreChip, EmptyState } from '../components/kit'
import { cn } from '../lib/cn'
import { Inbox, Search, ArrowRight, Archive, Bookmark, BookmarkMinus, ChevronRight, ChevronLeft, ChevronsDownUp, ChevronsUpDown, Sparkles } from 'lucide-react'

type GroupBy = 'source' | 'date' | 'pillar'
type InboxView = 'inbox' | 'saved'
interface SourceInfo { name: string; pillar: string | null }

const GROUP_PAGE_SIZE = 12

// Ambient hints for the discovery walk's working state (see SkillSurface.workingHints).
const WORKUP_HINTS = ['Reading the piece', 'Finding your angle', 'Drawing out your take', 'Shaping the beats']

function dateBucket(ts: number): string {
  const day = 24 * 60 * 60 * 1000
  const diff = Date.now() - ts
  if (diff < day) return 'Today'
  if (diff < 7 * day) return 'This week'
  return 'Earlier'
}

function InboxCard({
  item,
  source,
  view,
  onChanged,
  onWorkUp,
  vocabulary,
  onVocabularyChange,
}: {
  item: InboxItem
  source: SourceInfo | undefined
  view: InboxView
  onChanged: () => void
  onWorkUp: () => void
  vocabulary: Tag[]
  onVocabularyChange: () => void
}) {
  const [take, setTake] = useState('')
  // Feed items carry no platform field yet, so every one is a LinkedIn candidate until
  // discovery gains a platform axis of its own.
  const platform: ContentPlatform = 'linkedin'
  const roster = getConsoleSilos(platform)
  // Feed promotes default to Teach; the writer can retarget the intent before it lands.
  const [silo, setSilo] = useState<Silo>('teach')
  const [busy, setBusy] = useState(false)

  // If the chosen platform's roster doesn't carry the current silo (a stale value
  // from a different platform's roster), reset to that roster's default so an invalid
  // cross-platform intent can never be submitted.
  useEffect(() => {
    if (!roster.some((m) => m.key === silo)) setSilo(roster[0]?.key ?? 'teach')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform])
  const dateLabel = new Date(item.publishedAt ?? item.fetchedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

  async function archive() {
    setBusy(true)
    try {
      await api.archiveItem(item.id)
      onChanged()
    } finally {
      setBusy(false)
    }
  }
  async function promote() {
    if (take.trim() === '') return
    setBusy(true)
    try {
      await api.promoteItem(item.id, take, silo)
      onChanged()
    } finally {
      setBusy(false)
    }
  }
  async function save() {
    setBusy(true)
    try {
      await api.saveItem(item.id)
      onChanged()
    } finally {
      setBusy(false)
    }
  }
  async function unsave() {
    setBusy(true)
    try {
      await api.unsaveItem(item.id)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex flex-1 flex-col gap-2">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="font-serif text-base leading-snug text-text-strong hover:text-primary-ink">
              {item.title}
            </a>
          ) : (
            <span className="font-serif text-base leading-snug text-text-strong">{item.title}</span>
          )}
          {item.summary && <p className="line-clamp-2 text-sm leading-relaxed text-text-muted">{item.summary}</p>}
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wide text-text-subtle">
              {source?.name ?? 'Unknown'} · {dateLabel}
            </span>
            {source?.pillar && <PillarBadge pillar={source.pillar} />}
            <TagPicker
              attached={item.tags}
              vocabulary={vocabulary}
              onVocabularyChange={onVocabularyChange}
              {...feedItemTagHandlers(item.id, onChanged)}
            />
          </div>
        </div>
        {item.score != null && <ScoreChip score={item.score} />}
      </div>
      <div className="flex flex-col gap-2.5">
        <Input
          value={take}
          onChange={(e) => setTake(e.target.value)}
          placeholder="Add your take to promote this into the queue"
        />
        {/* The AI alternative to typing a take: discovery reads the piece, draws out your take and
            points, and promotes it — the deliberate sibling of this card's plain Promote path. */}
        <button
          type="button"
          onClick={onWorkUp}
          disabled={busy}
          className="inline-flex items-center gap-1 self-start text-xs font-medium text-primary-ink transition-colors hover:underline disabled:opacity-50"
        >
          <Sparkles className="size-3.5" /> Work up with AI
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wide text-text-subtle">Intent</span>
              <SiloPicker value={silo} onChange={setSilo} platform={platform} />
            </label>
            <SilosInfoLink />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || take.trim() === ''} onClick={promote}>
              Promote <ArrowRight className="size-3.5" />
            </Button>
            {view === 'inbox' ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={save}
                title="Save for later — keep it on your shortlist without a take yet"
              >
                <Bookmark className="size-3.5" /> Save
              </Button>
            ) : (
              <Button size="sm" variant="ghost" disabled={busy} onClick={unsave} title="Move back to the inbox">
                <BookmarkMinus className="size-3.5" /> Unsave
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy} onClick={archive}>
              <Archive className="size-3.5" /> Archive
            </Button>
          </div>
        </div>
      </div>
    </article>
  )
}

export function DiscoveryView() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [group, setGroup] = useState<GroupBy>('source')
  const [view, setView] = useState<InboxView>('inbox')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [groupPage, setGroupPage] = useState<Record<string, number>>({})
  // The shared discovery AI surface: a per-card "Work up with AI" sets the directive (targeting
  // that feed item by id) and bumps surfaceKey to remount the surface on it. The cards below are
  // the permanent plain floor, so this never blocks the manual type-a-take Promote path.
  const [surfaceInput, setSurfaceInput] = useState<string | undefined>(undefined)
  const [surfaceKey, setSurfaceKey] = useState(0)
  const surfaceRef = useRef<HTMLDivElement>(null)

  function load() {
    setLoading(true)
    api
      .getInbox({ group, tags: selectedTags, q, state: view })
      .then((rows) => {
        setItems(rows)
        setError(null)
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [group, view, selectedTags, q])
  function reloadTags() {
    api.getTags().then(setTags).catch(() => setTags([]))
  }
  useEffect(() => {
    api.getSources().then(setSources).catch(() => setSources([]))
    reloadTags()
  }, [])
  // Changing the grouping axis rebuilds the section keys, so reset collapse state.
  useEffect(() => setCollapsed(new Set()), [group])
  // Any change to the visible item set resets per-group paging to page 1.
  useEffect(() => setGroupPage({}), [group, selectedTags, q])

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  function setPage(key: string, page: number) {
    setGroupPage((prev) => ({ ...prev, [key]: page }))
  }
  function triggerWorkUp(input: string) {
    setSurfaceInput(input)
    setSurfaceKey((k) => k + 1)
    surfaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  function workUp(item: InboxItem) {
    triggerWorkUp(
      `Work up the Discovery feed item whose id is ${item.id} (title: "${item.title}"). ` +
        `Do not ask which item — use this one. Read it and its source, infer the intent and ` +
        `confirm it, draw out my take and the 2-4 points, then promote it into the queue.`,
    )
  }
  function workUpGeneric() {
    triggerWorkUp('List my Discovery inbox best-first and ask which item to work up.')
  }

  const sourceInfo = new Map<string, SourceInfo>(sources.map((s) => [s.id, { name: s.name, pillar: s.pillar }]))
  function toggleTag(id: string) {
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))
  }
  function groupKey(item: InboxItem): string {
    if (group === 'source') return sourceInfo.get(item.sourceId)?.name ?? 'Unknown source'
    if (group === 'pillar') return sourceInfo.get(item.sourceId)?.pillar ?? 'No pillar'
    return dateBucket(item.publishedAt ?? item.fetchedAt)
  }
  const groups = new Map<string, InboxItem[]>()
  for (const item of items) {
    const key = groupKey(item)
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }

  const groupKeys = [...groups.keys()]
  const allCollapsed = groupKeys.length > 0 && groupKeys.every((k) => collapsed.has(k))
  function toggleAll() {
    setCollapsed(allCollapsed ? new Set() : new Set(groupKeys))
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pipeline · Inbox"
        title="Discovery"
        description={
          view === 'inbox'
            ? 'Everything the feeds pulled in, waiting on you. Archive the noise, save keepers for later, or promote one with a take.'
            : 'Your shortlist — kept for later without a take yet. Promote one with a take when you’re ready, or send it back to the inbox.'
        }
        actions={
          <div className="flex items-center gap-3">
            {groupKeys.length > 1 && (
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-text shadow-control transition-shadow hover:shadow-control-hover"
              >
                {allCollapsed ? (
                  <>
                    <ChevronsUpDown className="size-3.5" /> Expand all
                  </>
                ) : (
                  <>
                    <ChevronsDownUp className="size-3.5" /> Collapse all
                  </>
                )}
              </button>
            )}
            <span className="font-mono text-xs tabular-nums text-text-subtle">
              {items.length} {view === 'inbox' ? 'in inbox' : 'saved'}
            </span>
          </div>
        }
      />

      {/* Inbox / Saved segmented toggle */}
      <div className="inline-flex self-start overflow-hidden rounded-lg bg-surface-sunken p-0.5">
        {(['inbox', 'saved'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
              view === v ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text',
            )}
          >
            {v === 'inbox' ? <Inbox className="size-3.5" /> : <Bookmark className="size-3.5" />}
            {v === 'inbox' ? 'Inbox' : 'Saved'}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={group} onValueChange={(v) => setGroup(v as GroupBy)}>
            <SelectTrigger className="sm:w-52">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="source">Group by source</SelectItem>
              <SelectItem value="date">Group by date</SelectItem>
              <SelectItem value="pillar">Group by pillar</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle" />
            <Input
              placeholder="Search title or summary"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          {/* Sources and their pillars are owned by the Feeds page; this is the jump-off. */}
          <a
            href="#/feeds"
            className="shrink-0 text-xs text-text-subtle underline-offset-2 hover:text-text hover:underline"
          >
            Manage feeds →
          </a>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => {
              const on = selectedTags.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium outline-none transition-colors',
                    on ? 'bg-selected-strong text-selected-strong-fg' : 'bg-surface-sunken text-text-muted hover:bg-row-hover',
                  )}
                >
                  {t.name}
                </button>
              )
            })}
            {/* The tag vocabulary is owned by the Tags page; filtering here only reads it. */}
            <a
              href="#/tags"
              className="text-xs text-text-subtle underline-offset-2 hover:text-text hover:underline"
            >
              Manage tags →
            </a>
          </div>
        )}
      </div>

      {/* AI mode: one surface running `discovery` (read the piece → draw out the take + beats →
          promote into the queue), driven by the per-card "Work up with AI" buttons (each targets
          a feed item by id and remounts via surfaceKey). The cards below are the permanent plain
          floor (type a take, hit Promote), so this surface is aiOnly; each step reloads so a
          promote lands live and leaves the inbox. */}
      <div ref={surfaceRef}>
        <SkillSurface
          key={surfaceKey}
          skillName="discovery"
          aiOnly
          initialInput={surfaceInput}
          workingHints={WORKUP_HINTS}
          resultActions={{ linkLabel: 'Open in Queue', resetLabel: 'Work up another' }}
          onProgress={load}
          onResult={load}
          onPlainSubmit={() => {
            /* No plain path — the cards below are the floor; aiOnly never calls this. */
          }}
          fallback={({ disabled }) => (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-strong">Work up an item with AI</p>
                  <p className="text-xs text-text-subtle">
                    Hit <span className="font-medium">Work up with AI</span> on any item below to
                    draw out your take and points and promote it — or start here and pick one.
                  </p>
                </div>
              </div>
              <Button size="sm" disabled={disabled} onClick={workUpGeneric}>
                Start
              </Button>
            </div>
          )}
        />
      </div>

      {error && <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">{error}</div>}

      {!error && loading && items.length === 0 && (
        <div className="grid items-start gap-3 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 skeleton rounded-lg" />
          ))}
        </div>
      )}

      {!error && !loading && items.length === 0 && (
        view === 'inbox' ? (
          <EmptyState
            icon={<Inbox className="size-5" />}
            title="Inbox zero"
            hint="Nothing to triage. Run a discovery pass to pull in fresh material."
          />
        ) : (
          <EmptyState
            icon={<Bookmark className="size-5" />}
            title="Nothing saved yet"
            hint="Save an inbox item for later and it lands here — a shortlist you promote when you're ready."
          />
        )
      )}

      {[...groups.entries()].map(([key, list]) => {
        const isCollapsed = collapsed.has(key)
        const pageCount = Math.ceil(list.length / GROUP_PAGE_SIZE)
        const page = Math.min(groupPage[key] ?? 0, Math.max(0, pageCount - 1))
        const start = page * GROUP_PAGE_SIZE
        const pageItems = list.slice(start, start + GROUP_PAGE_SIZE)
        return (
          <section key={key} className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => toggleGroup(key)}
              className="group flex w-full items-center gap-2.5 rounded-lg bg-surface px-4 py-3 text-left shadow-sm outline-none transition-colors hover:bg-row-hover"
            >
              <ChevronRight
                className={cn('size-4 shrink-0 text-text-subtle transition-transform', !isCollapsed && 'rotate-90')}
              />
              <h2 className="text-sm font-semibold text-text-strong group-hover:text-primary-ink">{key}</h2>
              <span className="ml-auto rounded-full bg-surface-sunken px-2 py-0.5 font-mono text-xs tabular-nums text-text-subtle">
                {list.length}
              </span>
            </button>

            {!isCollapsed && (
              <div className="flex flex-col gap-3 pl-6">
                <div className="grid items-start gap-3 xl:grid-cols-2">
                  {pageItems.map((item) => (
                    <InboxCard
                      key={item.id}
                      item={item}
                      source={sourceInfo.get(item.sourceId)}
                      view={view}
                      onChanged={load}
                      onWorkUp={() => workUp(item)}
                      vocabulary={tags}
                      onVocabularyChange={reloadTags}
                    />
                  ))}
                </div>
                {pageCount > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs tabular-nums text-text-subtle">
                      {start + 1}–{Math.min(start + GROUP_PAGE_SIZE, list.length)} of {list.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={page === 0}
                        onClick={() => setPage(key, page - 1)}
                        className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1 text-xs text-text shadow-control transition-shadow hover:shadow-control-hover disabled:opacity-40"
                      >
                        <ChevronLeft className="size-3.5" /> Prev
                      </button>
                      <span className="font-mono text-xs tabular-nums text-text-subtle">
                        {page + 1}/{pageCount}
                      </span>
                      <button
                        type="button"
                        disabled={page >= pageCount - 1}
                        onClick={() => setPage(key, page + 1)}
                        className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1 text-xs text-text shadow-control transition-shadow hover:shadow-control-hover disabled:opacity-40"
                      >
                        Next <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
