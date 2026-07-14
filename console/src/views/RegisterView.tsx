import { useCallback, useEffect, useRef, useState } from 'react'
import {
  api,
  type RegisterConfig,
  type RegisterPlatformMenu,
  type RegisterPlatformSelection,
} from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { PageHeader, SectionHeading, Eyebrow } from '../components/kit'
import { SkillSurface } from '../components/SkillSurface'
import { Plus, Trash2, Check, Sparkles } from 'lucide-react'

// Ambient hints for the register walk's working state (see SkillSurface.workingHints).
const REGISTER_WORKING_HINTS = [
  'Reading your register',
  'Checking the shipped menu',
  'Matching tones to your voice',
  'Saving your selection',
]

// Pull the server's {"error": "..."} out of the thrown http() error string.
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

// One tone/theme the user is editing. `custom` marks a key the shipped menu doesn't define.
interface EditTone {
  key: string
  note: string
  selected: boolean
  custom: boolean
}

interface EditPlatform {
  key: string
  label: string
  format: string
  active: boolean
  tones: EditTone[]
  themes: EditTone[]
}

// Build editable state by folding the user's saved selection over the shipped menu.
function buildState(cfg: RegisterConfig): { platforms: EditPlatform[]; defaultKey: string } {
  const platforms = cfg.menu.map((menu: RegisterPlatformMenu) => {
    const sel = cfg.selection.find((s) => s.key === menu.key)
    const toneRows = (kind: 'tones' | 'themes'): EditTone[] => {
      const shipped = menu[kind]
      const chosen = sel?.[kind] ?? []
      const shippedKeys = new Set(shipped.map((t) => t.key))
      const rows: EditTone[] = shipped.map((t) => {
        const pick = chosen.find((c) => c.key === t.key)
        return { key: t.key, note: pick?.note ?? '', selected: Boolean(pick), custom: false }
      })
      // Custom entries: chosen keys the shipped menu doesn't define.
      for (const c of chosen) {
        if (!shippedKeys.has(c.key)) rows.push({ key: c.key, note: c.note, selected: true, custom: true })
      }
      return rows
    }
    return {
      key: menu.key,
      label: menu.label,
      format: menu.format,
      active: sel ? sel.active : true,
      tones: toneRows('tones'),
      themes: toneRows('themes'),
    }
  })
  const marked = cfg.selection.find((s) => s.default)?.key
  const firstActive = platforms.find((p) => p.active)?.key
  return { platforms, defaultKey: marked ?? firstActive ?? platforms[0]?.key ?? '' }
}

function ToneList({
  title,
  hint,
  rows,
  menu,
  onChange,
}: {
  title: string
  hint: string
  rows: EditTone[]
  menu: { key: string; label: string; guidance: string }[]
  onChange: (rows: EditTone[]) => void
}) {
  function patch(i: number, next: Partial<EditTone>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...next } : r)))
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i))
  }
  function addCustom() {
    onChange([...rows, { key: '', note: '', selected: true, custom: true }])
  }

  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>{title}</Eyebrow>
      <p className="text-xs text-text-subtle">{hint}</p>
      <div className="flex flex-col gap-1.5">
        {rows.map((row, i) =>
          row.custom ? (
            <div key={i} className="flex items-center gap-2">
              <span className="w-4 text-center text-text-subtle" title="Custom (not in the shipped menu)">
                ✎
              </span>
              <Input
                value={row.key}
                onChange={(e) => patch(i, { key: e.target.value })}
                placeholder="custom-key"
                className="h-8 w-40 font-mono text-xs"
              />
              <Input
                value={row.note}
                onChange={(e) => patch(i, { note: e.target.value })}
                placeholder="how it sounds in your voice"
                className="h-8 flex-1"
              />
              <Button
                size="icon"
                variant="ghost"
                className="size-8 shrink-0 text-text-subtle hover:text-error"
                onClick={() => remove(i)}
                title="Remove"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ) : (
            <label key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={row.selected}
                onChange={(e) => patch(i, { selected: e.target.checked })}
                className="size-4 accent-[var(--color-primary)]"
              />
              <span
                className="w-40 shrink-0 font-mono text-xs text-text-strong"
                title={menu.find((m) => m.key === row.key)?.guidance}
              >
                {row.key}
              </span>
              {row.selected ? (
                <Input
                  value={row.note}
                  onChange={(e) => patch(i, { note: e.target.value })}
                  placeholder="how it sounds in your voice (optional)"
                  className="h-8 flex-1"
                />
              ) : (
                <span className="flex-1 truncate text-xs text-text-subtle">not used</span>
              )}
            </label>
          ),
        )}
      </div>
      <div>
        <Button size="sm" variant="ghost" onClick={addCustom}>
          <Plus className="size-3.5" /> Add custom {title.toLowerCase().replace(/s$/, '')}
        </Button>
      </div>
    </div>
  )
}

export function RegisterView() {
  const [platforms, setPlatforms] = useState<EditPlatform[] | null>(null)
  const [menu, setMenu] = useState<RegisterPlatformMenu[]>([])
  const [defaultKey, setDefaultKey] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // (Re)load the register config from the API and rebuild editor state. Called on mount,
  // on each step of the AI walk (onProgress), and when it finishes — so each note the
  // `register` skill writes to identity.yaml fills its box as the walk moves on, not only
  // at the end. The in-flight guard keeps the frequent progress calls from stacking.
  const loadingRef = useRef(false)
  const load = useCallback(() => {
    if (loadingRef.current) return
    loadingRef.current = true
    api
      .getRegisterConfig()
      .then((cfg) => {
        const s = buildState(cfg)
        setPlatforms(s.platforms)
        setDefaultKey(s.defaultKey)
        setMenu(cfg.menu)
        setLoadError(null)
      })
      .catch((e) => setLoadError(cleanErr(e)))
      .finally(() => {
        loadingRef.current = false
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function patchPlatform(i: number, next: Partial<EditPlatform>) {
    setPlatforms((ps) => (ps ? ps.map((p, idx) => (idx === i ? { ...p, ...next } : p)) : ps))
    setSaved(false)
    setError(null)
  }

  async function save() {
    if (!platforms) return
    setSaving(true)
    setError(null)
    try {
      const payload: RegisterPlatformSelection[] = platforms.map((p) => ({
        key: p.key,
        active: p.active,
        default: p.key === defaultKey,
        tones: p.tones
          .filter((t) => t.selected && t.key.trim())
          .map((t) => ({ key: t.key.trim(), note: t.note.trim() })),
        themes: p.themes
          .filter((t) => t.selected && t.key.trim())
          .map((t) => ({ key: t.key.trim(), note: t.note.trim() })),
      }))
      await api.saveRegister(payload)
      setSaved(true)
    } catch (e) {
      setError(cleanErr(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Insights"
        title="Register"
        description="How your posts sound and where they ship — platform plus tone. The menu of tones and themes is shipped with the app; here you pick which you lean on and personalize how they sound in your voice."
      />

      {/* AI mode: a guided register walk (the `register` skill). The full editor below is
          the permanent plain floor, always visible — so this surface is aiOnly (no toggle),
          and on a completed walk it refetches so the editor reflects what the skill wrote. */}
      <SkillSurface
        skillName="register"
        aiOnly
        workingHints={REGISTER_WORKING_HINTS}
        resultActions={{ resetLabel: 'Set up another' }}
        onProgress={() => load()}
        onResult={() => load()}
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
                <p className="text-sm font-medium text-text-strong">Set up your register with AI</p>
                <p className="text-xs text-text-subtle">
                  A guided walk — pick a platform, then lean on the tones and themes that fit your
                  voice. Writes the same identity.yaml the editor below does.
                </p>
              </div>
            </div>
            <Button size="sm" disabled={disabled} onClick={() => start('')}>
              Start
            </Button>
          </div>
        )}
      />

      {loadError ? (
        <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">
          Couldn't load register config. {loadError}
        </div>
      ) : !platforms ? (
        <div className="h-64 skeleton rounded-lg" />
      ) : (
        <>
          {platforms.map((p, i) => {
            const menuP = menu.find((m) => m.key === p.key)
            return (
              <section key={p.key} className="flex flex-col gap-3">
                <SectionHeading title={p.label} hint="platform selection · written to identity.yaml" />
                <div className="flex flex-col gap-5 rounded-lg bg-surface p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-text-strong">
                      <input
                        type="checkbox"
                        checked={p.active}
                        onChange={(e) => patchPlatform(i, { active: e.target.checked })}
                        className="size-4 accent-[var(--color-primary)]"
                      />
                      Active
                    </label>
                    <label className="flex items-center gap-2 text-sm text-text-strong">
                      <input
                        type="radio"
                        name="default-platform"
                        checked={defaultKey === p.key}
                        onChange={() => {
                          setDefaultKey(p.key)
                          setSaved(false)
                        }}
                        className="size-4 accent-[var(--color-primary)]"
                      />
                      Default
                    </label>
                    <span className="text-xs text-text-subtle">{p.format}</span>
                  </div>

                  <ToneList
                    title="Tones"
                    hint="Check the tones you lean on; add a note to personalize how each sounds. Add custom tones the menu doesn't ship."
                    rows={p.tones}
                    menu={menuP?.tones ?? []}
                    onChange={(rows) => patchPlatform(i, { tones: rows })}
                  />
                  <ToneList
                    title="Themes"
                    hint="Recurring subjects you return to. Lean on shipped ones or add your own — themes specific to you live only here, never in the shipped menu."
                    rows={p.themes}
                    menu={menuP?.themes ?? []}
                    onChange={(rows) => patchPlatform(i, { themes: rows })}
                  />
                </div>
              </section>
            )
          })}

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1 text-xs text-success-fg">
                <Check className="size-3.5" /> Saved to identity.yaml
              </span>
            )}
            {error && <span className="text-xs text-error-fg">{error}</span>}
            <Button size="sm" disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>

          <p className="text-sm text-text-subtle">
            Register is soft guidance — it colors how a draft sounds, but never gates it. The tone and theme
            <em> menu</em> is committed app structure; your selection and any custom entries are saved to
            your profile.
          </p>
        </>
      )}
    </div>
  )
}
