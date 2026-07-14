import { useEffect, useRef, useState } from 'react'
import { api, type Tag } from '../lib/api'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../components/ui/dropdown-menu'
import { PageHeader, EmptyState } from '../components/kit'
import { SkillSurface } from '../components/SkillSurface'
import { TAG_PALETTE, tagDotColor } from '../lib/tagColors'
import { Tags as TagsIcon, Trash2, Palette, Check, Sparkles } from 'lucide-react'

// Ambient hints cycled in the tags skill's working state between asks.
const MANAGE_TAG_HINTS = [
  'Reading your vocabulary',
  'Checking for near-duplicates',
  'Scanning untagged items',
  'Keeping it tight',
]

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-3.5 shrink-0 rounded-full ring-1 ring-black/10"
      style={{ backgroundColor: color }}
    />
  )
}

function TagRow({
  tag,
  index,
  onChanged,
  onDelete,
}: {
  tag: Tag
  index: number
  onChanged: () => void
  onDelete: (tag: Tag) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tag.name)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function commit() {
    const next = name.trim()
    setEditing(false)
    if (next === '' || next === tag.name) {
      setName(tag.name)
      return
    }
    setBusy(true)
    try {
      await api.updateTag(tag.id, { name: next })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function recolor(color: string | null) {
    setBusy(true)
    try {
      await api.updateTag(tag.id, { color })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const count = tag.usageCount ?? 0

  return (
    <div className="flex items-center gap-3 rounded-lg bg-surface px-4 py-3 shadow-sm">
      <Swatch color={tagDotColor(tag.color, index)} />
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        {editing ? (
          <Input
            ref={inputRef}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setName(tag.name)
                setEditing(false)
              }
            }}
            className="h-7 max-w-56"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="truncate text-left text-sm font-medium text-text-strong hover:text-primary-ink"
            title="Click to rename"
          >
            {tag.name}
          </button>
        )}
        <span className="shrink-0 font-mono text-[11px] text-text-subtle">{tag.slug}</span>
      </div>

      <span className="shrink-0 font-mono text-xs tabular-nums text-text-subtle">
        {count} {count === 1 ? 'item' : 'items'}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="size-8" disabled={busy} title="Recolor">
            <Palette className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {TAG_PALETTE.map((p) => (
            <DropdownMenuItem key={p.text} onSelect={() => recolor(p.text)} className="gap-2">
              <Swatch color={p.text} />
              <span className="flex-1 text-xs">{p.name}</span>
              {tag.color?.toLowerCase() === p.text.toLowerCase() && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => recolor(null)} className="gap-2">
            <Swatch color={tagDotColor(null, index)} />
            <span className="flex-1 text-xs">Default (auto)</span>
            {!tag.color && <Check className="size-3.5" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size="icon"
        variant="ghost"
        className="size-8 text-text-subtle hover:text-error"
        disabled={busy}
        onClick={() => onDelete(tag)}
        title="Delete tag"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

function DeleteDialog({
  tag,
  onCancel,
  onConfirm,
}: {
  tag: Tag
  onCancel: () => void
  onConfirm: () => void
}) {
  const [busy, setBusy] = useState(false)
  const count = tag.usageCount ?? 0

  async function confirm() {
    setBusy(true)
    try {
      await api.deleteTag(tag.id)
      onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-surface-raised p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-text-strong">Delete “{tag.name}”?</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          {count > 0 ? (
            <>
              <span className="font-semibold text-text-strong">
                {count} {count === 1 ? 'item' : 'items'}
              </span>{' '}
              will lose this tag. This can’t be undone.
            </>
          ) : (
            <>This tag isn’t attached to any items.</>
          )}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" disabled={busy} onClick={confirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

export function TagsView() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Tag | null>(null)

  function load() {
    setLoading(true)
    api
      .getTags()
      .then((rows) => {
        setTags(rows)
        setError(null)
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function create() {
    const name = newName.trim()
    if (name === '') return
    setCreating(true)
    try {
      await api.createTag(name)
      setNewName('')
      load()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Insights · Taxonomy"
        title="Tags"
        description="The topical vocabulary you attach to discovered items. Create, rename, recolor, or delete tags here."
        actions={
          <span className="font-mono text-xs tabular-nums text-text-subtle">{tags.length} tags</span>
        }
      />

      {/* AI mode: the tags skill (add with anti-bloat judgment / suggest from real items). The
          add box + list below are the permanent plain floor, so this surface is aiOnly (no
          toggle); on completion it reloads the vocabulary. */}
      <SkillSurface
        skillName="tags"
        aiOnly
        workingHints={MANAGE_TAG_HINTS}
        resultActions={{ resetLabel: 'Do another' }}
        onResult={load}
        onPlainSubmit={() => {
          /* No plain path here — the add box/list below are the floor; aiOnly never calls this. */
        }}
        fallback={({ start, disabled }) => (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
                <Sparkles className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-strong">Manage tags with AI</p>
                <p className="text-xs text-text-subtle">
                  Add a tag (it dedups against near-duplicates first), or ask it to suggest tags
                  from your untagged items. Writes the same tags table as the box below.
                </p>
              </div>
            </div>
            <Button size="sm" disabled={disabled} onClick={() => start('')}>
              Start
            </Button>
          </div>
        )}
      />

      <div className="flex gap-2 rounded-lg bg-surface p-4 shadow-sm">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="New tag name"
          className="flex-1"
        />
        <Button size="sm" disabled={creating || newName.trim() === ''} onClick={create}>
          Add tag
        </Button>
      </div>

      {error && <div className="rounded-lg bg-error-bg p-4 text-sm text-error-fg shadow-sm">{error}</div>}

      {!error && loading && tags.length === 0 && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 skeleton rounded-lg" />
          ))}
        </div>
      )}

      {!error && !loading && tags.length === 0 && (
        <EmptyState
          icon={<TagsIcon className="size-5" />}
          title="No tags yet"
          hint="Create one above, or tag items in Discovery."
        />
      )}

      {tags.length > 0 && (
        <div className="flex flex-col gap-2">
          {tags.map((t, i) => (
            <TagRow key={t.id} tag={t} index={i} onChanged={load} onDelete={setPendingDelete} />
          ))}
        </div>
      )}

      {pendingDelete && (
        <DeleteDialog
          tag={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            setPendingDelete(null)
            load()
          }}
        />
      )}
    </div>
  )
}
