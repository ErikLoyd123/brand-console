import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { api, brandAssetUrl, type BrandState } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input, Textarea } from '../components/ui/input'
import { PageHeader, SectionHeading } from '../components/kit'
import { SkillSurface } from '../components/SkillSurface'
import { Check, FileText, Image as ImageIcon, Sparkles, Trash2, Upload, X } from 'lucide-react'

// The Brand page: the active profile's visual look — the gitignored
// profiles/<slug>/brand/ folder the imagery pipeline reads before producing any
// image. Everything here is a hand editor over those files (colors/fonts/notes →
// brand.yaml, logo, refs/ images, .md/.html brand documents); the `brand` skill
// is the AI path over the same folder.

// Ambient hints for the brand walk's working state (see SkillSurface.workingHints).
const BRAND_HINTS = [
  'Reading your brand folder',
  'Looking at the reference material',
  'Deriving the palette',
  'Rendering a test card',
]

const COLOR_SLOTS: { key: keyof BrandState['colors']; label: string; hint: string }[] = [
  { key: 'primary', label: 'Primary', hint: 'The signature color — annotation boxes, accents, stat values' },
  { key: 'accent', label: 'Accent', hint: 'Secondary flourishes — small bars and highlights' },
  { key: 'background', label: 'Background', hint: 'Card background' },
  { key: 'foreground', label: 'Foreground', hint: 'Main text on cards' },
  { key: 'muted', label: 'Muted', hint: 'De-emphasized text — attributions, labels' },
]

// Shown on the surfaces that render fallback values when this profile has no saved
// brand — so the neutral default is never mistaken for a look the owner set.
function DefaultBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-nested px-2.5 py-1 text-[11px] font-medium text-text-subtle">
      <span className="size-1.5 rounded-full bg-text-subtle/60" />
      Neutral default · not saved
    </span>
  )
}

// One tile in the logo grid; the card default gets the selected treatment.
function cnLogoCard(isDefault: boolean): string {
  return [
    'flex flex-col gap-1 rounded-lg p-2',
    isDefault ? 'bg-selected-bg ring-1 ring-primary/40' : 'bg-surface-nested',
  ].join(' ')
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const commaIndex = result.indexOf(',')
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result)
    }
    reader.readAsDataURL(file)
  })
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsText(file)
  })
}

export function BrandView() {
  const [brand, setBrand] = useState<BrandState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Editable copies of the yaml-backed fields.
  const [colors, setColors] = useState<BrandState['colors'] | null>(null)
  const [fonts, setFonts] = useState<BrandState['fonts'] | null>(null)
  const [styleNotes, setStyleNotes] = useState('')

  // Bumped after every write so the preview card re-renders in the new look.
  const [previewKey, setPreviewKey] = useState(0)
  // With no brand on disk the page shows a true empty state — no pre-filled look
  // that reads as configured. This opts into the by-hand editor, whose fields are
  // seeded from the neutral defaults purely as a starting point.
  const [editByHand, setEditByHand] = useState(false)

  const [viewingDoc, setViewingDoc] = useState<{ name: string; content: string } | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  const reload = useCallback(() => {
    api
      .getBrand()
      .then((b) => {
        setBrand(b)
        setColors(b.colors)
        setFonts(b.fonts)
        setStyleNotes(b.styleNotes)
        setLoadError(null)
        setPreviewKey((k) => k + 1)
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  function flash(message: string) {
    setNote(message)
    setTimeout(() => setNote(null), 2500)
  }

  async function run(action: () => Promise<unknown>, doneNote: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      flash(doneNote)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function saveLook() {
    if (!colors || !fonts) return
    await run(() => api.saveBrand({ colors, fonts, styleNotes }), 'Saved — preview updated')
  }

  async function onLogoSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      for (const file of files) {
        const dataBase64 = await readFileAsBase64(file)
        await api.uploadBrandLogo(file.name, dataBase64)
      }
      flash(files.length === 1 ? 'Logo added' : `${files.length} logos added`)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function onRefSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      for (const file of files) {
        const dataBase64 = await readFileAsBase64(file)
        await api.uploadBrandRef(file.name, dataBase64)
      }
      flash(files.length === 1 ? 'Reference added' : `${files.length} references added`)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function onDocSelected(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      for (const file of files) {
        const content = await readFileAsText(file)
        await api.uploadBrandDoc(file.name, content)
      }
      flash(files.length === 1 ? 'Document added' : `${files.length} documents added`)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function viewDoc(name: string) {
    try {
      const content = await api.getBrandDoc(name)
      setViewingDoc({ name, content })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Inputs" title="Brand" description="" />
        <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">{loadError}</div>
      </div>
    )
  }

  // No brand.yaml on disk for the active profile: every value below is the neutral
  // fallback, not something the owner set. Label the populated surfaces so a bare
  // default is never read as a saved look.
  const usingDefaults = brand ? !brand.exists : false

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Inputs"
        title="Brand"
        description="Your profile's visual look — the colors, fonts, logo, reference images, and brand documents the imagery pipeline reads before it produces any image. Per profile, stored as files in the profile's brand/ folder (never committed). Optional: anything unset falls back to a neutral default."
      />

      {/* AI mode: the brand skill — derive a palette from your live site or a reference,
          walk the fonts and style notes, render a test card. The editors below are the
          permanent plain floor, so this surface is aiOnly; each step reloads the form. */}
      <SkillSurface
        skillName="brand"
        aiOnly
        workingHints={BRAND_HINTS}
        resultActions={{ resetLabel: 'Do another' }}
        onProgress={reload}
        onResult={reload}
        onPlainSubmit={() => {
          /* No plain path — the editors below are the floor; aiOnly never calls this. */
        }}
        fallback={({ start, disabled }) => (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-strong">Set up brand with AI</p>
                <p className="text-xs text-text-subtle">
                  Derive your palette from your live website or a reference image, walk the fonts
                  and style notes, and see a test card — writes the same{' '}
                  <code className="font-mono text-[11px]">brand/</code> files this page edits.
                </p>
              </div>
            </div>
            <Button size="sm" disabled={disabled} onClick={() => start('Set up my brand look.')}>
              Start
            </Button>
          </div>
        )}
      />

      {/* No brand on disk and no editor opened: a true empty state. Nothing here
          may read as a configured look — no filled palette, no branded preview.
          The imagery pipeline treats this state as unbranded too (loadBrand's
          `exists: false`): generated images take no palette from the fallback. */}
      {usingDefaults && !editByHand && brand && (
        <div className="flex flex-col items-start gap-3 rounded-lg bg-surface p-6 shadow-sm">
          <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            No brand set up
          </span>
          <p className="text-sm text-text-muted">
            This profile has no brand — and that's a valid state: images are produced
            unbranded (no palette, fonts, or logo applied) until you create one. Set it up
            with AI above, upload a logo / reference / document below, or start by hand —
            saving creates <code className="font-mono text-xs">{brand.brandDir}</code> for
            you.
          </p>
          <Button size="sm" variant="outline" onClick={() => setEditByHand(true)}>
            Start by hand
          </Button>
        </div>
      )}

      {usingDefaults && editByHand && (
        <p className="rounded-lg border-l-2 border-primary/40 bg-surface-nested px-4 py-3 text-sm text-text-muted">
          <span className="font-medium text-text">Nothing saved yet.</span> The fields below
          are seeded with neutral starting values, not a brand — adjust and{' '}
          <span className="font-medium">Save as this profile's brand</span> to create it.
        </p>
      )}

      {/* Live test card — a real render from the saved brand, so edits are judged on
          pixels, not swatches. Hidden entirely while no brand exists and the by-hand
          editor is closed: an empty state must not exhibit a look. */}
      {(!usingDefaults || editByHand) && (
        <section className="flex flex-col gap-3">
          <SectionHeading
            title="Preview"
            hint={
              usingDefaults
                ? 'A test card in the neutral starting look — nothing is saved yet. Save the look to make it this profile’s.'
                : 'A test card rendered live from the saved brand — exactly what composed graphics will look like. Save to refresh.'
            }
            action={usingDefaults ? <DefaultBadge /> : undefined}
          />
          <img
            key={previewKey}
            src={`/api/brand/preview.png?v=${previewKey}`}
            alt="Test card rendered in the saved brand look"
            className="w-full max-w-xl rounded-lg border border-border shadow-sm"
          />
        </section>
      )}

      {(!usingDefaults || editByHand) && (
      <section className="flex flex-col gap-3">
        <SectionHeading
          title="The look"
          hint="Saved to brand.yaml in the profile's brand/ folder. Colors are hex; fonts are CSS font-family stacks rendered with system fonts."
          action={usingDefaults ? <DefaultBadge /> : undefined}
        />
        <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-sm">
          {colors && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {COLOR_SLOTS.map((slot) => (
                <label key={slot.key} className="flex flex-col gap-1">
                  <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                    {slot.label}
                  </span>
                  <span className="flex items-center gap-2">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(colors[slot.key]) ? colors[slot.key] : '#000000'}
                      onChange={(e) => setColors({ ...colors, [slot.key]: e.target.value })}
                      className="size-8 shrink-0 cursor-pointer rounded border border-border bg-surface p-0.5"
                      aria-label={`${slot.label} color`}
                    />
                    <Input
                      value={colors[slot.key]}
                      onChange={(e) => setColors({ ...colors, [slot.key]: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </span>
                  <span className="text-[11px] text-text-subtle">{slot.hint}</span>
                </label>
              ))}
            </div>
          )}
          {fonts && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                  Heading font
                </span>
                <Input
                  value={fonts.heading}
                  onChange={(e) => setFonts({ ...fonts, heading: e.target.value })}
                  className="font-mono text-xs"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                  Body font
                </span>
                <Input
                  value={fonts.body}
                  onChange={(e) => setFonts({ ...fonts, body: e.target.value })}
                  className="font-mono text-xs"
                />
              </label>
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
              Style notes
            </span>
            <Textarea
              value={styleNotes}
              onChange={(e) => setStyleNotes(e.target.value)}
              placeholder={'What should images feel like, and what should they avoid?\nA few specific lines beat a page of adjectives.'}
              className="min-h-24"
            />
            <span className="text-[11px] text-text-subtle">
              Freeform judgment the fields above can't encode — read before every image is produced.
            </span>
          </label>
          <div className="flex items-center gap-3">
            <Button size="sm" disabled={busy} onClick={saveLook}>
              <Check className="size-3.5" />{' '}
              {busy ? 'Saving…' : usingDefaults ? "Save as this profile’s brand" : 'Save look'}
            </Button>
            {note && (
              <span className="inline-flex items-center gap-1 text-xs text-success-fg">
                <Check className="size-3.5" /> {note}
              </span>
            )}
          </div>
        </div>
      </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Logos"
          hint="Your logo set — as many variants as you use (primary, reversed for dark grounds, icon, stacked…). Stored in brand/logos/. One is the card default, composited bottom-right on composed cards; the imagery skill can pick any variant per image."
        />
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-sm">
          {brand && brand.logos.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {brand.logos.map((rel) => {
                const isDefault = brand.logo === rel
                const name = rel.replace(/^logos\//, '')
                return (
                  <div
                    key={rel}
                    className={cnLogoCard(isDefault)}
                  >
                    <img
                      src={`${brandAssetUrl(rel)}&v=${previewKey}`}
                      alt={name}
                      className="h-12 w-40 rounded bg-surface-nested object-contain p-1"
                    />
                    <span className="max-w-40 truncate font-mono text-[10px] text-text-subtle" title={rel}>
                      {name}
                    </span>
                    <div className="flex items-center gap-2">
                      {isDefault ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-ink">
                          <Check className="size-3" /> Card default
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => run(() => api.setDefaultBrandLogo(rel), 'Card default updated')}
                          className="text-[11px] text-text-subtle underline-offset-2 hover:text-text hover:underline"
                        >
                          Use on cards
                        </button>
                      )}
                      {confirmingDelete === `logo:${rel}` ? (
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(() => api.deleteBrandLogoFile(rel), 'Logo removed').then(() =>
                                setConfirmingDelete(null),
                              )
                            }
                            className="text-[11px] font-medium text-error-fg underline-offset-2 hover:underline"
                          >
                            Delete?
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDelete(null)}
                            className="text-text-subtle hover:text-text"
                            aria-label="Cancel delete"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmingDelete(`logo:${rel}`)}
                          className="rounded p-0.5 text-text-subtle transition-colors hover:text-error-fg"
                          aria-label={`Delete ${name}`}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <span className="text-sm text-text-muted">
              No logos yet — upload your set (all the variants you use).
            </span>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-primary-ink underline-offset-2 hover:underline">
              <Upload className="size-3.5" /> Upload logos
              <input type="file" accept="image/*" multiple className="hidden" onChange={onLogoSelected} />
            </label>
            {brand?.logo && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => api.setDefaultBrandLogo(null), 'Cards will carry no logo')}
                className="text-xs text-text-subtle underline-offset-2 hover:text-text hover:underline"
              >
                No logo on cards
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Reference images"
          hint="Examples of the look you want matched — a site screenshot, a card you liked, a photo with the right mood. Stored in brand/refs/; viewed before every image is produced."
        />
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-sm">
          {brand && brand.refs.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {brand.refs.map((name) => (
                <div key={name} className="flex w-44 flex-col gap-1">
                  <img
                    src={`/api/brand/refs/${encodeURIComponent(name)}?v=${previewKey}`}
                    alt={name}
                    className="h-28 w-44 rounded-md border border-border object-cover"
                  />
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-mono text-[10px] text-text-subtle" title={name}>
                      {name}
                    </span>
                    {confirmingDelete === `ref:${name}` ? (
                      <span className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(() => api.deleteBrandRef(name), 'Reference removed').then(() =>
                              setConfirmingDelete(null),
                            )
                          }
                          className="text-[10px] font-medium text-error-fg underline-offset-2 hover:underline"
                        >
                          Delete?
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDelete(null)}
                          className="text-text-subtle hover:text-text"
                          aria-label="Cancel delete"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmingDelete(`ref:${name}`)}
                        className="rounded p-0.5 text-text-subtle transition-colors hover:text-error-fg"
                        aria-label={`Delete ${name}`}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-sm text-text-muted">
              No reference images yet — drop in "make it feel like this" examples.
            </span>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5 self-start text-xs text-primary-ink underline-offset-2 hover:underline">
            <ImageIcon className="size-3.5" /> Upload references
            <input type="file" accept="image/*" multiple className="hidden" onChange={onRefSelected} />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Brand documents"
          hint="Optional .md / .html files — a company brand book, tone-of-voice guide, or messaging doc. Read in full before any brand-facing work; most useful for a brand profile with existing formal guidelines. (The voice card stays the authority for the writing itself.)"
        />
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-5 shadow-sm">
          {brand && brand.docs.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {brand.docs.map((name) => (
                <li key={name} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-nested px-3 py-2">
                  <FileText className="size-4 shrink-0 text-text-subtle" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-text" title={name}>
                    {name}
                  </span>
                  <button
                    type="button"
                    onClick={() => viewDoc(name)}
                    className="text-xs text-primary-ink underline-offset-2 hover:underline"
                  >
                    View
                  </button>
                  {confirmingDelete === `doc:${name}` ? (
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(() => api.deleteBrandDoc(name), 'Document removed').then(() =>
                            setConfirmingDelete(null),
                          )
                        }
                        className="text-xs font-medium text-error-fg underline-offset-2 hover:underline"
                      >
                        Delete?
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(null)}
                        className="text-text-subtle hover:text-text"
                        aria-label="Cancel delete"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmingDelete(`doc:${name}`)}
                      className="rounded p-0.5 text-text-subtle transition-colors hover:text-error-fg"
                      aria-label={`Delete ${name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-sm text-text-muted">
              No brand documents yet — upload a brand book or tone guide if you have one.
            </span>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5 self-start text-xs text-primary-ink underline-offset-2 hover:underline">
            <Upload className="size-3.5" /> Upload documents (.md / .html)
            <input type="file" accept=".md,.html,.htm,text/markdown,text/html" multiple className="hidden" onChange={onDocSelected} />
          </label>
        </div>
      </section>

      {error && <p className="text-sm text-error-fg">{error}</p>}

      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-overlay-scrim animate-fade-in" onClick={() => setViewingDoc(null)} />
          <div className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col gap-3 overflow-hidden rounded-lg bg-surface-raised p-6 shadow-xl animate-fade-up">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-mono text-sm text-text-strong">{viewingDoc.name}</h2>
              <button
                type="button"
                onClick={() => setViewingDoc(null)}
                className="rounded-md p-1.5 text-text-muted hover:bg-row-hover"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-surface-nested p-4 font-mono text-xs leading-relaxed text-text">
              {viewingDoc.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
