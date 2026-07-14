import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Hand-styled markdown mapping, matching the warm design system's type scale
// (see components/kit.tsx) instead of the @tailwindcss/typography `prose`
// plugin, which is not installed/registered in this project. Shared by any
// view that renders Markdown (VoiceView's voice card, DocsView's doc bodies).
//
// remark-gfm enables GitHub-flavored markdown — tables, strikethrough, task
// lists, and autolinks — which plain react-markdown does not parse. Every GFM
// element it can emit (table parts, del) is styled below so nothing falls back
// to an unstyled browser default.
const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="font-serif text-2xl font-semibold text-text-heading">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 font-serif text-xl font-semibold text-text-heading first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 font-serif text-lg font-semibold text-text-heading">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3 font-serif text-base font-semibold text-text-heading">{children}</h4>
  ),
  p: ({ children }) => <p className="text-sm leading-relaxed text-text-muted">{children}</p>,
  ul: ({ children }) => (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-text-muted">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-relaxed text-text-muted">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-text-strong">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-text-muted line-through">{children}</del>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary-ink underline underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs text-text">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-md bg-surface-sunken p-3 font-mono text-xs leading-relaxed text-text">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border-strong pl-4 text-sm italic leading-relaxed text-text-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-t border-border" />,
  // GFM tables. Wrapped so a wide table scrolls inside its own box instead of
  // pushing the page sideways.
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border-strong">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 font-semibold text-text-heading">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 align-top text-text-muted">{children}</td>
  ),
}

// The ask-turn prompt variant: a skill's question renders in the question's serif
// voice (the style SkillSurface's ask turns always used) instead of doc-body muted
// text, so a prompt that arrives carrying markdown still reads as a question, not a
// document. Every other element shares the doc mapping above.
const promptComponents: Components = {
  ...markdownComponents,
  p: ({ children }) => <p className="font-serif text-lg text-text-heading">{children}</p>,
}

export function Markdown({
  children,
  variant = 'body',
}: {
  children: string
  variant?: 'body' | 'prompt'
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={variant === 'prompt' ? promptComponents : markdownComponents}
    >
      {children}
    </ReactMarkdown>
  )
}
