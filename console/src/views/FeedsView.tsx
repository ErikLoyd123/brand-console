import { useEffect, useState } from 'react'
import { api, type Pillar, type NewSource, type PillarInfo, type Source } from '../lib/api'
import { useResource } from '../lib/useResource'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select'
import { PillarBadge } from '../components/PillarBadge'
import { PageHeader, SectionHeading, EmptyState } from '../components/kit'
import { SkillSurface } from '../components/SkillSurface'
import { cn } from '../lib/cn'
import { Rss, Plus, Play, Loader2, Sparkles, Pencil, Trash2, X, Check } from 'lucide-react'

// Ambient hints for the feeds walk's working state (see SkillSurface.workingHints).
const MANAGE_FEED_HINTS = ['Reading your feeds', 'Checking the feed', 'Filing it under a pillar', 'Saving to the database']

const EMPTY: NewSource = {
  kind: 'rss',
  name: '',
  url: '',
  pillar: null,
  keywords: [],
  default_tag: 'needs-your-take',
  curated: false,
  enabled: true,
}

export function FeedsView() {
  const { data, loading, error, reload } = useResource(() => api.getSources())
  const sources = data ?? []
  const [pillars, setPillars] = useState<PillarInfo[]>([])
  const [form, setForm] = useState<NewSource>(EMPTY)
  const [keywordsText, setKeywordsText] = useState('')
  const [busy, setBusy] = useState(false)
  // When set, the top form is editing this existing feed (PUT) rather than adding (POST).
  const [editingId, setEditingId] = useState<string | null>(null)
  // Two-click delete confirm: first click arms the row, second within a moment removes it.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  // Run state: the ids currently running (per-feed) plus a flag for the run-all sweep, and
  // the last run's human summary shown above the table.
  const [running, setRunning] = useState<Set<string>>(new Set())
  const [runningAll, setRunningAll] = useState(false)
  const [runMsg, setRunMsg] = useState<string | null>(null)

  useEffect(() => {
    api.getPillars().then(setPillars).catch(() => setPillars([]))
  }, [])

  function resetForm() {
    setForm(EMPTY)
    setKeywordsText('')
    setEditingId(null)
  }

  // Load an existing feed into the top form to edit it (scrolls the form into view).
  function startEdit(s: Source) {
    setForm({
      kind: s.kind,
      name: s.name,
      url: s.url ?? '',
      pillar: s.pillar,
      keywords: s.keywords ?? [],
      default_tag: s.defaultTag ?? 'needs-your-take',
      curated: Boolean((s.config as { curated?: boolean } | undefined)?.curated),
      enabled: s.enabled,
    })
    setKeywordsText((s.keywords ?? []).join(', '))
    setEditingId(s.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Add (POST) or save an edit (PUT), depending on editingId.
  async function submit() {
    if (form.name.trim() === '' || form.url.trim() === '') return
    setBusy(true)
    try {
      const keywords = keywordsText
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
      if (editingId) {
        await api.updateSource(editingId, { ...form, keywords })
      } else {
        await api.addSource({ ...form, keywords })
      }
      resetForm()
      reload()
    } finally {
      setBusy(false)
    }
  }

  async function toggleEnabled(s: Source) {
    await api.updateSource(s.id, { enabled: !s.enabled })
    reload()
  }

  async function removeFeed(id: string) {
    const res = await api.deleteSource(id)
    setConfirmDeleteId(null)
    setRunMsg(
      res.deletedItems
        ? `Removed the feed and ${res.deletedItems} of its inbox item${res.deletedItems === 1 ? '' : 's'}.`
        : 'Removed the feed.',
    )
    if (editingId === id) resetForm()
    reload()
  }

  async function runAll() {
    setRunningAll(true)
    setRunMsg(null)
    try {
      const summary = await api.runAllFeeds()
      const errs = summary.perFeed.filter((r) => r.error)
      setRunMsg(
        `Ran ${summary.perFeed.length} feed${summary.perFeed.length === 1 ? '' : 's'}: ` +
          `${summary.totalAdded} new item${summary.totalAdded === 1 ? '' : 's'} to the inbox` +
          (errs.length ? ` · ${errs.length} failed (${errs.map((e) => e.name).join(', ')})` : ''),
      )
    } catch (e) {
      setRunMsg(`Run failed: ${String((e as Error)?.message ?? e)}`)
    } finally {
      setRunningAll(false)
    }
  }

  async function runOne(id: string) {
    setRunning((s) => new Set(s).add(id))
    setRunMsg(null)
    try {
      const r = await api.runFeed(id)
      setRunMsg(
        r.error
          ? `${r.name} failed: ${r.error}`
          : `${r.name}: parsed ${r.parsed}, ${r.added} new item${r.added === 1 ? '' : 's'} to the inbox`,
      )
    } catch (e) {
      setRunMsg(`Run failed: ${String((e as Error)?.message ?? e)}`)
    } finally {
      setRunning((s) => {
        const next = new Set(s)
        next.delete(id)
        return next
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Inputs"
        title="Feeds"
        description="The RSS feeds discovery watches — stored in the database, managed entirely here. Add a feed, then run it (or run them all) to pull fresh items into the Discovery inbox."
      />

      {/* AI mode: the feeds skill (add / edit / remove). The form + table below are the
          permanent plain floor, so this surface is aiOnly (no toggle); on completion it reloads. */}
      <SkillSurface
        skillName="feeds"
        aiOnly
        workingHints={MANAGE_FEED_HINTS}
        resultActions={{ resetLabel: 'Do another' }}
        onResult={() => reload()}
        onPlainSubmit={() => {
          /* No plain path here — the form/table below are the floor; aiOnly never calls this. */
        }}
        fallback={({ start, disabled }) => (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-strong">Manage feeds with AI</p>
                <p className="text-xs text-text-subtle">
                  Add a feed from a URL (it validates and files it), or edit and remove existing
                  ones. Writes the same feeds table as the controls below.
                </p>
              </div>
            </div>
            <Button size="sm" disabled={disabled} onClick={() => start('')}>
              Start
            </Button>
          </div>
        )}
      />

      <section className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-sm">
        <SectionHeading
          title={editingId ? 'Edit feed' : 'Add a feed'}
          hint={editingId ? 'change fields and save' : 'an RSS feed URL'}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="flex flex-col gap-1">
            <Select value={form.pillar ?? ''} onValueChange={(v) => setForm({ ...form, pillar: v as Pillar })}>
              <SelectTrigger>
                <SelectValue placeholder="Pillar (optional)" />
              </SelectTrigger>
              <SelectContent>
                {pillars.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <a
              href="#/pillars"
              className="self-start text-xs text-text-subtle underline-offset-2 hover:text-text hover:underline"
            >
              Manage pillars →
            </a>
          </div>
          <Input className="sm:col-span-2" placeholder="Feed URL (https://…/feed/)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <Input
            className="sm:col-span-2"
            placeholder="Relevance keywords, comma-separated (espresso, roasting, gear…)"
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
          />
          <Select
            value={form.default_tag}
            onValueChange={(v) => setForm({ ...form, default_tag: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Default tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="needs-your-take">needs-your-take</SelectItem>
              <SelectItem value="ready-to-draft">ready-to-draft</SelectItem>
            </SelectContent>
          </Select>
          <label
            className="flex items-center gap-2 text-sm text-text-muted"
            title="A feed you trust to be on-topic — every item scores high relevance instead of keyword matching."
          >
            <input
              type="checkbox"
              checked={form.curated}
              onChange={(e) => setForm({ ...form, curated: e.target.checked })}
              className="size-4 accent-[var(--color-primary)]"
            />
            Curated (trust the feed)
          </label>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Button disabled={busy} onClick={submit}>
              {editingId ? <Check className="size-4" /> : <Plus className="size-4" />}
              {editingId ? 'Save changes' : 'Add feed'}
            </Button>
            {editingId && (
              <Button variant="ghost" disabled={busy} onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionHeading title="Feeds" hint={`${sources.length} watching`} />
          <Button size="sm" variant="outline" disabled={runningAll || sources.length === 0} onClick={runAll}>
            {runningAll ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {runningAll ? 'Running…' : 'Run all'}
          </Button>
        </div>

        {runMsg && (
          <div className="rounded-lg bg-surface-sunken px-4 py-2.5 text-xs text-text-muted shadow-sm">
            {runMsg}
          </div>
        )}

        {error ? (
          <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">
            Couldn't load feeds. {error}
          </div>
        ) : loading ? (
          <div className="h-40 skeleton rounded-lg" />
        ) : sources.length === 0 ? (
          <EmptyState icon={<Rss className="size-5" />} title="No feeds yet" hint="Add a feed above and discovery starts watching it." />
        ) : (
          <div className="overflow-hidden rounded-lg bg-surface shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-wide text-text-subtle">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Reference</th>
                  <th className="px-5 py-3 font-medium">Pillar</th>
                  <th className="px-5 py-3 font-medium">Keywords</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-row-hover">
                    <td className="px-5 py-3 font-medium text-text">{s.name}</td>
                    <td className="max-w-56 truncate px-5 py-3 text-text-muted">{s.url ?? '-'}</td>
                    <td className="px-5 py-3">{s.pillar ? <PillarBadge pillar={s.pillar} /> : '-'}</td>
                    <td className="max-w-40 truncate px-5 py-3 text-xs text-text-subtle" title={(s.keywords ?? []).join(', ')}>
                      {(s.config as { curated?: boolean } | undefined)?.curated ? (
                        <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary-ink">
                          curated
                        </span>
                      ) : (s.keywords ?? []).length ? (
                        (s.keywords ?? []).join(', ')
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => toggleEnabled(s)}
                        className="inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-text"
                        title={s.enabled ? 'Active — click to pause (excluded from runs)' : 'Paused — click to activate'}
                      >
                        <span className={cn('size-1.5 rounded-full', s.enabled ? 'bg-success' : 'bg-text-subtle')} />
                        {s.enabled ? 'Active' : 'Paused'}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={running.has(s.id) || runningAll || s.kind !== 'rss'}
                          onClick={() => runOne(s.id)}
                          title={s.kind !== 'rss' ? 'Only RSS feeds can be run here' : 'Pull fresh items from this feed'}
                        >
                          {running.has(s.id) ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Play className="size-3.5" />
                          )}
                          Run
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-text-subtle hover:text-text"
                          onClick={() => startEdit(s)}
                          title="Edit this feed"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        {confirmDeleteId === s.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-error hover:text-error"
                              onClick={() => removeFeed(s.id)}
                              title="Confirm — remove this feed and its inbox items"
                            >
                              <Check className="size-3.5" /> Delete
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              onClick={() => setConfirmDeleteId(null)}
                              title="Cancel"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-text-subtle hover:text-error"
                            onClick={() => setConfirmDeleteId(s.id)}
                            title="Remove this feed"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
