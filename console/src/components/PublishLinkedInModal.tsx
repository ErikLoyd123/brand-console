import { useState, type ChangeEvent } from 'react'
import { api, imageFileUrl, type Connection, type Draft, type ImageAttachment } from '../lib/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { cn } from '../lib/cn'
import { X, AlertCircle, Loader2, Link2, Image as ImageIcon } from 'lucide-react'

// Confirm dialog for the real LinkedIn publish. Requires exact-caps 'PUBLISH'
// (not 'confirm', not 'Confirm') before the Publish button enables — this is a
// real, irreversible network post, not the "copy to publish" honor-system flow.
// Extracted from the retired Drafts page; the Queue workbench is its home now.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // ~10MB guard, matches the design brief

type Visibility = 'PUBLIC' | 'CONNECTIONS'
type MediaMode = 'text' | 'link' | 'image'

// Reads a File in the browser and resolves the raw base64 payload (the
// data:*;base64, prefix stripped) plus its mime type, for the image publish path.
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

export function PublishLinkedInModal({
  draft,
  connection,
  attachedImages = [],
  onClose,
  onPublished,
}: {
  draft: Draft
  connection: Connection
  // Images already on the idea's card (imagery skill / uploads) — offered as
  // one-click picks; the server reads the file itself by imageId.
  attachedImages?: ImageAttachment[]
  onClose: () => void
  onPublished: () => void
}) {
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Media attachment — defaults to text only. Server precedence is image > linkUrl > text.
  const [mediaMode, setMediaMode] = useState<MediaMode>('text')
  const [linkUrl, setLinkUrl] = useState('')
  const [imageFileName, setImageFileName] = useState<string | null>(null)
  const [imageData, setImageData] = useState<{ dataBase64: string; mimeType: string } | null>(null)
  const [imageAlt, setImageAlt] = useState('')
  const [mediaError, setMediaError] = useState<string | null>(null)
  // A pick from the card's attached images. Mutually exclusive with a file pick:
  // selecting one clears the other.
  const [selectedImageId, setSelectedImageId] = useState<string | null>(
    attachedImages.length > 0 ? attachedImages[0].id : null,
  )

  async function onImageSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaError(null)
    setImageData(null)
    setImageFileName(null)
    if (file.size > MAX_IMAGE_BYTES) {
      setMediaError('Image is too large; keep it under 10 MB.')
      e.target.value = ''
      return
    }
    try {
      const data = await readFileAsBase64(file)
      setImageData(data)
      setImageFileName(file.name)
      setSelectedImageId(null)
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : String(err))
    }
  }

  const canPublish =
    confirmText === 'PUBLISH' &&
    !busy &&
    (mediaMode !== 'image' || imageData !== null || selectedImageId !== null)

  async function publish() {
    setBusy(true)
    setError(null)
    try {
      const opts =
        mediaMode === 'link' && linkUrl.trim()
          ? { linkUrl: linkUrl.trim() }
          : mediaMode === 'image' && selectedImageId
            ? { image: { imageId: selectedImageId } }
            : mediaMode === 'image' && imageData
              ? { image: { dataBase64: imageData.dataBase64, mimeType: imageData.mimeType, alt: imageAlt.trim() || undefined } }
              : undefined
      await api.publishLinkedin(draft.id, visibility, opts)
      onPublished()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
      <div
        className="absolute inset-0 bg-overlay-scrim animate-fade-in"
        onClick={busy ? undefined : onClose}
      />
      <div className="relative z-10 flex w-full max-w-md flex-col gap-4 rounded-lg bg-surface-raised p-6 shadow-xl animate-fade-up">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-lg text-text-strong">Publish to LinkedIn</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1.5 text-text-muted hover:bg-row-hover disabled:opacity-50"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-sm text-text-muted">
          This posts to LinkedIn as{' '}
          <span className="font-medium text-text-strong">{connection.displayName}</span>.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            Visibility
          </label>
          <div className="flex gap-2">
            {(['PUBLIC', 'CONNECTIONS'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                disabled={busy}
                className={cn(
                  'flex-1 rounded-lg px-3 py-2 text-sm shadow-control transition-shadow disabled:opacity-50',
                  visibility === v
                    ? 'bg-selected-bg font-medium text-primary-ink'
                    : 'bg-surface text-text hover:shadow-control-hover',
                )}
              >
                {v === 'PUBLIC' ? 'Public' : 'Connections'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            Attach
          </label>
          <div className="flex gap-2">
            {(
              [
                { key: 'text', label: 'Text only' },
                { key: 'link', label: 'Link' },
                { key: 'image', label: 'Image' },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMediaMode(m.key)}
                disabled={busy}
                className={cn(
                  'flex-1 rounded-lg px-3 py-2 text-sm shadow-control transition-shadow disabled:opacity-50',
                  mediaMode === m.key
                    ? 'bg-selected-bg font-medium text-primary-ink'
                    : 'bg-surface text-text hover:shadow-control-hover',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {mediaMode === 'link' && (
            <div className="flex items-center gap-2 pt-1">
              <Link2 className="size-4 shrink-0 text-text-subtle" />
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                disabled={busy}
              />
            </div>
          )}

          {mediaMode === 'image' && (
            <div className="flex flex-col gap-2 pt-1">
              {attachedImages.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-text-subtle">
                    From this card (alt text rides along) — or pick a file below instead.
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {attachedImages.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setSelectedImageId(img.id)
                          setImageData(null)
                          setImageFileName(null)
                        }}
                        title={img.alt}
                        className={cn(
                          'overflow-hidden rounded-md border-2 transition-colors',
                          selectedImageId === img.id ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100',
                        )}
                      >
                        <img src={imageFileUrl(img.id)} alt={img.alt} className="h-14 w-24 object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <ImageIcon className="size-4 shrink-0 text-text-subtle" />
                <input
                  type="file"
                  accept="image/*"
                  disabled={busy}
                  onChange={onImageSelected}
                  className="text-sm text-text file:mr-3 file:rounded-md file:border-0 file:bg-surface-sunken file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text hover:file:bg-row-hover"
                />
              </div>
              {imageFileName && (
                <span className="text-xs text-text-muted">Selected: {imageFileName}</span>
              )}
              <Input
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder="Alt text (optional)"
                disabled={busy}
              />
              {mediaError && (
                <div className="flex items-center gap-2 rounded-lg bg-error-bg p-2 text-xs text-error-fg">
                  <AlertCircle className="size-3.5 shrink-0" /> {mediaError}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            Type PUBLISH to publish
          </label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="PUBLISH"
            disabled={busy}
            autoFocus
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-error-bg p-3 text-sm text-error-fg">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={publish} disabled={!canPublish}>
            {busy && <Loader2 className="size-4 animate-spin" />} Publish
          </Button>
        </div>
      </div>
    </div>
  )
}
