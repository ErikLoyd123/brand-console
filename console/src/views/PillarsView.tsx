import { useEffect, useState } from 'react'
import { api, type PillarConfig } from '../lib/api'
import { useResource } from '../lib/useResource'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { PageHeader, SectionHeading, Eyebrow, EmptyState } from '../components/kit'
import { SkillSurface } from '../components/SkillSurface'
import { AlertCircle, Layers, Plus, Trash2, Check, Sparkles } from 'lucide-react'

// Warm categorical dot colors, one per pillar card (matches the design tokens).
const PILLAR_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
]

// Ambient hints for the pillars walk's working state (see SkillSurface.workingHints).
const MANAGE_PILLARS_HINTS = [
  'Reading your pillars',
  'Checking queue and coverage',
  'Weighing the balance',
  'Saving your pillars',
]

// Pull the server's {"error": "..."} message out of the thrown http() error string.
function cleanErr(e: unknown): string {
  const s = String((e as Error)?.message ?? e)
  const m = s.match(/\{.*\}$/)
  if (m) {
    try {
      return JSON.parse(m[0]).error ?? s
    } catch {
      /* fall through */
    }
  }
  return s
}

type EditRow = PillarConfig & { isNew?: boolean }

// The pillar manager: load the editable config, edit labels/weights, add or remove
// pillars, and save the whole list back to identity.yaml. An existing pillar's key is
// read-only — renaming it would orphan queued items filed under the old key; rename via
// the label instead. New pillars get an editable key.
function PillarEditor({ onSaved, reloadKey }: { onSaved: () => void; reloadKey: number }) {
  const [rows, setRows] = useState<EditRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Re-pull the config on mount and whenever reloadKey bumps — so the form reflects what the
  // pillars AI walk just wrote (progressive fill), the same way PillarStats refreshes.
  useEffect(() => {
    api
      .getPillarsConfig()
      .then((r) => setRows(r.pillars))
      .catch((e) => setLoadError(cleanErr(e)))
  }, [reloadKey])

  function patch(i: number, next: Partial<EditRow>) {
    setRows((rs) => (rs ? rs.map((r, idx) => (idx === i ? { ...r, ...next } : r)) : rs))
    setSaved(false)
    setError(null)
  }
  function remove(i: number) {
    setRows((rs) => (rs ? rs.filter((_, idx) => idx !== i) : rs))
    setSaved(false)
    setError(null)
  }
  function add() {
    setRows((rs) => [...(rs ?? []), { key: '', label: '', weight: 0, isNew: true }])
    setSaved(false)
  }

  async function save() {
    if (!rows) return
    setSaving(true)
    setError(null)
    try {
      const payload = rows.map((r) => ({ key: r.key.trim(), label: r.label.trim(), weight: Number(r.weight) || 0 }))
      const r = await api.savePillars(payload)
      setRows(r.pillars)
      setSaved(true)
      onSaved()
    } catch (e) {
      setError(cleanErr(e))
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">
        Couldn't load pillar config. {loadError}
      </div>
    )
  }
  if (!rows) {
    return <div className="h-40 skeleton rounded-lg" />
  }

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading title="Manage pillars" hint="written to the profile's identity.yaml" />
      <div className="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-sm">
        <div className="flex items-center gap-2 px-1 pb-1">
          <span className="w-40 shrink-0 font-mono text-[10px] uppercase tracking-wide text-text-subtle">Key</span>
          <span className="flex-1 font-mono text-[10px] uppercase tracking-wide text-text-subtle">Label</span>
          <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-wide text-text-subtle">Weight</span>
          <span className="w-8 shrink-0" />
        </div>

        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            {row.isNew ? (
              <Input
                value={row.key}
                onChange={(e) => patch(i, { key: e.target.value })}
                placeholder="short-key"
                className="h-8 w-40 font-mono text-xs"
              />
            ) : (
              <span className="w-40 shrink-0 truncate px-2 font-mono text-xs text-text-subtle" title={row.key}>
                {row.key}
              </span>
            )}
            <Input
              value={row.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              placeholder="Human label"
              className="h-8 flex-1"
            />
            <Input
              type="number"
              min={0}
              value={String(row.weight)}
              onChange={(e) => patch(i, { weight: Number(e.target.value) })}
              className="h-8 w-24 tabular-nums"
            />
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0 text-text-subtle hover:text-error"
              onClick={() => remove(i)}
              title="Remove pillar"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        <div className="mt-1 flex items-center justify-between">
          <Button size="sm" variant="ghost" onClick={add}>
            <Plus className="size-3.5" /> Add pillar
          </Button>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1 text-xs text-success-fg">
                <Check className="size-3.5" /> Saved
              </span>
            )}
            <Button size="sm" disabled={saving || rows.length === 0} onClick={save}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-error-bg px-3 py-2 text-xs text-error-fg">{error}</div>
        )}
      </div>
      <p className="text-sm text-text-subtle">
        Weights are relative shares — the engine normalizes them. A pillar's key is fixed once created
        (renaming it would orphan queued items); change the label to rename it in the UI.
      </p>
    </section>
  )
}

function PillarStats({ reloadKey }: { reloadKey: number }) {
  const { data, loading, error } = useResource(() => api.getPillarStats(), [reloadKey])
  const pillars = data ?? []
  const gaps = pillars.filter((p) => p.queue === 0)

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 skeleton rounded-lg" />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">
        Couldn't load pillar stats. {error}
      </div>
    )
  }
  if (pillars.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="size-5" />}
        title="No pillars configured"
        hint="Add pillars above and they show up here."
      />
    )
  }

  return (
    <>
      {gaps.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg bg-warning-bg p-4 shadow-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning-fg" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-warning-fg">Coverage gap</p>
            <p className="text-sm text-text-muted">
              {gaps.map((g) => g.label).join(', ')} {gaps.length === 1 ? 'has' : 'have'} nothing queued. Run a discovery
              pass or capture a spark to keep {gaps.length === 1 ? 'it' : 'them'} warm.
            </p>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeading title="By pillar" hint="posts and what's waiting" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pillars.map((p, i) => {
            const color = PILLAR_COLORS[i % PILLAR_COLORS.length]
            return (
              <div key={p.pillar} className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <h3 className="font-serif text-lg text-text-strong">{p.label}</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Eyebrow>Published</Eyebrow>
                    <span className="font-mono text-xl font-medium tabular-nums text-text-strong">{p.posts}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Eyebrow>In queue</Eyebrow>
                    <span className="font-mono text-xl font-medium tabular-nums text-text-strong">{p.queue}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

export function PillarsView() {
  // Bump to re-pull the editor and the stats after an edit saves — by hand or by the AI walk.
  const [reloadKey, setReloadKey] = useState(0)
  const bump = () => setReloadKey((k) => k + 1)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Insights"
        title="Pillars"
        description="The themes you write from. Add, rename, and reweight them here — keep them in balance so no single lane goes quiet or crowds the rest."
      />

      {/* AI mode: the pillars skill (add / rename / reweight / rebalance / remove, informed
          by your queue depth and coverage). The editor + stats below are the permanent plain floor,
          so this surface is aiOnly (no toggle); on each step it reloads both. */}
      <SkillSurface
        skillName="pillars"
        aiOnly
        workingHints={MANAGE_PILLARS_HINTS}
        resultActions={{ resetLabel: 'Do another' }}
        onProgress={bump}
        onResult={bump}
        onPlainSubmit={() => {
          /* No plain path here — the editor below is the floor; aiOnly never calls this. */
        }}
        fallback={({ start, disabled }) => (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-strong">Manage pillars with AI</p>
                <p className="text-xs text-text-subtle">
                  Add, rename, or remove a pillar — or rebalance weights against your queue depth and
                  coverage gaps. Writes the same <code className="font-mono text-[11px]">identity.yaml</code>{' '}
                  the editor below does.
                </p>
              </div>
            </div>
            <Button size="sm" disabled={disabled} onClick={() => start('')}>
              Start
            </Button>
          </div>
        )}
      />

      <PillarEditor onSaved={bump} reloadKey={reloadKey} />
      <PillarStats reloadKey={reloadKey} />
    </div>
  )
}
