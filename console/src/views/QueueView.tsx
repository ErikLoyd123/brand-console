import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import {
  api,
  type Connection,
  type GeneratorStatus,
  type ContentPlatform,
  type IdeaQueueItem,
  type ImageAttachment,
  type ReviewFinding,
  type ReviewStatus,
  type Silo,
} from '../lib/api'
import { useResource } from '../lib/useResource'
import { Button } from '../components/ui/button'
import { Input, Textarea } from '../components/ui/input'
import { PillarBadge } from '../components/PillarBadge'
import { TagBadge } from '../components/TagBadge'
import { SiloBadge } from '../components/SiloBadge'
import { SilosInfoLink } from '../components/SilosInfoLink'
import { PublishLinkedInModal } from '../components/PublishLinkedInModal'
import { ImageStrip, type ImageEngine } from '../components/ImageStrip'
import { PostPreview } from '../components/PostPreview'
import { ChecksPanel } from '../components/ChecksPanel'
import { getConsoleSilos } from '../lib/silos'
import { useCapabilityToggle } from '../lib/capabilities'
import { cn } from '../lib/cn'
import { PageHeader, ScoreChip, EmptyState } from '../components/kit'
import { SkillSurface } from '../components/SkillSurface'
import { ListChecks, Plus, Check, Copy, Send, ShieldCheck, Trash2, X, Sparkles } from 'lucide-react'

// The review-gate verdict, rendered on each card's content header. Same vocabulary the
// retired Drafts editor used; set by content-reviewer (via Review with AI or the terminal)
// and reset to pending by any content write.
const REVIEW: Record<ReviewStatus, { label: string; dot: string }> = {
  pending: { label: 'Not yet reviewed', dot: 'bg-text-subtle' },
  passed: { label: 'Passed the gate', dot: 'bg-success' },
  failed: { label: 'Needs changes', dot: 'bg-error' },
  edited: { label: 'Edited by you', dot: 'bg-info' },
  approved: { label: 'Reviewed by you', dot: 'bg-success' },
}

// Ambient hints for the develop walk's working state (see SkillSurface.workingHints).
const DEVELOP_HINTS = [
  'Reading your idea',
  'Looking at the source',
  'Drawing out the beats',
  'Developing your idea',
]

// Ambient hints for the draft walk's working state.
const DRAFT_HINTS = [
  'Loading your voice card',
  'Reading the idea and its points',
  'Shaping hooks and body',
  'Saving the draft',
]

// Ambient hints for the review gate's working state.
const REVIEW_HINTS = [
  'Loading your voice card',
  'Reading the piece',
  'Running the mechanical checks',
  'Judging it against the rules',
]

// Ambient hints for the imagery run's working state.
const IMAGE_HINTS = [
  'Reading the piece',
  'Loading your brand guidelines',
  'Checking which image sources are available',
  'Proposing concepts and prompts',
  'Generating — takes a couple of minutes per image',
]

// The filter bar spans every platform's roster, not just one — a Reddit-sourced idea
// or a web piece-kind idea must be filterable here too. Flatten the rosters and de-dupe
// the shared `curate` entry (same object in both, so a simple key-seen check is enough).
const ALL_SILOS = (() => {
  const seen = new Set<string>()
  return [
    ...getConsoleSilos('linkedin'),
    ...getConsoleSilos('reddit'),
    ...getConsoleSilos('web'),
  ].filter((m) => {
    if (seen.has(m.key)) return false
    seen.add(m.key)
    return true
  })
})()

// The written piece riding with the idea — the queue is the review phase, so the card
// shows the full content, lets the owner edit it by hand (the plain floor), and carries
// the publish action for the idea's platform. Post ideas edit the latest draft
// (hook/body/close); web ideas edit the article (one markdown body + SEO fields).
function ContentBlock({
  item,
  linkedinConn,
  publishEnabled,
  profileName,
  images,
  onChanged,
  onRevise,
  onReview,
}: {
  item: IdeaQueueItem
  linkedinConn: Connection | null
  publishEnabled: boolean
  profileName?: string
  // The card's attached images (fetched by the ImageStrip below), offered as
  // ready-made picks in the LinkedIn publish modal.
  images: ImageAttachment[]
  onChanged: () => void
  onRevise: () => void
  onReview: () => void
}) {
  const platform: ContentPlatform = (item.platform as ContentPlatform | null) ?? 'linkedin'
  const isWeb = platform === 'web'
  const draft = item.draft ?? null
  const article = item.article ?? null

  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Post fields
  const [hooks, setHooks] = useState((draft?.hookOptions ?? []).join('\n'))
  const [body, setBody] = useState(draft?.body ?? '')
  const [close, setClose] = useState(draft?.close ?? '')
  // Web fields
  const [webBody, setWebBody] = useState(article?.body ?? '')
  const [metaDescription, setMetaDescription] = useState(article?.metaDescription ?? '')
  const [slug, setSlug] = useState(article?.slug ?? '')
  // Publish confirm state
  const [confirmingPublish, setConfirmingPublish] = useState(false)
  const [permalink, setPermalink] = useState('')
  const [linkedinModalOpen, setLinkedinModalOpen] = useState(false)

  useEffect(() => {
    setHooks((draft?.hookOptions ?? []).join('\n'))
    setBody(draft?.body ?? '')
    setClose(draft?.close ?? '')
    setWebBody(article?.body ?? '')
    setMetaDescription(article?.metaDescription ?? '')
    setSlug(article?.slug ?? '')
    setEditing(false)
    setConfirmingPublish(false)
    setError(null)
  }, [item.id, draft?.id, article?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasContent = isWeb ? Boolean(article && article.body.trim() !== '') : Boolean(draft)
  const assembled = draft
    ? [draft.hookOptions[0] ?? '', '', draft.body, '', draft.close].join('\n').trim()
    : ''

  // Live mechanical voice checks over the text being edited (the same POST /api/review the
  // Drafts editor ran), debounced, and only while the editor is open — a whole grid of
  // cards must not hammer the API. Silo rides along so adjacency derives correctly.
  const [findings, setFindings] = useState<ReviewFinding[]>([])
  const [checking, setChecking] = useState(false)
  // The take rides into the check text even though it never publishes: it's on the card
  // in the owner's voice, and an em dash there next to an "all clear" panel reads as a
  // broken checker. A web piece also ships its title and meta description (export
  // frontmatter + H1), so those join the body. Slug stays out: kebab-case can't carry
  // the prose tells these rules scan for.
  const editedText = isWeb
    ? [item.proposedAngle, article?.title ?? '', metaDescription, webBody].join('\n\n').trim()
    : [item.proposedAngle, hooks.split('\n')[0] ?? '', '', body, '', close].join('\n').trim()
  useEffect(() => {
    if (!editing) return
    setChecking(true)
    const t = setTimeout(() => {
      api
        .postReview(editedText, false, item.silo)
        .then(setFindings)
        .catch(() => setFindings([]))
        .finally(() => setChecking(false))
    }, 600)
    return () => clearTimeout(t)
  }, [editing, editedText, item.silo])

  async function saveContent() {
    setBusy(true)
    setError(null)
    try {
      if (isWeb && article) {
        await api.updateArticle(article.id, {
          body: webBody,
          metaDescription,
          slug: slug.trim() === '' ? undefined : slug.trim(),
        })
      } else if (draft) {
        await api.updateDraft(draft.id, {
          hookOptions: hooks.split('\n').map((h) => h.trim()).filter((h) => h !== ''),
          body,
          close,
        })
      }
      setEditing(false)
      setNote('Saved')
      setTimeout(() => setNote(null), 2000)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  // The owner's manual sign-off: flip the review verdict to 'approved' without
  // running the AI gate. Same endpoints the reviewer uses; a later content edit
  // still resets it to 'pending'.
  async function markReviewed() {
    setBusy(true)
    setError(null)
    try {
      if (isWeb && article) {
        await api.updateArticle(article.id, { reviewStatus: 'approved' })
      } else if (draft) {
        await api.reviewDraft(draft.id, 'approved')
      }
      setNote('Marked reviewed')
      setTimeout(() => setNote(null), 2000)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.publishQueueItem(item.id, permalink.trim() || undefined)
      setNote(res.exportPath ? `Exported to ${res.exportPath}` : 'Published')
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setConfirmingPublish(false)
    } finally {
      setBusy(false)
    }
  }

  if (!hasContent) {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg bg-surface-nested px-4 py-3">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
          Content
        </span>
        <p className="text-sm text-text-muted">
          Nothing written yet. <span className="font-medium">Write with AI</span> below drafts the
          full {isWeb ? 'article' : 'post'} right here.
        </p>
      </div>
    )
  }

  const reviewStatus = (isWeb ? article?.reviewStatus : draft?.reviewStatus) ?? 'pending'
  const review = REVIEW[reviewStatus] ?? REVIEW.pending

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-nested px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
          {isWeb ? 'Article' : 'Post'}
          {isWeb && article?.exportPath ? ' · exported' : ''}
          <span
            className="inline-flex items-center gap-1.5 normal-case tracking-normal"
            title="The review verdict. Run the AI gate with Review with AI, or sign off yourself with Mark reviewed; any content edit resets it to pending."
          >
            <span className={cn('size-1.5 rounded-full', review.dot)} />
            {review.label}
          </span>
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReview}
            className="inline-flex items-center gap-1 text-xs text-primary-ink underline-offset-2 hover:underline"
          >
            <ShieldCheck className="size-3" /> Review with AI
          </button>
          {reviewStatus !== 'approved' && reviewStatus !== 'passed' && (
            <button
              type="button"
              onClick={markReviewed}
              disabled={busy}
              title="Sign off on this yourself, without running the AI gate."
              className="inline-flex items-center gap-1 text-xs text-primary-ink underline-offset-2 hover:underline disabled:opacity-50"
            >
              <Check className="size-3" /> Mark reviewed
            </button>
          )}
          <button
            type="button"
            onClick={onRevise}
            className="inline-flex items-center gap-1 text-xs text-primary-ink underline-offset-2 hover:underline"
          >
            <Sparkles className="size-3" /> Revise with AI
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="text-xs text-text-subtle underline-offset-2 hover:text-text hover:underline"
          >
            {editing ? 'Close editor' : 'Edit'}
          </button>
        </div>
      </div>

      {editing ? (
        isWeb ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={webBody}
              onChange={(e) => setWebBody(e.target.value)}
              className="min-h-64 bg-surface font-mono text-xs leading-relaxed"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                Meta description
                <Textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  className="min-h-0 bg-surface font-sans text-sm normal-case tracking-normal"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                Slug
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="bg-surface font-sans text-sm normal-case tracking-normal"
                />
              </label>
            </div>
            <Button size="sm" className="self-start" disabled={busy} onClick={saveContent}>
              <Check className="size-3.5" /> {busy ? 'Saving…' : 'Save content'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-text-subtle">
              Hooks — one per line, first is the {platform === 'reddit' ? 'title' : 'opener'}
              <Textarea
                value={hooks}
                onChange={(e) => setHooks(e.target.value)}
                className="min-h-0 bg-surface font-sans text-sm normal-case tracking-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-text-subtle">
              Body
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-40 bg-surface font-sans text-sm normal-case tracking-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-medium uppercase tracking-wide text-text-subtle">
              Close
              <Textarea
                value={close}
                onChange={(e) => setClose(e.target.value)}
                className="min-h-0 bg-surface font-sans text-sm normal-case tracking-normal"
              />
            </label>
            <Button size="sm" className="self-start" disabled={busy} onClick={saveContent}>
              <Check className="size-3.5" /> {busy ? 'Saving…' : 'Save content'}
            </Button>
          </div>
        )
      ) : isWeb ? (
        <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
          {article?.body}
        </p>
      ) : (
        draft && (
          // The real preview (LinkedIn chrome / Reddit title + markdown with the 300-char
          // title cue), platform-resolved from the idea since the raw draft row carries none.
          <PostPreview
            draft={{ ...draft, platform: platform === 'reddit' ? 'reddit' : 'linkedin' }}
            connection={platform === 'reddit' ? null : linkedinConn}
            profileName={profileName}
            attachedImages={images}
          />
        )
      )}

      {editing && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] text-text-subtle">
            Voice check over {isWeb ? 'your take, the title, meta description, and body' : 'your take, hook, body, and close'} — the
            active profile's voice card. Advisory; the review gate is the authority.
          </span>
          <ChecksPanel findings={findings} loading={checking} />
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-2">
        {!isWeb && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              void navigator.clipboard.writeText(assembled)
              setNote('Copied')
              setTimeout(() => setNote(null), 2000)
            }}
          >
            <Copy className="size-3.5" /> Copy
          </Button>
        )}
        {confirmingPublish ? (
          <div className="flex flex-wrap items-center gap-2">
            {!isWeb && (
              <Input
                value={permalink}
                onChange={(e) => setPermalink(e.target.value)}
                placeholder="Permalink (optional)"
                className="w-56"
              />
            )}
            <Button size="sm" disabled={busy} onClick={publish}>
              <Check className="size-3.5" />{' '}
              {busy ? 'Publishing…' : isWeb ? 'Yes — export + publish' : 'Yes — mark published'}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmingPublish(false)}>
              Cancel
            </Button>
          </div>
        ) : platform === 'linkedin' && linkedinConn?.connected === true && publishEnabled ? (
          <>
            <Button size="sm" disabled={busy} onClick={() => setLinkedinModalOpen(true)}>
              <Send className="size-3.5" /> Publish to LinkedIn
            </Button>
            {/* The manual path stays reachable while the API is connected: paste it
                yourself, then record it here with the permalink. */}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmingPublish(true)}>
              Mark published…
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => setConfirmingPublish(true)}>
            <Send className="size-3.5" /> Publish
          </Button>
        )}
        <span className="text-xs text-text-subtle">
          {isWeb
            ? 'Publish writes the markdown file (SEO frontmatter) to data/exports/ and moves this to Published.'
            : platform === 'reddit'
              ? 'Reddit is copy-paste: Copy, post it there, then Publish to record it.'
              : linkedinConn?.connected === true && publishEnabled
                ? 'Posts via the LinkedIn API behind a typed confirm.'
                : 'Copy, post it yourself, then Publish to record it.'}
        </span>
        {note && (
          <span className="inline-flex items-center gap-1 text-xs text-success-fg">
            <Check className="size-3.5" /> {note}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-error-fg">{error}</p>}

      {linkedinModalOpen && linkedinConn && draft && (
        <PublishLinkedInModal
          draft={draft}
          attachedImages={images}
          connection={linkedinConn}
          onClose={() => setLinkedinModalOpen(false)}
          onPublished={() => {
            setLinkedinModalOpen(false)
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function QueueRow({
  item,
  linkedinConn,
  publishEnabled,
  profileName,
  onDone,
  onDevelop,
  onDraft,
  onReview,
  onImage,
  generator = null,
  imageWorking = false,
  highlight = false,
}: {
  item: IdeaQueueItem
  linkedinConn: Connection | null
  publishEnabled: boolean
  profileName?: string
  onDone: () => void
  onDevelop: () => void
  onDraft: () => void
  onReview: () => void
  // Launches the imagery session with the producer the strip's model picker chose.
  onImage: (engine: ImageEngine) => void
  // Local generator status (model roster) for the strip's picker (page-level fetch).
  generator?: GeneratorStatus | null
  // True while this idea's imagery session runs (live candidate polling on the strip).
  imageWorking?: boolean
  highlight?: boolean
}) {
  const [seed, setSeed] = useState(item.seed ?? '')
  const [busy, setBusy] = useState(false)
  // Inline take editing: `editingSeed` swaps the read-only take box for a textarea;
  // `confirmingDeleteTake` gates deletion behind a confirm, since the take is the item's
  // only opinion and clearing it is destructive (a needs-your-take item reverts to needing one).
  const [editingSeed, setEditingSeed] = useState(false)
  const [confirmingDeleteTake, setConfirmingDeleteTake] = useState(false)
  const hasSeed = Boolean(item.seed && item.seed.trim())
  // A needs-your-take item must carry the owner's take before it can be drafted; until then
  // the only action is saving that take. Everything else (ready-to-draft, or a needs-your-take
  // that already has a seed) is draftable now.
  const needsTakeFirst = item.tag === 'needs-your-take' && !hasSeed
  const ref = useRef<HTMLElement>(null)

  // The card's attached images, lifted out of the ImageStrip so the publish modal
  // can offer them as picks without a second fetch.
  const [cardImages, setCardImages] = useState<ImageAttachment[]>([])

  // Developed points — the beats of the argument. Editable by hand here; the develop
  // skill writes the same field. One point per line in the editor.
  const [editingPoints, setEditingPoints] = useState(false)
  const [pointsText, setPointsText] = useState((item.points ?? []).join('\n'))
  const [savingPoints, setSavingPoints] = useState(false)

  async function savePoints() {
    setSavingPoints(true)
    try {
      const points = pointsText
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p !== '')
      await api.setQueuePoints(item.id, points)
      setEditingPoints(false)
      onDone()
    } finally {
      setSavingPoints(false)
    }
  }

  // When arrived at via a deep link (#/queue?item=<id>), scroll this row into view
  // so the just-created idea is where the user is looking.
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlight])

  async function send() {
    setBusy(true)
    try {
      await api.seedQueueItem(item.id, seed)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  // Save an edit to an existing take. Same write as the first-take Save (seedQueueItem),
  // just from the read-only box's Edit affordance.
  async function saveSeedEdit() {
    setBusy(true)
    try {
      await api.seedQueueItem(item.id, seed.trim())
      setEditingSeed(false)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  // Delete the take by clearing the seed. A needs-your-take item then reverts to needing
  // a take (its Save-take editor returns); a ready-to-draft item drops back to drafting
  // from the angle. Gated by confirmingDeleteTake so it can't happen on a stray click.
  async function deleteSeed() {
    setBusy(true)
    try {
      await api.seedQueueItem(item.id, '')
      setSeed('')
      setConfirmingDeleteTake(false)
      onDone()
    } finally {
      setBusy(false)
    }
  }

  // Delete the whole idea — and everything downstream (its drafts, their calendar plans,
  // and a web idea's article row). Two-click confirm; refused by the server when a draft
  // of it was published (the Published archive references that draft).
  const [confirmingDeleteItem, setConfirmingDeleteItem] = useState(false)
  const [deleteItemError, setDeleteItemError] = useState<string | null>(null)
  async function deleteItem() {
    setBusy(true)
    setDeleteItemError(null)
    try {
      await api.deleteQueueItem(item.id)
      onDone()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setDeleteItemError(
        /published/i.test(msg)
          ? 'A draft of this idea was published — it stays as the Published archive record.'
          : msg,
      )
      setConfirmingDeleteItem(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      ref={ref}
      className={cn(
        'flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-sm',
        highlight && 'ring-2 ring-primary/70',
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex flex-1 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <SiloBadge silo={item.silo} />
            <PillarBadge pillar={item.pillar} />
            <TagBadge tag={item.tag} />
          </div>
          <p className="font-serif text-lg leading-snug text-text-strong">{item.proposedAngle}</p>
        </div>
        <div className="flex items-center gap-2">
          <ScoreChip score={item.score} />
          <button
            type="button"
            onClick={() => setConfirmingDeleteItem(true)}
            className="rounded-md p-1 text-text-subtle transition-colors hover:bg-row-hover hover:text-error-fg"
            aria-label="Delete idea"
            title="Delete this idea (and its drafts / article)"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {confirmingDeleteItem && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-nested px-4 py-3">
          <span className="text-xs text-text-muted">
            Deletes this idea and everything downstream — its drafts and, for a web piece, its
            article. Sure?
          </span>
          <Button size="sm" variant="destructive" disabled={busy} onClick={deleteItem}>
            <Trash2 className="size-3.5" /> Yes, delete
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmingDeleteItem(false)}>
            Cancel
          </Button>
        </div>
      )}
      {deleteItemError && <p className="text-xs text-error-fg">{deleteItemError}</p>}

      {/* Developed points — the beats of the argument. This is what raises a queue item
          above a bare angle; edit by hand, or let the develop skill draw them out. */}
      <div className="flex flex-col gap-2">
        {editingPoints ? (
          <div className="flex flex-col gap-2 rounded-lg bg-surface-nested p-4">
            <label className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
              Points — the beats you'd make, one per line
            </label>
            <Textarea
              value={pointsText}
              onChange={(e) => setPointsText(e.target.value)}
              placeholder={'The tension only you see\nThe concrete example\nWhat it means for the reader'}
              className="min-h-28 bg-surface"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={savingPoints} onClick={savePoints}>
                <Check className="size-3.5" /> {savingPoints ? 'Saving…' : 'Save points'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={savingPoints}
                onClick={() => {
                  setPointsText((item.points ?? []).join('\n'))
                  setEditingPoints(false)
                }}
              >
                <X className="size-3.5" /> Cancel
              </Button>
            </div>
          </div>
        ) : (item.points ?? []).length > 0 ? (
          <div className="flex flex-col gap-1.5 rounded-lg bg-surface-nested px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                Points
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onDevelop}
                  className="inline-flex items-center gap-1 text-xs text-primary-ink underline-offset-2 hover:underline"
                >
                  <Sparkles className="size-3" /> Refine with AI
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPoints(true)}
                  className="text-xs text-text-subtle underline-offset-2 hover:text-text hover:underline"
                >
                  Edit
                </button>
              </div>
            </div>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-text-muted">
              {(item.points ?? []).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <button
              type="button"
              onClick={onDevelop}
              className="inline-flex items-center gap-1 self-start text-xs font-medium text-primary-ink transition-colors hover:underline"
            >
              <Sparkles className="size-3.5" /> Develop with AI
            </button>
            <button
              type="button"
              onClick={() => setEditingPoints(true)}
              className="inline-flex items-center gap-1 self-start text-xs text-text-subtle transition-colors hover:text-text"
            >
              <Plus className="size-3.5" /> Add points by hand
            </button>
          </div>
        )}
      </div>

      {needsTakeFirst ? (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-nested p-4">
          <label className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            Your take — one or two sentences, in your voice
          </label>
          <Textarea
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="What's the real angle only you would take here?"
            className="bg-surface"
          />
          <div className="flex items-center gap-3">
            <Button size="sm" disabled={busy || seed.trim() === ''} onClick={send}>
              <Check className="size-3.5" /> Save take
            </Button>
            <span className="text-xs text-text-subtle">
              Save your take first — then draft it. Agents never invent an opinion.
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {hasSeed && (
            <div className="flex flex-col gap-2 rounded-lg bg-surface-nested px-4 py-3">
              {editingSeed ? (
                <>
                  <label className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                    Your take — one or two sentences, in your voice
                  </label>
                  <Textarea
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    className="bg-surface"
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={busy || seed.trim() === ''} onClick={saveSeedEdit}>
                      <Check className="size-3.5" /> {busy ? 'Saving…' : 'Save take'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        setSeed(item.seed ?? '')
                        setEditingSeed(false)
                      }}
                    >
                      <X className="size-3.5" /> Cancel
                    </Button>
                  </div>
                </>
              ) : confirmingDeleteTake ? (
                <>
                  <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                    Your take
                  </span>
                  <p className="mt-1 text-sm text-text-muted">{item.seed}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="text-xs text-text">
                      Delete this take? It's the only opinion on this idea — you'll have to write it
                      again to draft in your voice.
                    </span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="destructive" disabled={busy} onClick={deleteSeed}>
                        <X className="size-3.5" /> {busy ? 'Deleting…' : 'Delete take'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setConfirmingDeleteTake(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-text-subtle">
                      Your take
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingSeed(true)}
                        className="text-xs text-text-subtle underline-offset-2 hover:text-text hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteTake(true)}
                        className="text-xs text-text-subtle underline-offset-2 hover:text-error-fg hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{item.seed}</p>
                </>
              )}
            </div>
          )}
          <ContentBlock
            item={item}
            linkedinConn={linkedinConn}
            publishEnabled={publishEnabled}
            profileName={profileName}
            images={cardImages}
            onChanged={onDone}
            onRevise={onDraft}
            onReview={onReview}
          />
          <ImageStrip
            ideaId={item.id}
            onChanged={setCardImages}
            onImageAI={onImage}
            generator={generator}
            working={imageWorking}
          />
          {!(item.platform === 'web' ? item.article?.body?.trim() : item.draft) && (
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={onDraft}>
                <Sparkles className="size-3.5" /> Write with AI
              </Button>
              <span className="text-xs text-text-subtle">
                {hasSeed
                  ? `Writes the full ${item.platform === 'web' ? 'article' : 'post'} from your take${(item.points ?? []).length ? ' and points' : ''}, in your voice.`
                  : 'Factual or curation — writes from the angle.'}
              </span>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

// One toggle in the silo filter bar: icon + label + count, tinted in the silo's hue
// when active. Rendered muted at zero so the axis stays legible even when empty.
function SiloFilterChip({
  label,
  count,
  active,
  icon,
  activeStyle,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  icon?: ReactNode
  activeStyle?: CSSProperties
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2 text-xs font-medium outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-primary/40',
        active ? 'shadow-sm' : 'bg-surface-sunken text-text-muted hover:bg-row-hover',
        !active && count === 0 && 'opacity-45',
      )}
      style={active ? activeStyle : undefined}
    >
      {icon}
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  )
}

export function QueueView() {
  const { data, loading, error, reload } = useResource(() => api.getQueue())
  // The queue is the review phase: shipped and archived ideas have left it.
  const items = (data ?? []).filter((i) => i.status !== 'published' && i.status !== 'archived')
  const [filter, setFilter] = useState<Silo | 'all'>('all')
  const [platformFilter, setPlatformFilter] = useState<ContentPlatform | 'all'>('all')
  // Publish wiring shared by every card: the LinkedIn connection (for the API modal)
  // and whether direct publishing is enabled on the Connections page.
  const [linkedinConn, setLinkedinConn] = useState<Connection | null>(null)
  const [profileName, setProfileName] = useState<string | undefined>(undefined)
  const publishEnabled = useCapabilityToggle('linkedin', 'publish')
  // Local generator status incl. the named-model roster — fetched once here (not
  // per card) and passed down to every strip's model picker. null = checking; a
  // failed probe reads as no local models, which leaves only the Claude option.
  const [generator, setGenerator] = useState<GeneratorStatus | null>(null)
  useEffect(() => {
    api.getConnections().then((rows) => {
      setLinkedinConn(rows.find((c) => c.platform === 'linkedin') ?? null)
    }).catch(() => setLinkedinConn(null))
    // The post preview's author fallback when LinkedIn isn't connected.
    api.getProfile().then((p) => setProfileName(p.name)).catch(() => setProfileName(undefined))
    api.getGeneratorStatus().then(setGenerator).catch(() =>
      setGenerator({ backend: 'mflux', configured: false, models: [] }),
    )
  }, [])
  // One `queue` skill drives this surface; the per-card buttons only vary the first-message
  // directive (develop vs draft) and the local `mode` (which sets the working hints and result
  // link). Each trigger bumps surfaceKey to remount the surface fresh on that item; the bump is
  // what lets the same card re-trigger.
  const [mode, setMode] = useState<'develop' | 'draft' | 'review' | 'image'>('develop')
  const [surfaceInput, setSurfaceInput] = useState<string | undefined>(undefined)
  // Claude model pin for the session (only the image picker's Claude-tier options
  // set it); undefined = the engine's default model.
  const [surfaceModel, setSurfaceModel] = useState<string | undefined>(undefined)
  const [surfaceKey, setSurfaceKey] = useState(0)
  // Which idea has a live imagery session — its card's Images strip polls for
  // candidates and shows the "generation takes a while" state. Set by imageItem;
  // cleared when any non-image session replaces the surface.
  const [imageIdeaId, setImageIdeaId] = useState<string | null>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  function runQueue(
    nextMode: 'develop' | 'draft' | 'review' | 'image',
    input: string,
    model?: string,
  ) {
    if (nextMode !== 'image') setImageIdeaId(null)
    setMode(nextMode)
    setSurfaceInput(input)
    setSurfaceModel(model)
    setSurfaceKey((k) => k + 1)
    surfaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  // Everything the view already knows about the item rides into the session's first
  // message, so the skill orients immediately instead of asking or re-deriving the
  // basics. The id stays authoritative — the skill still reads the row for anything deeper.
  function itemContext(item: IdeaQueueItem): string {
    const platform = (item.platform as ContentPlatform | null) ?? 'linkedin'
    const written = platform === 'web' ? item.article : item.draft
    const reviewStatus =
      platform === 'web' ? item.article?.reviewStatus : item.draft?.reviewStatus
    return (
      ` Known context — platform: ${platform}; silo: ${item.silo}; pillar: ${item.pillar}; ` +
      `tone: ${item.tone ?? 'profile default'}; my take: ${item.seed ? `"${item.seed}"` : 'not given yet'}; ` +
      `points: ${item.points.length > 0 ? item.points.map((p) => `"${p}"`).join(' | ') : 'none yet'}; ` +
      `written content: ${written ? `present (review status: ${reviewStatus ?? 'pending'})` : 'none yet'}.`
    )
  }
  function developItem(item: IdeaQueueItem) {
    runQueue(
      'develop',
      `Develop the queue item whose id is ${item.id} (angle: "${item.proposedAngle}"). ` +
        `Do not ask which item — use this one. Read it and its source first, open by telling ` +
        `me in a couple sentences what the item is and what the source says, then draw out ` +
        `my take and the 2-4 points.` +
        itemContext(item),
    )
  }
  function draftItem(item: IdeaQueueItem) {
    const kind = item.platform === 'web' ? 'article' : 'post'
    const hasContent =
      item.platform === 'web' ? Boolean(item.article?.body?.trim()) : Boolean(item.draft)
    runQueue(
      'draft',
      hasContent
        ? `Revise the written ${kind} for the queue item whose id is ${item.id} (angle: ` +
            `"${item.proposedAngle}"). Do not ask which item — use this one. Load the voice ` +
            `card and read the ${kind} first, then open by telling me where it stands in a ` +
            `few sentences (what it says, its review status, any standing check findings) ` +
            `and ask what I want changed. Write the revision back, then stay for follow-ups.` +
            itemContext(item)
        : `Write the full ${kind} for the queue item whose id is ${item.id} (angle: ` +
            `"${item.proposedAngle}"). Do not ask which item — use this one. Load the voice ` +
            `card, then write it from my take and points and save it.` +
            itemContext(item),
    )
  }
  function imageItem(item: IdeaQueueItem, engine: ImageEngine) {
    const kind = item.platform === 'web' ? 'article' : 'post'
    setImageIdeaId(item.id)
    // Articles carry several inline images, so their session opens with an image
    // PLAN (count + placements, recommended) and picks per slot; a post is one image.
    const planDirective =
      kind === 'article'
        ? `This is a long-form article, so follow the procedure's image-plan flow: first ` +
          `propose how many images it should carry and where (one line per image naming ` +
          `the section it supports, with a recommended count and why), let me set the ` +
          `plan, then produce at least 2 candidates per planned image and have me pick ` +
          `per image — three planned images means three picks of two, never one big ` +
          `pool. After each pick, agree where it sits in the body and insert the ` +
          `markdown reference there.`
        : `After attaching, you're done — a post's image rides the card, nothing to place ` +
          `inline.`
    // The card's model picker decides how much the session gets to choose. 'auto' (the
    // default) pins nothing: the session runs the type menu and picks the model per type
    // from src/images/recommend.ts, which already reconciles the right model for the job
    // against what's installed here. 'local'/'claude' are the override — they pin the
    // producer and skip the type menu entirely.
    const engineDirective =
      engine.kind === 'auto'
        ? `I did NOT pre-pick a producer — pick the best one for each image yourself. Run ` +
          `\`npx tsx src/images/recommend.ts\` FIRST: it scores every model 1-10 for each ` +
          `image type and knows which ones are actually installed here. Propose the type(s) ` +
          `that fit the piece and name the model you'd use for each WITH ITS SCORE and the ` +
          `one-line reason it gives ("data figure, Claude at 10/10, so the axis is ` +
          `truthful") — say the pick out loud, never choose silently. If it reports ` +
          `degraded, tell me the better model I'm missing and its score rather than quietly ` +
          `downgrading. If the best I have is discouraged (3/10 or lower), say the score and ` +
          `the failure mode BEFORE doing it and let me decide — advise, don't refuse. I can ` +
          `still override you.`
        : engine.kind === 'local'
        ? `I pre-picked the producer on the card: every image in this run is a GENERATED ` +
          `image from the generator using the model entry "${engine.model}" from ` +
          `image-generation.config.json (check its backend before you describe it to me — ` +
          `every entry runs on this machine except a "gemini" one, which calls Google) — ` +
          `pass "model": "${engine.model}" in each ` +
          `generate-image payload. Skip the type menu — do not propose or switch to ` +
          `composed graphics, screenshots, or stock. Open by proposing 2-3 candidate ` +
          `prompts in different styles (photoreal or illustrated, one recommended with a ` +
          `one-line why), let me pick, then run generation in the background per the ` +
          `procedure and tell me roughly how long it will take — candidates appear on ` +
          `the card's Images strip as they finish. If that model turns out to be ` +
          `unavailable, tell me and stop instead of silently switching model or type.`
        : `I pre-picked the producer on the card: every image in this run is COMPOSED by ` +
          `you — an explainer diagram, data figure, or comparison table authored as a ` +
          `bare figure in my brand's language and rendered. Skip the type menu — do not ` +
          `propose generated images, screenshots, or stock. Open by proposing in plain ` +
          `words what each image should show (one recommended with a one-line why), let ` +
          `me pick, then author, render, and inspect at least two candidates per image ` +
          `before showing me the pick.`
    runQueue(
      'image',
      `Add images to the queue item whose id is ${item.id} (angle: "${item.proposedAngle}"). ` +
        `Do not ask which item — use this one. Follow the imagery procedure: read the ${kind} ` +
        `and my brand guidelines first. ` +
        engineDirective +
        ` ` +
        planDirective +
        itemContext(item),
      engine.kind === 'claude' ? engine.claudeModel : undefined,
    )
  }
  function reviewItem(item: IdeaQueueItem) {
    const kind = item.platform === 'web' ? 'article' : 'post'
    runQueue(
      'review',
      `Review the written ${kind} for the queue item whose id is ${item.id} (angle: ` +
        `"${item.proposedAngle}"). Do not ask which item — use this one. Open with a short ` +
        `orientation before the verdict: what this ${kind} is, what it is trying to do (its ` +
        `intent and platform), in plain words. Then follow the content-reviewer spec exactly, ` +
        `write the verdict, and report pass or the fix list. Do not rewrite the content. ` +
        `Afterward stay in the session and answer my questions about the verdict or the piece.` +
        itemContext(item),
    )
  }
  // The generic top entry launches the queue skill in develop mode and lets it pick an item.
  function developGeneric() {
    runQueue('develop', 'List my queue ideas best-first and ask which one to develop.')
  }
  // Deep-link target: #/queue?item=<id> (e.g. from a spark result). Read once at
  // mount; the row with this id gets highlighted and scrolled into view.
  const highlightId = useMemo(
    () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('item') ?? undefined,
    [],
  )
  // "Needs your take" means the take is still missing — a needs-your-take item
  // that already carries a seed has been handled. This matches how the Overview
  // counts them (tag needs-your-take AND no seed yet), so the two screens agree.
  const needsTake = items.filter((i) => i.tag === 'needs-your-take' && !i.seed).length
  // Platform slicing: an idea with no platform column (older rows) reads as LinkedIn,
  // matching how drafting resolves it.
  const platformOf = (i: IdeaQueueItem): ContentPlatform =>
    (i.platform as ContentPlatform | null) ?? 'linkedin'
  const byPlatform =
    platformFilter === 'all' ? items : items.filter((i) => platformOf(i) === platformFilter)
  const countBySilo = (silo: Silo) => byPlatform.filter((i) => i.silo === silo).length
  const countByPlatform = (p: ContentPlatform) => items.filter((i) => platformOf(i) === p).length
  const shown = filter === 'all' ? byPlatform : byPlatform.filter((i) => i.silo === filter)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pipeline · Review"
        title="Queue"
        description="Every idea with its full written piece — the review phase. Read it, edit it by hand or revise with AI, then Publish: LinkedIn posts via the API, Reddit by copy-paste, long-form web pieces as an exported Markdown file. Published items move to the Published screen."
        actions={
          <span className="font-mono text-xs tabular-nums text-text-subtle">
            {items.length} ideas · {needsTake} need your take
          </span>
        }
      />

      {/* AI mode: one `queue` skill drives this surface; the per-card buttons below only vary the
          directive (develop vs draft) and the local mode (hints + result link). Each targets an
          item by id and remounts via surfaceKey. The idle fallback is the generic develop entry;
          its Start launches the queue skill in develop mode and lets it pick an item. The rows
          below are the permanent plain floor, so this surface is aiOnly; on each step it reloads
          so results land live. */}
      <div ref={surfaceRef}>
        <SkillSurface
          key={surfaceKey}
          skillName="queue"
          aiOnly
          initialInput={surfaceInput}
          model={surfaceModel}
          workingHints={
            mode === 'draft'
              ? DRAFT_HINTS
              : mode === 'review'
                ? REVIEW_HINTS
                : mode === 'image'
                  ? IMAGE_HINTS
                  : DEVELOP_HINTS
          }
          resultActions={
            mode === 'develop'
              ? { resetLabel: 'Develop another' }
              : { linkLabel: 'Show in Queue', resetLabel: 'Done' }
          }
          onProgress={reload}
          onResult={() => {
            // The session is done — stop the strip's "imagery session running"
            // state; flipping it off also triggers one final images+candidates
            // refresh so the strip lands on the finished state.
            setImageIdeaId(null)
            reload()
          }}
          onPlainSubmit={() => {
            /* No plain path — the rows below are the floor; aiOnly never calls this. */
          }}
          fallback={({ disabled }) => (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-strong">Develop or draft with AI</p>
                  <p className="text-xs text-text-subtle">
                    Use <span className="font-medium">Develop with AI</span> or{' '}
                    <span className="font-medium">Draft with AI</span> on any idea below to act on
                    that one — or start a develop session here and pick an item.
                  </p>
                </div>
              </div>
              <Button size="sm" disabled={disabled} onClick={developGeneric}>
                Start
              </Button>
            </div>
          )}
        />
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: 'all' as const, label: 'All lanes' },
              { key: 'linkedin' as const, label: 'LinkedIn' },
              { key: 'reddit' as const, label: 'Reddit' },
              { key: 'web' as const, label: 'Web (long-form)' },
            ]
          ).map((p) => (
            <SiloFilterChip
              key={p.key}
              label={p.label}
              count={p.key === 'all' ? items.length : countByPlatform(p.key)}
              active={platformFilter === p.key}
              activeStyle={{ backgroundColor: 'var(--color-selected-strong)', color: 'var(--color-selected-strong-fg)' }}
              onClick={() => setPlatformFilter(p.key)}
            />
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <SiloFilterChip
            label="All"
            count={byPlatform.length}
            active={filter === 'all'}
            activeStyle={{ backgroundColor: 'var(--color-selected-strong)', color: 'var(--color-selected-strong-fg)' }}
            onClick={() => setFilter('all')}
          />
          {ALL_SILOS.map((m) => {
            const Icon = m.icon
            return (
              <SiloFilterChip
                key={m.key}
                label={m.label}
                count={countBySilo(m.key)}
                active={filter === m.key}
                icon={<Icon className="size-3.5" strokeWidth={2.25} style={{ color: filter === m.key ? m.fg : undefined }} />}
                activeStyle={{ backgroundColor: m.bg, color: m.fg }}
                onClick={() => setFilter(m.key)}
              />
            )
          })}
          <SilosInfoLink className="ml-1" />
        </div>
      )}

      {loading ? (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 skeleton rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">{error}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-5" />}
          title="The queue is clear"
          hint="Promote something from Discovery, or capture a spark, and it lands here."
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-5" />}
          title="Nothing in this silo"
          hint="No ideas carry this intent yet. Clear the filter to see the whole queue."
        />
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {shown.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              linkedinConn={linkedinConn}
              publishEnabled={publishEnabled}
              profileName={profileName}
              onDone={reload}
              onDevelop={() => developItem(item)}
              onDraft={() => draftItem(item)}
              onReview={() => reviewItem(item)}
              onImage={(engine) => imageItem(item, engine)}
              generator={generator}
              imageWorking={imageIdeaId === item.id}
              highlight={item.id === highlightId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
