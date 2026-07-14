import { useEffect, useRef, useState } from 'react'
import { api, type Tag } from '../lib/api'
import { TagChip } from './TagChip'
import { Input } from './ui/input'
import { tagDotColor } from '../lib/tagColors'
import { Plus, Check, X } from 'lucide-react'

// Reusable pick-or-create-and-attach control. Given an item's attached tags and the
// full vocabulary, it toggles attachments and mints new tags in one gesture. Kept
// view-agnostic so Discovery (and, later, queue/drafts) can share it.
export function TagPicker({
  attached,
  vocabulary,
  onAttach,
  onDetach,
  onCreate,
  onVocabularyChange,
}: {
  attached: Tag[]
  vocabulary: Tag[]
  onAttach: (tagId: string) => Promise<void>
  onDetach: (tagId: string) => Promise<void>
  onCreate: (name: string) => Promise<Tag>
  onVocabularyChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const attachedIds = new Set(attached.map((t) => t.id))
  const q = query.trim().toLowerCase()
  const filtered = q === '' ? vocabulary : vocabulary.filter((t) => t.name.toLowerCase().includes(q))
  // Show a "create" affordance only when the typed name matches no existing tag.
  const exactMatch = vocabulary.some((t) => t.name.toLowerCase() === q)
  const canCreate = q !== '' && !exactMatch

  async function toggle(tag: Tag) {
    setBusy(true)
    try {
      if (attachedIds.has(tag.id)) await onDetach(tag.id)
      else await onAttach(tag.id)
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    if (!canCreate) return
    setBusy(true)
    try {
      const tag = await onCreate(query.trim())
      onVocabularyChange()
      await onAttach(tag.id)
      setQuery('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative inline-flex flex-wrap items-center gap-1.5">
      {attached.map((t) => (
        <span key={t.id} className="inline-flex items-center gap-0.5">
          <TagChip tag={t.slug} />
          <button
            type="button"
            disabled={busy}
            onClick={() => onDetach(t.id)}
            className="text-text-subtle hover:text-error disabled:opacity-50"
            title={`Remove ${t.name}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-0.5 rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-text-muted hover:bg-row-hover"
      >
        <Plus className="size-3" /> Tag
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close tag picker"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg bg-surface-raised p-2 shadow-md">
            <Input
              ref={inputRef}
              value={query}
              disabled={busy}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="Filter or create…"
              className="h-8"
            />
            <div className="mt-1.5 flex max-h-52 flex-col overflow-y-auto">
              {filtered.map((t) => {
                const on = attachedIds.has(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={busy}
                    onClick={() => toggle(t)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-text hover:bg-row-hover disabled:opacity-50"
                  >
                    <span
                      className="inline-block size-3 shrink-0 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: tagDotColor(t.color, vocabulary.indexOf(t)) }}
                    />
                    <span className="flex-1 truncate">{t.name}</span>
                    {on && <Check className="size-3.5 shrink-0 text-primary-ink" />}
                  </button>
                )
              })}
              {canCreate && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={create}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary-ink hover:bg-row-hover disabled:opacity-50"
                >
                  <Plus className="size-3.5 shrink-0" />
                  <span className="flex-1 truncate">Create “{query.trim()}”</span>
                </button>
              )}
              {filtered.length === 0 && !canCreate && (
                <p className="px-2 py-1.5 text-xs text-text-subtle">No tags</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Convenience: the attach/detach/create handlers bound to a feed item, so callers
// don't re-derive them. Kept here next to the picker it feeds.
export function feedItemTagHandlers(itemId: string, onChanged: () => void) {
  return {
    onAttach: async (tagId: string) => {
      await api.attachTag(itemId, tagId)
      onChanged()
    },
    onDetach: async (tagId: string) => {
      await api.detachTag(itemId, tagId)
      onChanged()
    },
    onCreate: (name: string) => api.createTag(name),
  }
}
