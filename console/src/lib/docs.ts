// Static Markdown docs, built at bundle time from console/src/content/docs/*.md.
// Adding a doc is just dropping a new .md file with frontmatter in that folder —
// no build step, no registration, no DB. Grouping into the left sub-sidebar
// comes entirely from the `category` frontmatter field.

export interface Doc {
  slug: string
  title: string
  category: string
  order: number
  body: string
}

export interface DocCategory {
  category: string
  docs: Doc[]
}

// Categories in this order come first; anything else is appended alphabetically.
const CATEGORY_ORDER = ['Getting started', 'Setup', 'Reference']

// Deliberately not a dependency (no gray-matter): frontmatter here is a small,
// fixed set of scalar `key: value` lines between two `---` lines, so a tiny
// hand-rolled parser is plenty and keeps this doc pipeline dependency-free.
function parseFrontmatter(raw: string): { fields: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { fields: {}, body: raw }

  const [, frontmatter, body] = match
  const fields: Record<string, string> = {}
  for (const line of frontmatter.split(/\r?\n/)) {
    const lineMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!lineMatch) continue
    const [, key, rawValue] = lineMatch
    const value = rawValue.trim().replace(/^['"](.*)['"]$/, '$1')
    fields[key] = value
  }
  return { fields, body: body.trim() }
}

function slugFromPath(path: string): string {
  const file = path.split('/').pop() ?? path
  return file.replace(/\.md$/, '')
}

// `?raw` gets each file's raw text; `eager: true` resolves all of them at
// build time (there are only ever a handful of doc files, so there's no
// benefit to lazy-loading per-file chunks).
const modules = import.meta.glob('../content/docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const allDocs: Doc[] = Object.entries(modules).map(([path, raw]) => {
  const { fields, body } = parseFrontmatter(raw)
  return {
    slug: slugFromPath(path),
    title: fields.title ?? slugFromPath(path),
    category: fields.category ?? 'Reference',
    order: Number(fields.order ?? 0),
    body,
  }
})

function categoryRank(category: string): number {
  const i = CATEGORY_ORDER.indexOf(category)
  return i === -1 ? CATEGORY_ORDER.length : i
}

export function getDocs(): Doc[] {
  return [...allDocs].sort((a, b) => {
    const rankDiff = categoryRank(a.category) - categoryRank(b.category)
    if (rankDiff !== 0) return rankDiff
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    if (a.order !== b.order) return a.order - b.order
    return a.title.localeCompare(b.title)
  })
}

export function getDocsByCategory(): DocCategory[] {
  const docs = getDocs()
  const map = new Map<string, Doc[]>()
  for (const doc of docs) {
    const list = map.get(doc.category) ?? []
    list.push(doc)
    map.set(doc.category, list)
  }
  return [...map.entries()].map(([category, docs]) => ({ category, docs }))
}

export function getDocBySlug(slug: string): Doc | undefined {
  return allDocs.find((doc) => doc.slug === slug)
}
