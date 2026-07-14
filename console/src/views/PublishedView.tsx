import { useState } from 'react'
import { api, type PlatformKey, type PublishedPost } from '../lib/api'
import { useResource } from '../lib/useResource'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { PageHeader, SectionHeading, EmptyState } from '../components/kit'
import { PillarBadge } from '../components/PillarBadge'
import { Send, ExternalLink, Globe, Pencil, Check, X, Trash2, MessageSquarePlus, ThumbsUp, AlertCircle, Loader2, Linkedin, MessageCircle } from 'lucide-react'
import { useCapabilityToggle } from '../lib/capabilities'
import { cn } from '../lib/cn'

// Confirm dialog for deleting a real, API-published LinkedIn post. Only ever
// shown for rows with a linkedinUrn — manually-tracked posts have nothing to
// call the API with.
function DeleteLinkedInPostDialog({
  post,
  onClose,
  onDeleted,
}: {
  post: PublishedPost
  onClose: () => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState('')

  // Deleting is irreversible and public — require the same typed gate as publish.
  const canDelete = confirm === 'DELETE' && !busy

  async function confirmDelete() {
    setBusy(true)
    setError(null)
    try {
      await api.deleteLinkedinPost(post.id)
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-overlay-scrim animate-fade-in" onClick={busy ? undefined : onClose} />
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-lg bg-surface-raised p-6 shadow-xl animate-fade-up">
        <h2 className="font-serif text-lg text-text-strong">Remove from LinkedIn?</h2>
        <p className="text-sm text-text-muted">
          Remove this post from LinkedIn? This permanently deletes it and can't be undone.
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            Type DELETE to delete
          </label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" disabled={busy} autoFocus />
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
          <Button type="button" variant="destructive" onClick={confirmDelete} disabled={!canDelete}>
            {busy && <Loader2 className="size-4 animate-spin" />} Delete from LinkedIn
          </Button>
        </div>
      </div>
    </div>
  )
}

// Small dialog for posting a comment to an API-published post — e.g. the
// "link in the first comment" pattern. Stays open after a successful post so
// another comment can follow; clears the field and shows a brief confirmation.
function CommentLinkedInPostDialog({ post, onClose }: { post: PublishedPost; onClose: () => void }) {
  const [text, setText] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  // A comment posts publicly on your behalf — gate it with a typed COMMENT.
  const canPost = text.trim() !== '' && confirm === 'COMMENT' && !busy

  async function submit() {
    if (!canPost) return
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      await api.commentLinkedinPost(post.id, text.trim())
      setNote('Commented.')
      setText('')
      setConfirm('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-overlay-scrim animate-fade-in" onClick={busy ? undefined : onClose} />
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-lg bg-surface-raised p-6 shadow-xl animate-fade-up">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-serif text-lg text-text-strong">Add a comment</h2>
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
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. the link, so the post itself stays clean"
          disabled={busy}
          autoFocus
        />
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            Type COMMENT to post
          </label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="COMMENT" disabled={busy} />
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-error-bg p-3 text-sm text-error-fg">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          {note ? (
            <span className="inline-flex items-center gap-1 text-sm text-success-fg">
              <Check className="size-4" /> {note}
            </span>
          ) : (
            <span />
          )}
          <Button type="button" onClick={submit} disabled={!canPost}>
            {busy && <Loader2 className="size-4 animate-spin" />} Post comment
          </Button>
        </div>
      </div>
    </div>
  )
}

// Liking posts publicly on your behalf, so it gets the same typed action-word
// gate (type LIKE) as publish, comment, and delete.
function LikeLinkedInPostDialog({ post, onClose, onLiked }: { post: PublishedPost; onClose: () => void; onLiked: () => void }) {
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canLike = confirm === 'LIKE' && !busy

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await api.likeLinkedinPost(post.id)
      onLiked()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-overlay-scrim animate-fade-in" onClick={busy ? undefined : onClose} />
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-lg bg-surface-raised p-6 shadow-xl animate-fade-up">
        <h2 className="font-serif text-lg text-text-strong">Like this post on LinkedIn?</h2>
        <p className="text-sm text-text-muted">This reacts to the post publicly, as you.</p>
        <div className="flex flex-col gap-1.5">
          <label className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            Type LIKE to like
          </label>
          <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="LIKE" disabled={busy} autoFocus />
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
          <Button type="button" onClick={submit} disabled={!canLike}>
            {busy && <Loader2 className="size-4 animate-spin" />} Like
          </Button>
        </div>
      </div>
    </div>
  )
}

// Delete / comment / like actions for a row published through the API. Never
// rendered for manually-tracked posts (no linkedinUrn to act on).
function LinkedInRowActions({ post, onChanged }: { post: PublishedPost; onChanged: () => void }) {
  const [likeOpen, setLikeOpen] = useState(false)
  const [likeNote, setLikeNote] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [commentOpen, setCommentOpen] = useState(false)
  // Each action can be switched off per-capability on the Connections page.
  const canLike = useCapabilityToggle('linkedin', 'like')
  const canComment = useCapabilityToggle('linkedin', 'comment')
  const canDelete = useCapabilityToggle('linkedin', 'delete')

  return (
    <>
      {canLike && (
        <button
          type="button"
          onClick={() => setLikeOpen(true)}
          title={likeNote ?? 'Like'}
          className={cn('inline-flex', likeNote ? 'text-success-fg' : 'text-text-muted hover:text-text-strong')}
        >
          <ThumbsUp className="size-4" />
        </button>
      )}
      {canComment && (
        <button
          type="button"
          onClick={() => setCommentOpen(true)}
          className="inline-flex text-text-muted hover:text-text-strong"
          title="Add comment"
        >
          <MessageSquarePlus className="size-4" />
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="inline-flex text-text-muted hover:text-error-fg"
          title="Delete from LinkedIn"
        >
          <Trash2 className="size-4" />
        </button>
      )}
      {deleteOpen && (
        <DeleteLinkedInPostDialog
          post={post}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false)
            onChanged()
          }}
        />
      )}
      {commentOpen && <CommentLinkedInPostDialog post={post} onClose={() => setCommentOpen(false)} />}
      {likeOpen && (
        <LikeLinkedInPostDialog
          post={post}
          onClose={() => setLikeOpen(false)}
          onLiked={() => {
            setLikeOpen(false)
            setLikeNote('Liked')
            setTimeout(() => setLikeNote(null), 2500)
          }}
        />
      )}
    </>
  )
}

// The channel a published post went to, off published_posts.platform. Legacy /
// raw rows without a platform read as LinkedIn.
function PlatformBadge({ platform }: { platform?: PlatformKey | 'web' | null }) {
  if (platform === 'reddit') {
    return (
      <span className="inline-flex items-center gap-1.5 text-text-muted">
        <MessageCircle className="size-3.5 text-[#ff4500]" /> Reddit
      </span>
    )
  }
  if (platform === 'web') {
    return (
      <span className="inline-flex items-center gap-1.5 text-text-muted">
        <Globe className="size-3.5 text-text-subtle" /> Web (long-form)
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-text-muted">
      <Linkedin className="size-3.5 text-[#0a66c2]" /> LinkedIn
    </span>
  )
}

export function PublishedView() {
  const { data, loading, error, reload } = useResource(() => api.getPosts())
  const all = data ?? []
  // Slice by lane. Rows without a platform predate the column and read as LinkedIn.
  const [platformFilter, setPlatformFilter] = useState<'all' | 'linkedin' | 'reddit' | 'web'>('all')
  const posts =
    platformFilter === 'all'
      ? all
      : all.filter((p) => (p.platform ?? 'linkedin') === platformFilter)
  const countBy = (key: 'linkedin' | 'reddit' | 'web') =>
    all.filter((p) => (p.platform ?? 'linkedin') === key).length

  const [editingId, setEditingId] = useState<string | null>(null)
  const [permalink, setPermalink] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function startEdit(p: PublishedPost) {
    setEditingId(p.id)
    setSaveError(null)
    setPermalink(p.permalink ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
    setSaveError(null)
  }

  async function save(id: string) {
    setSaving(true)
    setSaveError(null)
    try {
      await api.updatePost(id, {
        permalink: permalink.trim() === '' ? null : permalink.trim(),
      })
      setEditingId(null)
      reload()
    } catch (err) {
      setSaveError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pipeline · Live"
        title="Published"
        description="Every post that went live. Kept as the archive of what shipped, with a link back to each one."
      />

      {loading ? (
        <div className="h-64 skeleton rounded-lg" />
      ) : error ? (
        <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">
          Couldn't load published posts. {error}
        </div>
      ) : all.length === 0 ? (
        <EmptyState icon={<Send className="size-5" />} title="Nothing published yet" hint="Pieces you publish from the Queue get archived here for reference." />
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: 'all' as const, label: 'All lanes', count: all.length },
                { key: 'linkedin' as const, label: 'LinkedIn', count: countBy('linkedin') },
                { key: 'reddit' as const, label: 'Reddit', count: countBy('reddit') },
                { key: 'web' as const, label: 'Web (long-form)', count: countBy('web') },
              ]
            ).map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setPlatformFilter(c.key)}
                aria-pressed={platformFilter === c.key}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2 text-xs font-medium outline-none transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-primary/40',
                  platformFilter === c.key
                    ? 'bg-selected-strong text-selected-strong-fg shadow-sm'
                    : 'bg-surface-sunken text-text-muted hover:bg-row-hover',
                  platformFilter !== c.key && c.count === 0 && 'opacity-45',
                )}
              >
                {c.label}
                <span className="tabular-nums opacity-70">{c.count}</span>
              </button>
            ))}
          </div>
          <SectionHeading title="Everything shipped" hint={`${posts.length} shown`} />
          <div className="overflow-x-auto rounded-lg bg-surface shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[11px] uppercase tracking-wide text-text-subtle">
                  <th className="px-5 py-3 font-medium">Published</th>
                  <th className="px-5 py-3 font-medium">Channel</th>
                  <th className="px-5 py-3 font-medium">Pillar</th>
                  <th className="px-5 py-3 text-right font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => {
                  const editing = editingId === p.id
                  return (
                    <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-row-hover">
                      <td className="px-5 py-3 tabular-nums text-text-muted">
                        {new Date(p.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-0.5">
                          <PlatformBadge platform={p.platform} />
                          {p.platform === 'reddit' && p.destination && (
                            <span className="font-mono text-[11px] text-text-subtle">{p.destination}</span>
                          )}
                          {p.platform === 'web' && p.title && (
                            <span className="text-xs text-text-muted">{p.title}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">{p.pillar ? <PillarBadge pillar={p.pillar} /> : '-'}</td>
                      {editing ? (
                        <td className="px-5 py-3">
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center justify-end gap-2">
                              <Input
                                type="text"
                                placeholder="Permalink"
                                value={permalink}
                                onChange={(e) => setPermalink(e.target.value)}
                                className="h-8 w-40"
                              />
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => save(p.id)}
                                className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50"
                                title="Save"
                              >
                                <Check className="size-4" />
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={cancelEdit}
                                className="inline-flex size-8 items-center justify-center rounded-md bg-surface-sunken text-text-muted hover:text-text-strong disabled:opacity-50"
                                title="Cancel"
                              >
                                <X className="size-4" />
                              </button>
                            </div>
                            {saveError && (
                              <div className="rounded-md bg-error-bg px-2 py-1 text-xs text-error-fg shadow-sm">
                                Couldn't save. {saveError}
                              </div>
                            )}
                          </div>
                        </td>
                      ) : p.platform === 'web' ? (
                        <td className="px-5 py-3">
                          {/* A web row is an exported article; its artifact is the local
                              markdown file, so the link cell shows the export path. */}
                          <div className="flex items-center justify-end">
                            <code
                              className="max-w-64 truncate font-mono text-[11px] text-text-muted"
                              title={p.exportPath ?? undefined}
                            >
                              {p.exportPath ?? '-'}
                            </code>
                          </div>
                        </td>
                      ) : (
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {p.permalink ? (
                              <a href={p.permalink} target="_blank" rel="noreferrer" className="inline-flex text-primary-ink hover:text-primary-hover">
                                <ExternalLink className="size-4" />
                              </a>
                            ) : (
                              <span className="text-text-subtle">-</span>
                            )}
                            <button
                              type="button"
                              onClick={() => startEdit(p)}
                              className="inline-flex text-text-muted hover:text-text-strong"
                              title="Edit permalink"
                            >
                              <Pencil className="size-4" />
                            </button>
                            {p.linkedinUrn && <LinkedInRowActions post={p} onChanged={reload} />}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
