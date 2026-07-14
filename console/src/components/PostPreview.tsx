import { useEffect, useState } from 'react'
import { ThumbsUp, MessageSquare, Repeat2, Send, Image as ImageIcon, MessageCircle } from 'lucide-react'
import type { Connection, Draft } from '../lib/api'
import { foldTruncation, tokenizeBody } from '../lib/linkedin'
import { titleStatus, REDDIT_TITLE_MAX } from '../lib/reddit'
import { Markdown } from './Markdown'
import { cn } from '../lib/cn'

// LinkedIn brand blue for in-body links — deliberately not the console teal.
const LINKEDIN_LINK = 'text-[#0a66c2]'

// Assemble the live post text the same way the editor's Copy-to-publish does:
// hook[0], a blank line, body, a blank line, close — trimmed.
function assemble(draft: Draft): string {
  return [draft.hookOptions[0] ?? '', '', draft.body, '', draft.close].join('\n').trim()
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('')
}

// Render body text as React nodes (never HTML): plain text passes through and
// hashtags / mentions / URLs get a non-interactive LinkedIn-blue span.
function TokenizedBody({ text }: { text: string }) {
  return (
    <>
      {tokenizeBody(text).map((token, i) =>
        token.type === 'text' ? (
          <span key={i}>{token.value}</span>
        ) : (
          <span key={i} className={cn(LINKEDIN_LINK, 'pointer-events-none')}>
            {token.value}
          </span>
        ),
      )}
    </>
  )
}

const ACTIONS = [
  { icon: ThumbsUp, label: 'Like' },
  { icon: MessageSquare, label: 'Comment' },
  { icon: Repeat2, label: 'Repost' },
  { icon: Send, label: 'Send' },
] as const

// Reddit self-post preview: a plain title + markdown body, with a title-length
// cue against Reddit's 300-char cap. No LinkedIn chrome, no fold, no action bar —
// the preflight panel, not the preview, is the compliance surface.
function RedditPreview({
  draft,
  connection,
  profileName,
}: {
  draft: Draft
  connection?: Connection | null
  profileName?: string
}) {
  const name = connection?.displayName ?? profileName ?? 'You'
  const title = draft.hookOptions[0] ?? ''
  const bodyMarkdown = [draft.body, draft.close].map((s) => s.trim()).filter(Boolean).join('\n\n')
  const status = titleStatus(title)

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2 font-sans text-xs text-text-subtle">
        <MessageCircle className="size-4 text-[#ff4500]" />
        <span className="font-medium text-text-muted">{name}</span>
        <span>· self-post preview</span>
      </div>

      <h3 className="font-serif text-lg font-semibold leading-snug text-text-strong">
        {title || '(no title yet)'}
      </h3>
      <div className="flex items-center justify-between font-mono text-[11px] text-text-subtle">
        <span>
          {status.length} / {REDDIT_TITLE_MAX} title chars
        </span>
        {status.over && <span className="text-error-fg">over Reddit's 300-char title limit</span>}
      </div>

      {bodyMarkdown ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Markdown>{bodyMarkdown}</Markdown>
        </div>
      ) : (
        <p className="border-t border-border pt-3 font-sans text-sm text-text-subtle">No body yet.</p>
      )}
    </div>
  )
}

function LinkedInPreview({
  draft,
  connection,
  profileName,
}: {
  draft: Draft
  connection?: Connection | null
  profileName?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [imgError, setImgError] = useState(false)

  // Expansion and avatar-error are one-way per view; reset on draft change so
  // switching drafts always shows the fold and re-attempts the avatar.
  useEffect(() => {
    setExpanded(false)
    setImgError(false)
  }, [draft.id])

  const name = connection?.displayName ?? profileName ?? 'You'
  const headline = connection?.headline ?? ''
  const avatarUrl = connection?.avatarUrl
  const media = draft.mediaSuggestion.trim()

  const body = assemble(draft)
  const { visible, folded } = foldTruncation(body)
  const showFull = expanded || !folded

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-sm">
      {/* Author header — LinkedIn UI chrome, so font-sans. */}
      <div className="flex items-start gap-3">
        {avatarUrl && !imgError ? (
          <img
            src={avatarUrl}
            alt={name}
            onError={() => setImgError(true)}
            className="size-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-sans text-sm font-semibold text-text-muted">
            {initials(name) || 'You'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-sans text-[15px] font-semibold text-text">{name}</span>
            <span className="shrink-0 font-sans text-sm text-text-subtle">· 1st</span>
          </div>
          {headline && (
            <p className="line-clamp-1 font-sans text-[13px] text-text-muted">{headline}</p>
          )}
          <p className="font-sans text-xs text-text-subtle">Now · 🌐</p>
        </div>
      </div>

      {/* Body — the owner's words, so font-serif. Newlines preserved. */}
      <div className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-text">
        <TokenizedBody text={showFull ? body : visible.trimEnd()} />
        {!showFull && (
          <>
            {' '}
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="font-sans text-text-subtle hover:underline"
            >
              …more
            </button>
          </>
        )}
      </div>

      {/* Media placeholder — the draft carries a suggestion, not a real asset. */}
      {media && (
        <div className="flex aspect-[1.91/1] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-sunken p-4 text-center">
          <ImageIcon className="size-6 text-text-subtle" />
          <span className="font-mono text-[11px] uppercase tracking-wide text-text-subtle">
            Suggested media
          </span>
          <p className="font-sans text-sm text-text-muted">{media}</p>
        </div>
      )}

      {/* Static action bar — realism only, inert. */}
      <div
        aria-hidden
        className="pointer-events-none flex items-center justify-between border-t border-border pt-2 font-sans text-sm text-text-subtle"
      >
        {ACTIONS.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <Icon className="size-4" /> {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function PostPreview({
  draft,
  connection,
  profileName,
}: {
  draft: Draft
  connection?: Connection | null
  profileName?: string
}) {
  if (draft.platform === 'reddit') {
    return <RedditPreview draft={draft} connection={connection} profileName={profileName} />
  }
  return <LinkedInPreview draft={draft} connection={connection} profileName={profileName} />
}
