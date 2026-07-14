import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../components/kit'
import { Markdown } from '../components/Markdown'
import { cn } from '../lib/cn'
import { getDocsByCategory, getDocs, type Doc } from '../lib/docs'

// Reads a `#docs/<slug>` hash so a doc can be deep-linked from elsewhere in the
// console (or bookmarked). Anything else on the hash is ignored.
function slugFromHash(): string | null {
  const match = window.location.hash.match(/^#docs\/(.+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

// Docs sub-nav + reader, laid out like DatabaseView's table list + data pane:
// a sticky left sidebar of categories/docs and a main pane for the selected
// doc. Content is static Markdown from src/content/docs — no API involved.
export function DocsView() {
  const grouped = useMemo(() => getDocsByCategory(), [])
  const allDocs = useMemo(() => getDocs(), [])

  const [activeSlug, setActiveSlug] = useState<string | null>(() => allDocs[0]?.slug ?? null)

  useEffect(() => {
    const fromHash = slugFromHash()
    if (fromHash && allDocs.some((d) => d.slug === fromHash)) {
      setActiveSlug(fromHash)
    }
    // Only run once on mount — after that, clicks in the sidebar own selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active: Doc | undefined = allDocs.find((d) => d.slug === activeSlug)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Docs" title={active?.title ?? 'Docs'} description="Product and setup documentation for this console." />

      <div className="grid gap-5 lg:grid-cols-[15rem_1fr]">
        {/* Doc list */}
        <aside className="flex max-h-[calc(100vh-11rem)] flex-col overflow-hidden overflow-y-auto rounded-lg bg-surface py-2 shadow-sm lg:sticky lg:top-20">
          {grouped.map(({ category, docs }) => (
            <div key={category} className="mb-1">
              <p className="px-4 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                {category}
              </p>
              {docs.map((doc) => {
                const on = activeSlug === doc.slug
                return (
                  <button
                    key={doc.slug}
                    type="button"
                    onClick={() => setActiveSlug(doc.slug)}
                    className={cn(
                      'flex w-full items-center border-l-2 px-4 py-1.5 text-left text-sm transition-colors',
                      on
                        ? 'border-l-primary bg-selected-bg font-medium text-primary-ink'
                        : 'border-l-transparent text-text-muted hover:bg-row-hover hover:text-text-strong',
                    )}
                  >
                    <span className="truncate">{doc.title}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </aside>

        {/* Doc body */}
        <div className="min-w-0 rounded-lg bg-surface p-6 shadow-sm">
          {active ? (
            <div className="flex flex-col gap-3">
              <Markdown>{active.body}</Markdown>
            </div>
          ) : (
            <p className="text-sm text-text-subtle">No docs yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
