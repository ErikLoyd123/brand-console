import { useState, type ChangeEvent, type ReactNode } from 'react'
import { api, imageFileUrl, LINKEDIN_CONNECT_PATH, type Connection, type Draft, type ImageAttachment } from '../lib/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { cn } from '../lib/cn'
import { X, AlertCircle, Loader2, Link2, Image as ImageIcon, RefreshCw } from 'lucide-react'

// Confirm dialog for the real LinkedIn publish. Requires exact-caps 'PUBLISH'
// (not 'confirm', not 'Confirm') before the Publish button enables — this is a
// real, irreversible network post, not the "copy to publish" honor-system flow.
// Extracted from the retired Drafts page; the Queue workbench is its home now.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // ~10MB guard, matches the design brief
// LinkedIn caps a single multi-photo post at 9 images. Enforced in the UI so we
// never build a payload LinkedIn will reject.
const MAX_IMAGES = 9

// The publish route answers 401 with this wording when the stored token is past
// its expiry. Matching it lets the modal turn a dead-end error into a Reconnect
// button — a token can lapse while this tab sits open, so the pre-flight check
// below is not enough on its own.
function isSessionExpiredError(message: string): boolean {
  return /session expired/i.test(message)
}

function openReconnect() {
  window.open(LINKEDIN_CONNECT_PATH, '_blank', 'noopener')
}

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

// Shared chrome for both states of this dialog — the publish form and the
// reconnect prompt below — so the scrim, panel, and close affordance are
// defined once.
function ModalShell({
  title,
  busy = false,
  onClose,
  children,
}: {
  title: string
  busy?: boolean
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
      <div
        className="absolute inset-0 bg-overlay-scrim animate-fade-in"
        onClick={busy ? undefined : onClose}
      />
      <div className="relative z-10 flex w-full max-w-md flex-col gap-4 rounded-lg bg-surface-raised p-6 shadow-xl animate-fade-up">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-lg text-text-strong">{title}</h2>
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
        {children}
      </div>
    </div>
  )
}

// What the user sees instead of the publish form when the stored LinkedIn token
// has lapsed. States the cause (a 60-day limit LinkedIn does not let a personal
// app refresh in the background) and offers the one action that fixes it.
function SessionExpiredBody({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Reconnect LinkedIn" onClose={onClose}>
      <div className="flex items-start gap-2 rounded-lg bg-warning-bg p-3 text-sm text-warning-fg">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>
          Your LinkedIn session expired, so this post can&rsquo;t go out yet. Nothing was
          published and the draft is untouched.
        </span>
      </div>
      <p className="text-sm text-text-muted">
        LinkedIn access tokens last 60 days and can&rsquo;t be renewed in the background —
        automatic refresh is limited to approved Marketing Developer Platform partners, so a
        personal app has to be re-approved by hand. Reconnect, come back to this card, and
        publish again.
      </p>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={openReconnect}>
          <RefreshCw className="size-4" /> Reconnect LinkedIn
        </Button>
      </div>
    </ModalShell>
  )
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

  // Media attachment. LinkedIn allows exactly one media *category* per post —
  // text (NONE), a link card (ARTICLE), or image(s) (IMAGE) — so this is a
  // single toggle, never a mix. When the card already has an image, open in
  // Image mode with it pre-selected rather than dropping it silently.
  const [mediaMode, setMediaMode] = useState<MediaMode>(
    attachedImages.length > 0 ? 'image' : 'text',
  )
  const [linkUrl, setLinkUrl] = useState('')
  const [imageFileName, setImageFileName] = useState<string | null>(null)
  const [imageData, setImageData] = useState<{ dataBase64: string; mimeType: string } | null>(null)
  const [imageAlt, setImageAlt] = useState('')
  const [mediaError, setMediaError] = useState<string | null>(null)
  // Picks from the card's attached images — several make a LinkedIn multi-photo
  // post. Mutually exclusive with a file pick: choosing either clears the other.
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>(
    attachedImages.length > 0 ? [attachedImages[0].id] : [],
  )

  // Switching category clears the other categories' inputs, so we can never
  // carry a typed link into an image post (or vice versa) — the toggle enforces
  // LinkedIn's one-category rule, and this keeps the discarded state from
  // lingering behind the scenes. Re-entering Image mode re-seeds the card pick.
  function selectMode(mode: MediaMode) {
    setMediaMode(mode)
    setMediaError(null)
    if (mode !== 'link') setLinkUrl('')
    if (mode !== 'image') {
      setImageData(null)
      setImageFileName(null)
      setImageAlt('')
      setSelectedImageIds([])
    } else if (selectedImageIds.length === 0 && !imageData && attachedImages.length > 0) {
      setSelectedImageIds([attachedImages[0].id])
    }
  }

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
      setSelectedImageIds([])
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : String(err))
    }
  }

  const canPublish =
    confirmText === 'PUBLISH' &&
    !busy &&
    (mediaMode !== 'image' || imageData !== null || selectedImageIds.length > 0)

  async function publish() {
    setBusy(true)
    setError(null)
    try {
      const opts =
        mediaMode === 'link' && linkUrl.trim()
          ? { linkUrl: linkUrl.trim() }
          : mediaMode === 'image' && selectedImageIds.length > 0
            ? { images: selectedImageIds.map((imageId) => ({ imageId })) }
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

  // Pre-flight: the token can lapse while this tab sits open, and the Queue only
  // rechecks on focus. Show the reconnect prompt instead of a form that is
  // guaranteed to 401.
  if (connection.expired) {
    return <SessionExpiredBody onClose={onClose} />
  }

  return (
    <ModalShell title="Publish to LinkedIn" busy={busy} onClose={onClose}>

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
              onClick={() => selectMode(m.key)}
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
                  From this card — tap to include (several make a multi-photo post; alt text
                  rides along). Images attach below the post text. Or pick a file below instead.
                </span>
                <div className="flex flex-wrap gap-2">
                  {attachedImages.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSelectedImageIds((ids) => {
                          if (ids.includes(img.id)) {
                            setMediaError(null)
                            return ids.filter((i) => i !== img.id)
                          }
                          if (ids.length >= MAX_IMAGES) {
                            setMediaError(`LinkedIn allows up to ${MAX_IMAGES} images in one post.`)
                            return ids
                          }
                          setMediaError(null)
                          return [...ids, img.id]
                        })
                        // A file upload and card picks are the same IMAGE slot —
                        // choosing a card image drops any staged file upload.
                        setImageData(null)
                        setImageFileName(null)
                      }}
                      title={img.alt}
                      className={cn(
                        'overflow-hidden rounded-md border-2 transition-colors',
                        selectedImageIds.includes(img.id)
                          ? 'border-primary'
                          : 'border-transparent opacity-80 hover:opacity-100',
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

      {error &&
        (isSessionExpiredError(error) ? (
          // The token lapsed between opening this dialog and hitting Publish.
          // Same remedy as the pre-flight case, offered inline so the typed
          // PUBLISH confirm and media picks survive the reconnect.
          <div className="flex flex-col gap-2 rounded-lg bg-warning-bg p-3 text-sm text-warning-fg">
            <span className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              Your LinkedIn session expired before this went out — nothing was published.
              Reconnect, then hit Publish again.
            </span>
            <div>
              <Button type="button" size="sm" onClick={openReconnect}>
                <RefreshCw className="size-3.5" /> Reconnect LinkedIn
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-error-bg p-3 text-sm text-error-fg">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </div>
        ))}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" onClick={publish} disabled={!canPublish}>
          {busy && <Loader2 className="size-4 animate-spin" />} Publish
        </Button>
      </div>
    </ModalShell>
  )
}
