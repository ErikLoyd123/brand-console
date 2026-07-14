import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { api, imageFileUrl, type ImageAttachment, type ImageSource } from '../lib/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Check, Image as ImageIcon, Sparkles, Trash2, X } from 'lucide-react'

// The images riding with one queue idea — shown on its card in the review phase.
// Self-describing per the provenance rule: each thumbnail names how it was made
// (imagery skill sources or a hand upload), Unsplash picks carry their photographer
// credit, and the strip says where the files live and what Publish does with them.

const SOURCE_LABEL: Record<ImageSource, string> = {
  composed: 'AI graphic',
  screenshot: 'Screenshot',
  unsplash: 'Unsplash',
  upload: 'Upload',
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
}: {
  ideaId: string
  // Parent hook for anything that lists images elsewhere (e.g. the publish modal).
  onChanged?: (images: ImageAttachment[]) => void
  // Launches the AI imagery session for this idea (the card's Image with AI action).
  onImageAI?: () => void
}) {
  const [images, setImages] = useState<ImageAttachment[]>([])
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

  useEffect(() => {
    reload()
  }, [reload])

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

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-nested px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle"
          title="Stored in the database with files under data/images/. Produced by the imagery skill (AI graphic, annotated screenshot, Unsplash) or uploaded here. Publish ships them: LinkedIn uploads the image, web export bundles it beside the markdown."
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

      {images.length === 0 && !pendingFile && (
        <p className="text-xs text-text-muted">
          No images yet. <span className="font-medium">Image with AI</span> makes one for this
          piece — a graphic in your brand's look, an annotated screenshot of a live page, or a
          stock photo — or upload your own. Publish ships whatever is attached.
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
