import { useEffect, useMemo, useState } from 'react'
import {
  api,
  type DbTableInfo,
  type DbTableData,
  type DbColumn,
  type DbQueryResult,
} from '../lib/api'
import { PageHeader } from '../components/kit'
import { cn } from '../lib/cn'
import { Search, RefreshCw, Download, Terminal, Database, X, ChevronLeft, ChevronRight, Play } from 'lucide-react'

const PAGE_SIZE = 25

// ---- cell rendering -------------------------------------------------------

const BADGE_TONES: Record<string, string> = {
  active: 'bg-success-bg text-success-fg',
  passed: 'bg-success-bg text-success-fg',
  'ready-to-draft': 'bg-success-bg text-success-fg',
  failed: 'bg-error-bg text-error-fg',
  'needs-your-take': 'bg-warning-bg text-warning-fg',
  edited: 'bg-info-bg text-info-fg',
  promoted: 'bg-info-bg text-info-fg',
  seeded: 'bg-info-bg text-info-fg',
}
const BADGE_COLUMNS = new Set(['status', 'review_status', 'triage_state', 'tag', 'kind'])
const JSON_COLUMNS = new Set(['config', 'raw', 'hook_options'])

function isTimestamp(col: DbColumn): boolean {
  return /_at$|_for$/.test(col.name) && /INT/i.test(col.type)
}
function isBoolean(col: DbColumn): boolean {
  return col.name === 'enabled'
}

function Cell({ col, value }: { col: DbColumn; value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="text-text-subtle">—</span>

  if (isBoolean(col)) {
    const on = value === 1 || value === true
    return <span className={on ? 'text-success-fg' : 'text-text-muted'}>{on ? 'Yes' : 'No'}</span>
  }
  if (isTimestamp(col) && typeof value === 'number') {
    return (
      <span className="tabular-nums text-text-muted">
        {new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>
    )
  }
  if (BADGE_COLUMNS.has(col.name)) {
    const key = String(value)
    return (
      <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-medium', BADGE_TONES[key] ?? 'bg-surface-sunken text-text-muted')}>
        {key}
      </span>
    )
  }
  if (JSON_COLUMNS.has(col.name)) {
    const str = typeof value === 'string' ? value : JSON.stringify(value)
    const short = str.length > 40 ? str.slice(0, 40) + '…' : str
    return (
      <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-text-muted" title={str}>
        {short}
      </code>
    )
  }
  // id / slug / *_id / external_id → code chip
  if (col.pk || /(_id$|^id$|^slug$|_ref$)/.test(col.name)) {
    const str = String(value)
    return (
      <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-text" title={str}>
        {str.length > 20 ? str.slice(0, 8) + '…' + str.slice(-4) : str}
      </code>
    )
  }
  if (typeof value === 'number') return <span className="tabular-nums">{value}</span>
  const str = String(value)
  return <span title={str.length > 80 ? str : undefined}>{str.length > 80 ? str.slice(0, 80) + '…' : str}</span>
}

// ---- SQL editor modal -----------------------------------------------------

function SqlModal({ onClose }: { onClose: () => void }) {
  const [sql, setSql] = useState('select id, pillar, score, status\nfrom idea_queue_items\norder by score desc\nlimit 25;')
  const [result, setResult] = useState<DbQueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const r = await api.runDbQuery(sql)
      if (r.error) {
        setError(r.error)
        setResult(null)
      } else {
        setResult(r)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-overlay-scrim animate-fade-in" onClick={onClose} />
      <div className="relative z-10 flex max-h-full w-full max-w-4xl flex-col gap-4 overflow-hidden rounded-lg bg-surface-raised p-5 shadow-xl animate-fade-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="size-4 text-primary-ink" />
            <h2 className="text-sm font-semibold text-text-strong">SQL editor</h2>
            <span className="font-mono text-[11px] uppercase tracking-wide text-text-subtle">read-only</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-text-muted hover:bg-row-hover">
            <X className="size-4" />
          </button>
        </div>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          spellCheck={false}
          className="min-h-32 w-full resize-none rounded-lg bg-surface p-3 font-mono text-sm text-text shadow-control outline-none focus-visible:shadow-control-hover"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run()
          }}
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg shadow-sm transition-all hover:bg-primary-hover hover:shadow-md active:scale-[0.98] disabled:opacity-50"
          >
            <Play className="size-3.5" /> Run
          </button>
          <span className="font-mono text-xs text-text-subtle">⌘ / Ctrl + Enter · SELECT queries only</span>
        </div>

        {error && <div className="rounded-lg bg-error-bg p-3 font-mono text-xs text-error-fg">{error}</div>}

        {result && (
          <div className="min-h-0 flex-1 overflow-auto rounded-lg shadow-control">
            {result.rows.length === 0 ? (
              <div className="p-6 text-center text-sm text-text-muted">No rows returned.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-sunken">
                  <tr>
                    {result.columns.map((c) => (
                      <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-mono font-semibold text-text-strong">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className={cn(i % 2 ? 'bg-surface-sunken/40' : 'bg-surface', 'hover:bg-row-hover')}>
                      {result.columns.map((c) => (
                        <td key={c} className="max-w-[320px] truncate whitespace-nowrap px-3 py-1.5 font-mono text-text-muted">
                          {row[c] === null || row[c] === undefined ? (
                            <span className="italic text-text-subtle">null</span>
                          ) : (
                            String(typeof row[c] === 'object' ? JSON.stringify(row[c]) : row[c])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {result && (
          <p className="font-mono text-xs text-text-subtle">
            {result.rows.length} rows{result.truncated ? ' (truncated at 1,000)' : ''}
          </p>
        )}
      </div>
    </div>
  )
}

// ---- main view ------------------------------------------------------------

export function DatabaseView() {
  const [tables, setTables] = useState<DbTableInfo[]>([])
  const [categoryOrder, setCategoryOrder] = useState<string[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [tableSearch, setTableSearch] = useState('')
  const [data, setData] = useState<DbTableData | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [sort, setSort] = useState<string | null>(null)
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')
  const [offset, setOffset] = useState(0)
  const [sqlOpen, setSqlOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tablesError, setTablesError] = useState<string | null>(null)

  useEffect(() => {
    api
      .getDbTables()
      .then((r) => {
        setTables(r.tables)
        setCategoryOrder(r.categoryOrder)
        if (r.tables.length) setActive((prev) => prev ?? r.tables[0].name)
      })
      .catch((e: unknown) => setTablesError(String(e)))
  }, [])

  // Reset filters/sort/page whenever the active table changes.
  useEffect(() => {
    setFilters({})
    setSort(null)
    setDir('asc')
    setOffset(0)
  }, [active])

  useEffect(() => {
    if (!active) return
    setLoading(true)
    api
      .getDbTable(active, { limit: PAGE_SIZE, offset, sort: sort ?? undefined, dir, filters })
      .then(setData)
      .finally(() => setLoading(false))
  }, [active, offset, sort, dir, filters])

  const grouped = useMemo(() => {
    const q = tableSearch.toLowerCase()
    const filtered = tables.filter((t) => t.label.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
    const map = new Map<string, DbTableInfo[]>()
    for (const t of filtered) {
      const list = map.get(t.category) ?? []
      list.push(t)
      map.set(t.category, list)
    }
    return [...map.entries()].sort((a, b) => {
      const d = categoryOrder.indexOf(a[0]) - categoryOrder.indexOf(b[0])
      return d !== 0 ? d : a[0].localeCompare(b[0])
    })
  }, [tables, tableSearch, categoryOrder])

  const filterCols = data?.columns.filter((c) => !JSON_COLUMNS.has(c.name)).slice(0, 4) ?? []

  function toggleSort(colName: string) {
    if (sort === colName) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(colName)
      setDir('asc')
    }
    setOffset(0)
  }

  function refresh() {
    if (!active) return
    setLoading(true)
    api.getDbTable(active, { limit: PAGE_SIZE, offset, sort: sort ?? undefined, dir, filters }).then(setData).finally(() => setLoading(false))
  }

  async function exportCsv() {
    if (!active || !data) return
    const full = await api.getDbTable(active, { limit: 500, offset: 0, sort: sort ?? undefined, dir, filters })
    const cols = full.columns.map((c) => c.name)
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [cols.join(','), ...full.rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${active}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const total = data?.filteredCount ?? 0
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, total)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="System"
        title="Database"
        description="Browse the local content-engine store, read-only. Every table the agents and the console share."
        actions={
          <div className="flex items-center gap-2">
            <button type="button" onClick={exportCsv} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface px-3 text-sm text-text shadow-control transition-shadow hover:shadow-control-hover">
              <Download className="size-3.5" /> Export CSV
            </button>
            <button type="button" onClick={refresh} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface px-3 text-sm text-text shadow-control transition-shadow hover:shadow-control-hover">
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} /> Refresh
            </button>
            <button type="button" onClick={() => setSqlOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-fg shadow-sm transition-all hover:bg-primary-hover hover:shadow-md">
              <Terminal className="size-3.5" /> SQL editor
            </button>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[15rem_1fr]">
        {/* Table list */}
        <aside className="flex max-h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-lg bg-surface shadow-sm lg:sticky lg:top-20">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-subtle" />
              <input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search tables..."
                className="w-full rounded-md bg-surface-sunken py-1.5 pl-8 pr-3 text-sm text-text outline-none placeholder:text-text-subtle focus-visible:shadow-control"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {grouped.map(([category, list]) => (
              <div key={category} className="mb-1">
                <p className="px-4 pb-1 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                  {category}
                </p>
                {list.map((t) => {
                  const on = active === t.name
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setActive(t.name)}
                      title={t.description}
                      className={cn(
                        'flex w-full items-center justify-between border-l-2 px-4 py-1.5 text-sm transition-colors',
                        on
                          ? 'border-l-primary bg-selected-bg font-medium text-primary-ink'
                          : 'border-l-transparent text-text-muted hover:bg-row-hover hover:text-text-strong',
                      )}
                    >
                      <span className="truncate">{t.label}</span>
                      <span
                        className={cn(
                          'ml-2 min-w-7 shrink-0 rounded-full px-1.5 py-0.5 text-center font-mono text-[11px] tabular-nums',
                          on ? 'bg-primary-soft text-primary-ink' : 'bg-surface-sunken text-text-subtle',
                        )}
                      >
                        {t.rowCount.toLocaleString()}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* Data area */}
        <div className="flex min-w-0 flex-col gap-4">
          {data && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <h2 className="font-serif text-lg text-text-strong">{data.label}</h2>
                  {data.description && <p className="text-sm text-text-muted">{data.description}</p>}
                </div>
                <span className="font-mono text-xs tabular-nums text-text-subtle">
                  {data.filteredCount.toLocaleString()}
                  {data.filteredCount !== data.rowCount ? ` of ${data.rowCount.toLocaleString()}` : ''} rows
                </span>
              </div>

              {/* Filters */}
              {filterCols.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {filterCols.map((c) => (
                    <div key={c.name} className="relative min-w-44 flex-1">
                      <input
                        value={filters[c.name] ?? ''}
                        onChange={(e) => {
                          setFilters((f) => ({ ...f, [c.name]: e.target.value }))
                          setOffset(0)
                        }}
                        placeholder={`Filter by ${c.name}...`}
                        className="w-full rounded-lg bg-surface px-3 py-1.5 text-sm text-text shadow-control outline-none placeholder:text-text-subtle focus-visible:shadow-control-hover"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Grid */}
              <div className="overflow-x-auto rounded-lg bg-surface shadow-sm">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      {data.columns.map((c) => (
                        <th
                          key={c.name}
                          onClick={() => toggleSort(c.name)}
                          className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle hover:text-text-muted"
                        >
                          <span className="inline-flex items-center gap-1">
                            {c.name}
                            {sort === c.name && <span className="text-primary-ink">{dir === 'asc' ? '↑' : '↓'}</span>}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-row-hover">
                        {data.columns.map((c) => (
                          <td key={c.name} className="whitespace-nowrap px-4 py-2.5 text-text">
                            <Cell col={c} value={row[c.name]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    {data.rows.length === 0 && (
                      <tr>
                        <td colSpan={data.columns.length} className="px-4 py-12 text-center text-sm text-text-muted">
                          No rows match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {total > PAGE_SIZE && (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs tabular-nums text-text-subtle">
                    Showing {from}–{to} of {total.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={offset === 0}
                      onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                      className="inline-flex items-center gap-1 rounded-lg bg-surface px-3 py-1.5 text-sm text-text shadow-control transition-shadow hover:shadow-control-hover disabled:opacity-40"
                    >
                      <ChevronLeft className="size-4" /> Prev
                    </button>
                    <button
                      type="button"
                      disabled={to >= total}
                      onClick={() => setOffset(offset + PAGE_SIZE)}
                      className="inline-flex items-center gap-1 rounded-lg bg-surface px-3 py-1.5 text-sm text-text shadow-control transition-shadow hover:shadow-control-hover disabled:opacity-40"
                    >
                      Next <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
          {!data && (
            <div className="flex items-center justify-center rounded-lg bg-surface py-24 text-center text-text-subtle shadow-sm">
              {tablesError ? (
                <span className="rounded bg-error-bg px-2 py-1 text-sm text-error-fg">
                  Couldn't load tables. {tablesError}
                </span>
              ) : (
                <Database className="size-5" />
              )}
            </div>
          )}
        </div>
      </div>

      {sqlOpen && <SqlModal onClose={() => setSqlOpen(false)} />}
    </div>
  )
}
