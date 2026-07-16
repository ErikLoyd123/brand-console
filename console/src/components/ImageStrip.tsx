import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import {
  api,
  imageFileUrl,
  imagePreviewUrl,
  type ImageAttachment,
  type ImagePreview,
  type ImageSource,
} from '../lib/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Check, Image as ImageIcon, Loader2, Sparkles, Trash2, X } from 'lucide-react'

// The images riding with one queue idea — shown on its card in the review phase.
// Self-describing per the provenance rule: each thumbnail names how it was made
// (imagery skill sources or a hand upload), Unsplash picks carry their photographer
// credit, and the strip says where the files live and what Publish does with them.
// While an imagery session runs for this idea (`working`), the strip polls both the
// attachments and the session's unattached candidates (data/images/previews/<ideaId>/)
// so generated images appear live — local generation takes minutes, and without this
// the session would look stalled.

const SOURCE_LABEL: Record<ImageSource, string> = {
  composed: 'AI graphic',
  screenshot: 'Screenshot',
  unsplash: 'Unsplash',
  upload: 'Upload',
  generated: 'AI image',
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function readFileAsBase64(file: File): Promise<{ dataBase64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'))
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const commaIndex = result.indexOf(',')
      resolve({ dataBase64: commaIndex >= 0 ? result.slice(commaIndex + 1) : result, mimeType: file.type })
    }
    reader.readAsDataURL(file)
  })
}

export function ImageStrip({
  ideaId,
  onChanged,
  onImageAI,
  working = false,
}: {
  ideaId: string
  // Parent hook for anything that lists images elsewhere (e.g. the publish modal).
  onChanged?: (images: ImageAttachment[]) => void
  // Launches the AI imagery session for this idea (the card's Image with AI action).
  onImageAI?: () => void
  // True while an imagery session runs for this idea — turns on live polling and
  // the "generation takes a while" status so the wait never reads as broken.
  working?: boolean
}) {
  const [images, setImages] = useState<ImageAttachment[]>([])
  const [previews, setPreviews] = useState<ImagePreview[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  // Upload flow: picking a file opens a one-field alt form — alt text is required
  // everywhere an image enters the system.
  const [pendingFile, setPendingFile] = useState<{
    name: string
    dataBase64: string
    mimeType: string
  } | null>(null)
  // Candidate being attached from the strip (its filename) — same alt-first rule
  // as uploads. Mutually exclusive with pendingFile; both share the alt field.
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [alt, setAlt] = useState('')

  const reload = useCallback(() => {
    api
      .getImages(ideaId)
      .then((rows) => {
        setImages(rows)
        onChanged?.(rows)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideaId])

  // Candidates are transient session output — a fetch failure just means "none",
  // never an error banner.
  const reloadPreviews = useCallback(() => {
    api
      .getImagePreviews(ideaId)
      .then(setPreviews)
      .catch(() => setPreviews([]))
  }, [ideaId])

  // One effect covers mount, live polling during an imagery session (attachments
  // and candidates both move while the terminal session generates, and a run can
  // take minutes), and a final refresh when `working` flips off.
  useEffect(() => {
    reload()
    reloadPreviews()
    if (!working) return
    const timer = setInterval(() => {
      reload()
      reloadPreviews()
    }, 4000)
    return () => clearInterval(timer)
  }, [working, reload, reloadPreviews])

  async function onFileSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('Image is too large; keep it under 10 MB.')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Use a PNG, JPEG, or WebP image.')
      return
    }
    try {
      const data = await readFileAsBase64(file)
      setPendingPreview(null)
      setPendingFile({ name: file.name, ...data })
      setAlt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function upload() {
    if (!pendingFile || alt.trim() === '') return
    setBusy(true)
    setError(null)
    try {
      await api.uploadImage(ideaId, pendingFile.dataBase64, pendingFile.mimeType, alt.trim())
      setPendingFile(null)
      setAlt('')
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    setError(null)
    try {
      await api.deleteImage(id)
      setConfirmingDelete(null)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // Candidate actions: keep one (promote to a real attachment, alt required),
  // discard one, or clear the whole batch — so leftovers from an ended session
  // never need a terminal to deal with.
  async function attachPreview() {
    if (!pendingPreview || alt.trim() === '') return
    setBusy(true)
    setError(null)
    try {
      await api.attachImagePreview(ideaId, pendingPreview, alt.trim())
      setPendingPreview(null)
      setAlt('')
      reload()
      reloadPreviews()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function removePreview(name: string) {
    setBusy(true)
    setError(null)
    try {
      await api.deleteImagePreview(ideaId, name)
      if (pendingPreview === name) setPendingPreview(null)
      reloadPreviews()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function clearPreviews() {
    setBusy(true)
    setError(null)
    try {
      await api.clearImagePreviews(ideaId)
      setConfirmingClear(false)
      setPendingPreview(null)
      reloadPreviews()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-nested px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle"
          title="Stored in the database with files under data/images/. Produced by the imagery skill (AI image generated locally, AI graphic, annotated screenshot, Unsplash) or uploaded here. Publish ships them: LinkedIn uploads the image, web export bundles it beside the markdown."
        >
          Images{images.length > 0 ? ` · ${images.length}` : ''}
        </span>
        <div className="flex items-center gap-3">
          {onImageAI && (
            <button
              type="button"
              onClick={onImageAI}
              className="inline-flex items-center gap-1 text-xs text-primary-ink underline-offset-2 hover:underline"
            >
              <Sparkles className="size-3" /> Image with AI
            </button>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-text-subtle underline-offset-2 hover:text-text hover:underline">
            <ImageIcon className="size-3" /> Upload
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileSelected} />
          </label>
        </div>
      </div>

      {working && (
        <div className="flex items-start gap-2 rounded-md bg-surface px-3 py-2">
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" />
          <p className="text-xs text-text-muted">
            <span className="font-medium text-text">Imagery session running.</span> Candidates
            land here as they finish — a generated image takes a couple of minutes, and the very
            first run also downloads the model (one time, ~24 GB), which takes much longer. Pick
            and tweak in the session above; nothing attaches until you choose.
          </p>
        </div>
      )}

      {previews.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className="font-mono text-[10px] font-medium uppercase tracking-wide text-text-subtle"
              title="Candidates from an imagery session — files under data/images/previews/, not attached to the piece. Attach the one you want (alt text required) or discard; picking in the session does the same."
            >
              Candidates · not attached yet
            </span>
            {confirmingClear ? (
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={clearPreviews}
                  className="text-[10px] font-medium text-error-fg underline-offset-2 hover:underline"
                >
                  Discard all {previews.length}?
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmingClear(false)}
                  className="text-text-subtle hover:text-text"
                  aria-label="Cancel discard all"
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmingClear(true)}
                className="text-[10px] text-text-subtle underline-offset-2 hover:text-error-fg hover:underline"
              >
                Discard all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {previews.map((p) => (
              <div key={p.name} className="flex w-40 flex-col gap-1">
                <a
                  href={imagePreviewUrl(ideaId, p.name)}
                  target="_blank"
                  rel="noreferrer"
                  title={`${p.name} — open full size`}
                >
                  <img
                    src={`${imagePreviewUrl(ideaId, p.name)}?t=${p.mtimeMs}`}
                    alt={`Candidate ${p.name}`}
                    className="h-24 w-40 rounded-md border border-dashed border-border object-cover opacity-90"
                  />
                </a>
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPendingFile(null)
                      setPendingPreview(p.name)
                      setAlt('')
                    }}
                    className="text-[10px] font-medium text-primary-ink underline-offset-2 hover:underline"
                  >
                    Attach
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removePreview(p.name)}
                    className="rounded p-0.5 text-text-subtle transition-colors hover:text-error-fg"
                    aria-label={`Discard candidate ${p.name}`}
                    title="Discard this candidate (file only — it was never attached)"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {pendingPreview && (
            <div className="flex flex-col gap-2 rounded-lg bg-surface p-3">
              <span className="text-xs text-text-muted">
                Attaching candidate <span className="font-medium">{pendingPreview}</span> —
                describe it first (alt text rides with the image everywhere it ships).
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={alt}
                  onChange={(e) => setAlt(e.target.value)}
                  placeholder="What does the image show?"
                  className="w-72"
                />
                <Button size="sm" disabled={busy || alt.trim() === ''} onClick={attachPreview}>
                  <Check className="size-3.5" /> {busy ? 'Attaching…' : 'Attach'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setPendingPreview(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {images.length === 0 && previews.length === 0 && !pendingFile && !working && (
        <p className="text-xs text-text-muted">
          No images yet. <span className="font-medium">Image with AI</span> makes one for this
          piece — a generated image (photoreal or illustrated, made locally), a graphic in your
          brand's look, an annotated screenshot of a live page, or a stock photo — or upload
          your own. Publish ships whatever is attached.
        </p>
      )}

      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
            <div key={img.id} className="flex w-40 flex-col gap-1">
              <a href={imageFileUrl(img.id)} target="_blank" rel="noreferrer" title={img.alt}>
                <img
                  src={imageFileUrl(img.id)}
                  alt={img.alt}
                  className="h-24 w-40 rounded-md border border-border object-cover"
                />
              </a>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate font-mono text-[10px] uppercase tracking-wide text-text-subtle" title={
                  img.source === 'unsplash' && typeof img.params.attribution === 'string'
                    ? String(img.params.attribution)
                    : img.source === 'generated'
                      // Provenance: name the local model that made it (never a cloud API).
                      ? `Generated locally by ${String(img.params.model ?? img.params.generator ?? 'the local model')}${img.params.seed != null ? ` · seed ${String(img.params.seed)}` : ''} · ${img.width}x${img.height}`
                      : `${SOURCE_LABEL[img.source]} · ${img.width}x${img.height}`
                }>
                  {SOURCE_LABEL[img.source]}
                  {img.source === 'unsplash' && typeof img.params.photographer === 'string'
                    ? ` · ${img.params.photographer}`
                    : ''}
                </span>
                {confirmingDelete === img.id ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(img.id)}
                      className="text-[10px] font-medium text-error-fg underline-offset-2 hover:underline"
                    >
                      Delete?
                    </button>
                    <button
                      type="button"
                      disabled={busy}
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
                    onClick={() => setConfirmingDelete(img.id)}
                    className="rounded p-0.5 text-text-subtle transition-colors hover:text-error-fg"
                    aria-label="Delete image"
                    title="Remove this image from the card (file included)"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingFile && (
        <div className="flex flex-col gap-2 rounded-lg bg-surface p-3">
          <span className="text-xs text-text-muted">
            Attaching <span className="font-medium">{pendingFile.name}</span> — describe it first
            (alt text rides with the image everywhere it ships).
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="What does the image show?"
              className="w-72"
            />
            <Button size="sm" disabled={busy || alt.trim() === ''} onClick={upload}>
              <Check className="size-3.5" /> {busy ? 'Attaching…' : 'Attach'}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPendingFile(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-error-fg">{error}</p>}
    </div>
  )
}
