import { useEffect, useState, type ReactNode } from 'react'
import { api, type Article, type ArticleStage, type ArticleSection, type ReviewStatus, type ReviewFinding } from '../lib/api'
import { useResource } from '../lib/useResource'
import { Button } from '../components/ui/button'
import { Input, Textarea } from '../components/ui/input'
import { PageHeader, EmptyState } from '../components/kit'
import { SiloBadge } from '../components/SiloBadge'
import { PillarBadge } from '../components/PillarBadge'
import { SilosInfoLink } from '../components/SilosInfoLink'
import { ChecksPanel } from '../components/ChecksPanel'
import { SkillSurface } from '../components/SkillSurface'
import { cn } from '../lib/cn'
import { FileText, ArrowUp, ArrowDown, Plus, Trash2, Check, Download, Copy } from 'lucide-react'

// Review status badge — mirrors DraftsView's REVIEW map exactly (not exported there),
// so a long-form piece reads identically to a short-form draft.
const REVIEW: Record<ReviewStatus, { label: string; dot: string; cls: string }> = {
  pending: { label: 'Not yet reviewed', dot: 'bg-text-subtle', cls: 'bg-surface-sunken text-text-muted' },
  passed: { label: 'Passed the gate', dot: 'bg-success', cls: 'bg-success-bg text-success-fg' },
  failed: { label: 'Needs changes', dot: 'bg-error', cls: 'bg-error-bg text-error-fg' },
  edited: { label: 'Edited by you', dot: 'bg-info', cls: 'bg-info-bg text-info-fg' },
}
const REVIEW_FALLBACK = { label: 'Unknown', dot: 'bg-text-subtle', cls: 'bg-surface-sunken text-text-muted' }

// Stage badge + the canonical order the Advance / Move-back control walks (5.3).
const STAGE: Record<ArticleStage, { label: string; dot: string; cls: string }> = {
  outlining: { label: 'Outlining', dot: 'bg-text-subtle', cls: 'bg-surface-sunken text-text-muted' },
  outlined: { label: 'Outlined', dot: 'bg-info', cls: 'bg-info-bg text-info-fg' },
  drafting: { label: 'Drafting', dot: 'bg-warning', cls: 'bg-warning-bg text-warning-fg' },
  drafted: { label: 'Drafted', dot: 'bg-warning', cls: 'bg-warning-bg text-warning-fg' },
  reviewed: { label: 'Reviewed', dot: 'bg-success', cls: 'bg-success-bg text-success-fg' },
  exported: { label: 'Exported', dot: 'bg-primary-ink', cls: 'bg-primary-soft text-primary-ink' },
}
export const STAGE_ORDER: ArticleStage[] = ['outlining', 'outlined', 'drafting', 'drafted', 'reviewed', 'exported']

// Per-mode ambient hints for the articles surface's working state.
const OUTLINE_HINTS = ['Reading your idea', 'Reading the piece kind', 'Shaping the argument', 'Drafting the outline']
const SECTION_HINTS = ['Loading your voice card', 'Reading the outline', 'Writing the section', 'Saving the draft']
const REFINE_HINTS = ['Loading your voice card', 'Reading the section', 'Sharpening the language', 'Saving the change']

// Local field label helper (kit.tsx exports no Field; DraftsView defines its own).
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">{label}</label>
      {children}
    </div>
  )
}

function ArticleEditor({
  article,
  onChanged,
  onDeleted,
}: {
  article: Article
  onChanged: () => void
  onDeleted: () => void
}) {
  const [sections, setSections] = useState<ArticleSection[]>(article.sections)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  // Two-click delete confirm, matching the Feeds screen: first click arms, second deletes.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [title, setTitle] = useState(article.title)
  const [slug, setSlug] = useState(article.slug)
  const [targetKeyword, setTargetKeyword] = useState(article.targetKeyword)
  const [searchIntent, setSearchIntent] = useState(article.searchIntent)
  const [metaDescription, setMetaDescription] = useState(article.metaDescription)
  const [lengthTarget, setLengthTarget] = useState(String(article.lengthTarget ?? ''))
  const [savingMeta, setSavingMeta] = useState(false)

  const [findings, setFindings] = useState<ReviewFinding[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportPath, setExportPath] = useState<string | null>(article.exportPath)

  // One `articles` skill drives this surface; the buttons only vary the directive and the
  // local mode (hints + result copy). Each bump remounts the surface fresh on this piece;
  // the bump is what lets the same button re-trigger. Mirrors QueueView.runQueue.
  const [aiMode, setAiMode] = useState<'outline' | 'section' | 'refine'>('outline')
  const [surfaceInput, setSurfaceInput] = useState<string | undefined>(undefined)
  const [surfaceKey, setSurfaceKey] = useState(0)
  function runArticles(mode: 'outline' | 'section' | 'refine', input: string) {
    setAiMode(mode)
    setSurfaceInput(input)
    setSurfaceKey((k) => k + 1)
  }
  function developOutline() {
    runArticles(
      'outline',
      `Develop the outline for the article whose id is ${article.id} (title: "${article.title}"). ` +
        `Do not ask which piece — use this one. Read its queue item and the piece-kind guidance, ` +
        `then draw out the section headings and intents and set the slug.`,
    )
  }
  function draftSections() {
    runArticles(
      'section',
      `Draft the sections for the article whose id is ${article.id}. Do not ask which piece — use this one. ` +
        `Load the voice card, then write each section's body from its intent, one section at a time, and fill the meta description.`,
    )
  }
  function refineSection() {
    runArticles(
      'refine',
      `Refine a section of the article whose id is ${article.id}. Do not ask which piece — use this one. ` +
        `Load the voice card, ask me which section to sharpen and what to change, then write it back.`,
    )
  }

  const review = REVIEW[article.reviewStatus] ?? REVIEW_FALLBACK
  const stage = STAGE[article.stage] ?? STAGE.outlining
  const stageIdx = STAGE_ORDER.indexOf(article.stage)
  const nextStage = stageIdx >= 0 && stageIdx < STAGE_ORDER.length - 1 ? STAGE_ORDER[stageIdx + 1] : null
  const prevStage = stageIdx > 0 ? STAGE_ORDER[stageIdx - 1] : null

  useEffect(() => {
    setSections(article.sections)
    setTitle(article.title)
    setSlug(article.slug)
    setTargetKeyword(article.targetKeyword)
    setSearchIntent(article.searchIntent)
    setMetaDescription(article.metaDescription)
    setLengthTarget(String(article.lengthTarget ?? ''))
    setExportPath(article.exportPath)
    setNote(null)
    setConfirmingDelete(false)
    // Clear any stale directive so a remount can't target the previously-open piece.
    setSurfaceInput(undefined)
  }, [article])

  async function deleteArticle() {
    setDeleting(true)
    try {
      await api.deleteArticle(article.id)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  function patchSection(i: number, patch: Partial<ArticleSection>) {
    setSections((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  }
  function moveSection(i: number, dir: -1 | 1) {
    setSections((cur) => {
      const j = i + dir
      if (j < 0 || j >= cur.length) return cur
      const next = cur.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  function removeSection(i: number) {
    setSections((cur) => cur.filter((_, idx) => idx !== i))
  }
  function addSection() {
    setSections((cur) => [...cur, { id: crypto.randomUUID(), heading: '', intent: '', body: '' }])
  }
  async function saveSections() {
    setBusy(true)
    try {
      await api.setArticleSections(article.id, sections)
      setNote('Outline saved.')
      onChanged()
    } finally {
      setBusy(false)
    }
  }
  async function saveMeta() {
    setSavingMeta(true)
    try {
      await api.updateArticle(article.id, {
        title,
        slug,
        targetKeyword,
        searchIntent,
        metaDescription,
        lengthTarget: Number(lengthTarget) || 0,
      })
      setNote('Fields saved.')
      onChanged()
    } finally {
      setSavingMeta(false)
    }
  }
  async function setStageTo(next: ArticleStage) {
    setBusy(true)
    try {
      await api.updateArticle(article.id, { stage: next })
      onChanged()
    } finally {
      setBusy(false)
    }
  }
  async function runExport() {
    setExporting(true)
    try {
      const res = await api.exportArticle(article.id)
      setExportPath(res.exportPath)
      setNote('Exported.')
      onChanged()
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    const assembled = [title, ...sections.map((s) => `${s.heading}\n${s.body}`)].join('\n\n').trim()
    if (!assembled) {
      setFindings([])
      setReviewing(false)
      return
    }
    setReviewing(true)
    let live = true
    const timer = setTimeout(() => {
      api
        .postReview(assembled, false)
        .then((f) => {
          if (live) {
            setFindings(f)
            setReviewing(false)
          }
        })
        .catch(() => {
          if (live) setReviewing(false)
        })
    }, 400)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [title, sections])

  const HINTS = aiMode === 'section' ? SECTION_HINTS : aiMode === 'refine' ? REFINE_HINTS : OUTLINE_HINTS

  return (
    <div className="flex flex-col gap-5">
      {/* AI surface — one `articles` skill; buttons vary the directive + mode and remount via
          surfaceKey. aiOnly: the outline and SEO panes below are the permanent plain floor. On
          each step it reloads so results land live. */}
      <SkillSurface
        key={surfaceKey}
        skillName="articles"
        aiOnly
        initialInput={surfaceInput}
        workingHints={HINTS}
        resultActions={aiMode === 'outline' ? { resetLabel: 'Develop again' } : { resetLabel: 'Done' }}
        onProgress={onChanged}
        onResult={onChanged}
        onPlainSubmit={() => {
          /* No plain path — the panes below are the floor; aiOnly never calls this. */
        }}
        fallback={({ disabled }) => (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface p-4 shadow-sm">
            <span className="mr-1 text-xs text-text-subtle">Work this piece with AI, in your voice:</span>
            <Button size="sm" variant="outline" disabled={disabled} onClick={developOutline}>
              Develop the outline
            </Button>
            <Button size="sm" variant="outline" disabled={disabled} onClick={draftSections}>
              Draft a section
            </Button>
            <Button size="sm" variant="outline" disabled={disabled} onClick={refineSection}>
              Refine with AI
            </Button>
          </div>
        )}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="flex flex-col gap-5 rounded-lg bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="font-serif text-lg leading-snug text-text-strong">{article.title || '(untitled)'}</span>
              <div className="flex flex-wrap items-center gap-2">
                <SiloBadge silo={article.silo} />
                <PillarBadge pillar={article.pillar} />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', stage.cls)}>
                <span className={cn('size-1.5 rounded-full', stage.dot)} />
                {stage.label}
              </span>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', review.cls)}>
                <span className={cn('size-1.5 rounded-full', review.dot)} />
                {review.label}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => prevStage && setStageTo(prevStage)}
                  disabled={busy || !prevStage}
                  className="text-[11px] text-text-subtle underline-offset-2 hover:text-text hover:underline disabled:opacity-40"
                >
                  Move back
                </button>
                <button
                  type="button"
                  onClick={() => nextStage && setStageTo(nextStage)}
                  disabled={busy || !nextStage}
                  className="text-[11px] text-primary-ink underline-offset-2 hover:underline disabled:opacity-40"
                >
                  {nextStage ? `Advance to ${STAGE[nextStage].label}` : 'Exported'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                Outline &amp; sections
              </span>
              <span className="font-mono text-[11px] text-text-subtle">Stored on the article (database)</span>
            </div>
            {sections.length === 0 ? (
              <p className="rounded-lg bg-surface-nested px-4 py-3 text-sm text-text-muted">
                No sections yet. Add one by hand, or develop the outline with AI.
              </p>
            ) : (
              sections.map((s, i) => (
                <div key={s.id} className="flex flex-col gap-2 rounded-lg bg-surface-nested p-4">
                  <div className="flex items-center gap-2">
                    <Input
                      value={s.heading}
                      onChange={(e) => patchSection(i, { heading: e.target.value })}
                      placeholder="Section heading"
                      className="font-serif"
                    />
                    <button
                      type="button"
                      onClick={() => moveSection(i, -1)}
                      disabled={i === 0}
                      className="rounded-md p-1.5 text-text-subtle hover:bg-row-hover disabled:opacity-40"
                      aria-label="Move up"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(i, 1)}
                      disabled={i === sections.length - 1}
                      className="rounded-md p-1.5 text-text-subtle hover:bg-row-hover disabled:opacity-40"
                      aria-label="Move down"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSection(i)}
                      className="rounded-md p-1.5 text-text-subtle hover:bg-row-hover hover:text-error-fg"
                      aria-label="Remove section"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <Input
                    value={s.intent}
                    onChange={(e) => patchSection(i, { intent: e.target.value })}
                    placeholder="Intent — what this section must accomplish"
                    className="text-sm"
                  />
                  <Textarea
                    value={s.body}
                    onChange={(e) => patchSection(i, { body: e.target.value })}
                    placeholder="Body — the written markdown (empty until drafted)"
                    className="min-h-32 font-serif text-[15px] leading-relaxed"
                  />
                </div>
              ))
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" onClick={addSection}>
                <Plus className="size-3.5" /> Add section
              </Button>
              <Button size="sm" disabled={busy} onClick={saveSections}>
                <Check className="size-3.5" /> {busy ? 'Saving…' : 'Save outline'}
              </Button>
              {note && (
                <span className="inline-flex items-center gap-1 text-sm text-success-fg">
                  <Check className="size-4" /> {note}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
          <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-sm">
            <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">SEO &amp; meta</span>
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="font-serif" />
            </Field>
            <Field label="Target keyword — captured at intake">
              <Input value={targetKeyword} onChange={(e) => setTargetKeyword(e.target.value)} />
            </Field>
            <Field label="Search intent — captured at intake">
              <Textarea value={searchIntent} onChange={(e) => setSearchIntent(e.target.value)} className="min-h-16" />
            </Field>
            <Field label="Meta description — filled at draft (150–160 chars)">
              <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} className="min-h-16" />
              <span className="font-mono text-[11px] text-text-subtle">{metaDescription.length} chars</span>
            </Field>
            <Field label="Slug — set at outline">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono text-sm" />
            </Field>
            <Field label="Length target — words (guidance, not a gate)">
              <Input value={lengthTarget} onChange={(e) => setLengthTarget(e.target.value)} inputMode="numeric" />
            </Field>
            <Button size="sm" variant="outline" disabled={savingMeta} onClick={saveMeta}>
              <Check className="size-3.5" /> {savingMeta ? 'Saving…' : 'Save fields'}
            </Button>
            <p className="font-mono text-[11px] leading-relaxed text-text-subtle">
              These fields live on the article. Title, meta description, target keyword, slug, and the
              export date land in the Markdown frontmatter.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-sm">
            <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">Export</span>
            <Button size="sm" disabled={exporting} onClick={runExport}>
              <Download className="size-3.5" /> {exporting ? 'Exporting…' : 'Export as Markdown'}
            </Button>
            {exportPath && (
              <div className="flex flex-col gap-1.5 rounded-lg bg-surface-nested px-3 py-2.5">
                <span className="font-mono text-[11px] text-text-subtle">Written to</span>
                <div className="flex items-start gap-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-[11px] text-text-muted">{exportPath}</code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(exportPath)}
                    className="shrink-0 rounded-md p-1 text-text-subtle hover:bg-row-hover hover:text-text"
                    aria-label="Copy path"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
              </div>
            )}
            <p className="font-mono text-[11px] leading-relaxed text-text-subtle">
              Writes a local Markdown file to <code>data/exports/</code> (gitignored) and shows its path —
              not a browser download. Re-exporting overwrites the same file.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-mono text-[11px] text-text-subtle">
              Voice check — the active profile's voice card (authored via <code>setup</code> / the <code>voice</code> skill). Advisory.
            </span>
            <ChecksPanel findings={findings} loading={reviewing} />
          </div>

          <div className="flex flex-col gap-2 rounded-lg bg-surface p-5 shadow-sm">
            <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
              Delete
            </span>
            {confirmingDelete ? (
              <>
                <p className="text-xs leading-relaxed text-text-muted">
                  Removes this piece and the queue idea it grew from. The raw spark capture stays in
                  the database log. This cannot be undone.
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="destructive" disabled={deleting} onClick={deleteArticle}>
                    <Trash2 className="size-3.5" /> {deleting ? 'Deleting…' : 'Yes, delete it'}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={deleting} onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="self-start"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="size-3.5" /> Delete article
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ArticlesView() {
  const { data, loading, error, reload } = useResource(() => api.getArticles())
  const articles = data ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [current, setCurrent] = useState<Article | null>(null)

  useEffect(() => {
    setSelectedId((prev) => prev ?? (articles.length > 0 ? articles[0].id : null))
  }, [articles])
  useEffect(() => {
    if (selectedId === null) {
      setCurrent(null)
      return
    }
    api.getArticle(selectedId).then(setCurrent)
  }, [selectedId])

  // Reload the list AND re-fetch the open piece so a save or an AI write is reflected in
  // the editor, not just the list — the DraftsView.refresh contract.
  function refresh() {
    reload()
    if (selectedId) api.getArticle(selectedId).then(setCurrent)
  }

  // After a delete the piece is gone: drop the selection (the articles effect will pick
  // the next piece, if any) and reload the list.
  function handleDeleted() {
    setSelectedId(null)
    setCurrent(null)
    reload()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pipeline · Long-form"
        title="Articles"
        description="Long-form pieces for the active profile. Build the outline, write each section in your voice, review, then export a Markdown file. Nothing publishes automatically."
        actions={
          <Button asChild size="sm">
            <a href="#/spark">New article</a>
          </Button>
        }
      />

      {error ? (
        <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">
          Couldn't load articles. {error}
        </div>
      ) : loading && !data ? (
        // Skeleton only on FIRST load — a background refresh must keep the editor mounted
        // so an in-flight AI session isn't aborted (the DraftsView reason).
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <div className="h-64 skeleton rounded-lg" />
          <div className="h-96 skeleton rounded-lg" />
        </div>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-5" />}
          title="No long-form pieces yet"
          hint="Start a long-form piece from Spark — the keyword and search intent you give at intake seed the article."
          action={
            <Button asChild size="sm" variant="outline">
              <a href="#/spark">Go to Spark</a>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <div className="flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
            <div className="flex flex-col gap-1.5 rounded-lg bg-surface p-3 shadow-sm">
              {articles.map((a) => {
                const rev = REVIEW[a.reviewStatus] ?? REVIEW_FALLBACK
                const st = STAGE[a.stage] ?? STAGE.outlining
                const on = selectedId === a.id
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={cn(
                      'flex flex-col gap-1.5 rounded-md px-3 py-2.5 text-left outline-none transition-colors',
                      on ? 'bg-selected-bg' : 'hover:bg-row-hover',
                    )}
                  >
                    <span className={cn('line-clamp-2 font-serif text-sm leading-snug', on ? 'text-primary-ink' : 'text-text')}>
                      {a.title || '(untitled)'}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <SiloBadge silo={a.silo} />
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', st.cls)}>
                        <span className={cn('size-1 rounded-full', st.dot)} />
                        {st.label}
                      </span>
                      <span className={cn('size-1.5 rounded-full', rev.dot)} title={rev.label} />
                    </div>
                    {a.targetKeyword && (
                      <span className="font-mono text-[11px] text-text-subtle">Keyword: {a.targetKeyword}</span>
                    )}
                  </button>
                )
              })}
            </div>
            <SilosInfoLink className="self-start pl-1" />
          </div>
          {current ? (
            <ArticleEditor article={current} onChanged={refresh} onDeleted={handleDeleted} />
          ) : (
            <EmptyState title="Select a piece" hint="Pick one from the list to open its outline." />
          )}
        </div>
      )}
    </div>
  )
}
