import { HelpCircle } from 'lucide-react'
import { cn } from '../lib/cn'

// A small "what's this?" link to the intents (silos) doc, placed anywhere the silo axis
// surfaces so the fixed intent set is always one click from an explanation. Uses the
// DocsView deep-link hash (#docs/<slug>); App.keyFromHash routes a `docs/*` hash to the
// Docs view, which opens the slug on mount.
export function SilosInfoLink({ className }: { className?: string }) {
  return (
    <a
      href="#docs/what-are-silos"
      title="What are intents (silos)?"
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-text-subtle transition-colors hover:text-primary-ink',
        className,
      )}
    >
      <HelpCircle className="size-3.5" />
      What’s this?
    </a>
  )
}
