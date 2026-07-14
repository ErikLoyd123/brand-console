import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { api, type Connection, type Draft, type ProfileData, type ReviewFinding, type ReviewStatus } from '../lib/api'
import { useResource } from '../lib/useResource'
import { Button } from '../components/ui/button'
import { Input, Textarea } from '../components/ui/input'
import { PageHeader, EmptyState } from '../components/kit'
import { SkillSurface } from '../components/SkillSurface'
import { PostPreview } from '../components/PostPreview'
import { ChecksPanel } from '../components/ChecksPanel'
import { foldTruncation } from '../lib/linkedin'
import { useCapabilityToggle } from '../lib/capabilities'
import { cn } from '../lib/cn'
import { PenLine, Copy, Check, Send, Trash2, X, AlertCircle, Loader2, Link2, Image as ImageIcon, Sparkles } from 'lucide-react'

// Ambient hints for the revise walk's working state (see SkillSurface.workingHints).
const REVISE_HINTS = [
  'Loading your voice card',
  'Reading the draft and its take',
  'Sharpening the language',
  'Revising your draft',
]

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // ~10MB guard, matches the design brief

const REVIEW: Record<ReviewStatus, { label: string; dot: string; cls: string }> = {
  pending: { label: 'Not yet reviewed', dot: 'bg-text-subtle', cls: 'bg-surface-sunken text-text-muted' },
  passed: { label: 'Passed the gate', dot: 'bg-success', cls: 'bg-success-bg text-success-fg' },
  failed: { label: 'Needs changes', dot: 'bg-error', cls: 'bg-error-bg text-error-fg' },
  edited: { label: 'Edited by you', dot: 'bg-info', cls: 'bg-info-bg text-info-fg' },
}
const REVIEW_FALLBACK = { label: 'Unknown', dot: 'bg-text-subtle', cls: 'bg-surface-sunken text-text-muted' }

function assemblePost(d: Draft): string {
  return [d.hookOptions[0] ?? '', '', d.body, '', d.close].join('\n').trim()
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">{label}</label>
      {children}
    </div>
  )
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

// Confirm dialog for the real LinkedIn publish. Requires exact-caps 'PUBLISH'
// (not 'confirm', not 'Confirm') before the Publish button enables — this is a
// real, irreversible network post, not the "copy to publish" honor-system flow.
function PublishLinkedInModal({
  draft,
  connection,
  onClose,
  onPublished,
}: {
  draft: Draft
  connection: Connection
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
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : String(err))
    }
  }

  const canPublish =
    confirmText === 'PUBLISH' &&
    !busy &&
    (mediaMode !== 'image' || imageData !== null)

  async function publish() {
    setBusy(true)
    setError(null)
    try {
      const opts =
        mediaMode === 'link' && linkUrl.trim()
          ? { linkUrl: linkUrl.trim() }
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

function Editor({
  draft,
  onChanged,
  onDeleted,
}: {
  draft: Draft
  onChanged: () => void
  onDeleted: () => void
}) {
  const [hooks, setHooks] = useState(draft.hookOptions.join('\n'))
  const [body, setBody] = useState(draft.body)
  const [close, setClose] = useState(draft.close)
  const [media, setMedia] = useState(draft.mediaSuggestion)
  const [permalink, setPermalink] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  // Two-click delete confirm (the Feeds/Articles pattern): first click arms, second deletes.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // "Revise with AI": clicking sets the revise directive (this draft's id) and bumps
  // reviseKey to remount the SkillSurface, opening a revise session on it. Reset
  // when the selected draft changes so a stale directive can't target the wrong draft.
  const [reviseInput, setReviseInput] = useState<string | undefined>(undefined)
  const [reviseKey, setReviseKey] = useState(0)
  const [publishOpen, setPublishOpen] = useState(false)
  // Direct LinkedIn publishing can be switched off per-capability on the Connections page.
  const publishEnabled = useCapabilityToggle('linkedin', 'publish')

  // A draft is a Reddit draft when its resolved platform is 'reddit'; any other
  // value (including the current undefined-until-joined case) is the LinkedIn path.
  // Reddit is a manual copy-paste channel — its only send action is "Copy to publish".
  const isReddit = draft.platform === 'reddit'

  // Author identity for the preview and the LinkedIn publish gate: the LinkedIn
  // connection, name-only profile fallback when it isn't connected. Reddit has no
  // connection (manual channel), so its preview falls back to the profile name.
  const [linkedinConn, setLinkedinConn] = useState<Connection | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)

  // Live voice-gate findings for the current (unsaved) text.
  const [findings, setFindings] = useState<ReviewFinding[]>([])
  const [reviewing, setReviewing] = useState(false)
  // Drafts have no stored product-adjacency field yet, so this is a simple
  // editor-local toggle feeding the cta-rule's severity (default off /
  // personal-brand). See design doc 04, Surface B.
  const [isProductAdjacent, setIsProductAdjacent] = useState(false)

  const review = REVIEW[draft.reviewStatus] ?? REVIEW_FALLBACK

  useEffect(() => {
    setHooks(draft.hookOptions.join('\n'))
    setBody(draft.body)
    setClose(draft.close)
    setMedia(draft.mediaSuggestion)
    setNote(null)
    setConfirmingDelete(false)
    setDeleteError(null)
    setReviseInput(undefined)
  }, [draft])

  async function deleteDraft() {
    setBusy(true)
    setDeleteError(null)
    try {
      await api.deleteDraft(draft.id)
      onDeleted()
    } catch (e) {
      // The one expected refusal: a published draft (the archive references it).
      const msg = e instanceof Error ? e.message : String(e)
      setDeleteError(/published/i.test(msg) ? 'This draft was published — it stays as the Published archive record.' : msg)
      setConfirmingDelete(false)
    } finally {
      setBusy(false)
    }
  }

  function startRevise() {
    setReviseInput(
      `Revise the draft whose id is ${draft.id}. Do not ask which draft — use this one. ` +
        `Load the voice card, read the draft and its idea, ask me what to sharpen, and write it back.`,
    )
    setReviseKey((k) => k + 1)
  }

  // Fetch author identity once on mount.
  useEffect(() => {
    let live = true
    api.getConnections().then((rows) => {
      if (!live) return
      setLinkedinConn(rows.find((c) => c.platform === 'linkedin') ?? null)
    })
    api.getProfile().then((p) => {
      if (live) setProfile(p)
    })
    return () => {
      live = false
    }
  }, [])

  // Debounced live voice-gate review over the assembled draft text. Advisory
  // only — it never gates Save or Copy-to-publish.
  useEffect(() => {
    const assembled = [hooks.split('\n').filter(Boolean)[0] ?? '', '', body, '', close].join('\n').trim()
    if (!assembled) {
      setFindings([])
      setReviewing(false)
      return
    }
    setReviewing(true)
    let live = true
    const timer = setTimeout(() => {
      api
        .postReview(assembled, isProductAdjacent)
        .then((findings) => {
          if (live) {
            setFindings(findings)
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
  }, [hooks, body, close, isProductAdjacent])

  async function save() {
    setBusy(true)
    try {
      await api.updateDraft(draft.id, {
        hookOptions: hooks.split('\n').map((h) => h.trim()).filter(Boolean),
        body,
        close,
        mediaSuggestion: media,
      })
      setNote('Saved.')
      onChanged()
    } finally {
      setBusy(false)
    }
  }
  async function copyToPublish() {
    setBusy(true)
    try {
      const text = assemblePost({ ...draft, hookOptions: hooks.split('\n').filter(Boolean), body, close })
      await navigator.clipboard.writeText(text)
      await api.publishDraft(draft.id, permalink.trim() || undefined)
      setNote('Copied. Paste it into the platform and mark the permalink when live.')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  // Live draft-shaped object fed to the preview, tracking keystrokes.
  const liveDraft: Draft = {
    ...draft,
    hookOptions: hooks.split('\n').map((h) => h.trim()).filter(Boolean),
    body,
    close,
    mediaSuggestion: media,
  }
  const bodyFold = foldTruncation(body)

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-5 rounded-lg bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wide text-text-subtle">Draft {draft.id}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={startRevise}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary-ink transition-colors hover:underline"
            >
              <Sparkles className="size-3.5" /> Revise with AI
            </button>
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', review.cls)}>
              <span className={cn('size-1.5 rounded-full', review.dot)} />
              {review.label}
            </span>
          </div>
        </div>

        {/* Revise-draft AI surface — refines hook/body/close in voice, writes back, then reloads
            so the edited fields update. aiOnly: the fields below are the permanent plain floor.
            Idle until "Revise with AI" is hit (initialInput opens it on this draft). */}
        <SkillSurface
          key={reviseKey}
          skillName="drafts"
          aiOnly
          initialInput={reviseInput}
          workingHints={REVISE_HINTS}
          resultActions={{ resetLabel: 'Done' }}
          onProgress={onChanged}
          onResult={onChanged}
          onPlainSubmit={() => {
            /* No plain path — the fields below are the floor; aiOnly never calls this. */
          }}
          fallback={({ disabled }) => (
            <button
              type="button"
              disabled={disabled}
              onClick={startRevise}
              className="flex items-center gap-2 rounded-lg bg-surface-sunken px-4 py-2.5 text-left text-xs text-text-muted transition-colors hover:text-text disabled:opacity-50"
            >
              <Sparkles className="size-3.5 text-primary-ink" />
              Revise this draft with AI — sharpen the hook, tighten the body, land the close, in your voice.
            </button>
          )}
        />

        <Field label="Hook options — one per line, strongest first">
          <Textarea value={hooks} onChange={(e) => setHooks(e.target.value)} className="font-serif text-[15px]" />
        </Field>
        <Field label="Body">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-52 font-serif text-[15px] leading-relaxed" />
          <div className="flex items-center justify-between font-mono text-[11px] text-text-subtle">
            <span>{body.length} chars</span>
            {!isReddit && bodyFold.folded && (
              <span className="text-warning-fg">LinkedIn folds around here (~{bodyFold.visible.length})</span>
            )}
          </div>
        </Field>
        <Field label="Close">
          <Input value={close} onChange={(e) => setClose(e.target.value)} className="font-serif" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Media suggestion">
            <Input value={media} onChange={(e) => setMedia(e.target.value)} />
          </Field>
          <Field label="Permalink (after you post)">
            <Input value={permalink} onChange={(e) => setPermalink(e.target.value)} placeholder="https://..." />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button variant="outline" disabled={busy} onClick={save}>
            Save changes
          </Button>
          <Button disabled={busy} onClick={copyToPublish}>
            <Copy className="size-4" /> Copy to publish
          </Button>
          {isReddit ? (
            <span className="text-xs text-text-subtle">
              Reddit is copy-paste only — use Copy to publish, then paste into your subreddit or profile.
            </span>
          ) : (
            <Button
              variant="outline"
              disabled={busy || linkedinConn?.connected !== true || !publishEnabled}
              title={
                linkedinConn?.connected !== true
                  ? 'Connect LinkedIn first'
                  : !publishEnabled
                    ? 'Publishing is turned off in Connections'
                    : undefined
              }
              onClick={() => setPublishOpen(true)}
            >
              <Send className="size-4" /> Publish to LinkedIn
            </Button>
          )}
          {note && (
            <span className="inline-flex items-center gap-1 text-sm text-success-fg">
              <Check className="size-4" /> {note}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {confirmingDelete ? (
              <>
                <span className="text-xs text-text-muted">
                  Deletes this draft (its idea returns to the queue). Sure?
                </span>
                <Button size="sm" variant="destructive" disabled={busy} onClick={deleteDraft}>
                  <Trash2 className="size-3.5" /> Yes, delete
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                <Trash2 className="size-3.5" /> Delete
              </Button>
            )}
          </div>
        </div>
        {deleteError && (
          <p className="flex items-center gap-1.5 text-xs text-error-fg">
            <AlertCircle className="size-3.5" /> {deleteError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:sticky lg:top-20 lg:self-start">
        <PostPreview draft={liveDraft} connection={isReddit ? null : linkedinConn} profileName={profile?.name} />
        <label
          className="flex cursor-help items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-text-subtle"
          title="Treats this post as product-adjacent — tightens the CTA rule in the voice check below"
        >
          <input
            type="checkbox"
            checked={isProductAdjacent}
            onChange={(e) => setIsProductAdjacent(e.target.checked)}
            className="size-3.5 rounded border-border"
          />
          Product-adjacent post
        </label>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] text-text-subtle">
            Voice check — the active profile's voice card (authored via <code>setup</code> / the <code>voice</code> skill). Advisory.
          </span>
          <ChecksPanel findings={findings} loading={reviewing} />
        </div>
      </div>

      {publishOpen && linkedinConn && (
        <PublishLinkedInModal
          draft={liveDraft}
          connection={linkedinConn}
          onClose={() => setPublishOpen(false)}
          onPublished={() => {
            setPublishOpen(false)
            setNote('Published to LinkedIn.')
            onChanged()
          }}
        />
      )}

    </div>
  )
}

export function DraftsView() {
  const { data, loading, error, reload } = useResource(() => api.getDrafts())
  const drafts = data ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [current, setCurrent] = useState<Draft | null>(null)

  useEffect(() => {
    setSelectedId((prev) => prev ?? (drafts.length > 0 ? drafts[0].id : null))
  }, [drafts])
  useEffect(() => {
    if (selectedId === null) {
      setCurrent(null)
      return
    }
    api.getDraft(selectedId).then(setCurrent)
  }, [selectedId])

  // Reload the list AND re-fetch the open draft — so a server-side change (a save, a publish,
  // or an AI revision that rewrote the body) is reflected in the editor, not just the list.
  function refresh() {
    reload()
    if (selectedId) api.getDraft(selectedId).then(setCurrent)
  }

  // After a delete the draft is gone: drop the selection (the drafts effect picks the next
  // one, if any) and reload the list.
  function handleDeleted() {
    setSelectedId(null)
    setCurrent(null)
    reload()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pipeline · Write"
        title="Drafts"
        description="Reviewed drafts in your voice. Edit freely, then copy to publish. Nothing posts automatically."
      />

      {error ? (
        <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">
          Couldn't load drafts. {error}
        </div>
      ) : loading && !data ? (
        // Skeleton only on the FIRST load (no data yet). A background reload — e.g. `refresh()`
        // fired by the revise SkillSurface's onProgress as the skill writes — must keep the
        // editor mounted: swapping it for the skeleton mid-run unmounts SkillSurface and aborts
        // the live session, snapping the surface back to idle ("Revise with AI does nothing").
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <div className="h-64 skeleton rounded-lg" />
          <div className="h-96 skeleton rounded-lg" />
        </div>
      ) : drafts.length === 0 ? (
        <EmptyState
          icon={<PenLine className="size-5" />}
          title="No drafts yet"
          hint="Send an idea to draft from the Queue and the agents will write a first pass here."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <div className="flex flex-col gap-1.5 rounded-lg bg-surface p-3 shadow-sm lg:sticky lg:top-20 lg:self-start">
            {drafts.map((d) => {
              const review = REVIEW[d.reviewStatus] ?? REVIEW_FALLBACK
              const on = selectedId === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    'flex items-start gap-2.5 rounded-md px-3 py-2.5 text-left outline-none transition-colors',
                    on ? 'bg-selected-bg' : 'hover:bg-row-hover',
                  )}
                >
                  <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', review.dot)} />
                  <span className={cn('line-clamp-2 font-serif text-sm leading-snug', on ? 'text-primary-ink' : 'text-text')}>
                    {d.hookOptions[0] ?? '(no hook yet)'}
                  </span>
                </button>
              )
            })}
          </div>
          {current ? (
            <Editor draft={current} onChanged={refresh} onDeleted={handleDeleted} />
          ) : (
            <EmptyState title="Select a draft" hint="Pick one from the list to start editing." />
          )}
        </div>
      )}
    </div>
  )
}
