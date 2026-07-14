import {
  MessagesSquare,
  GraduationCap,
  Trophy,
  Share2,
  MessageSquareText,
  HandHelping,
  BookOpen,
  MessageCircleQuestion,
  type LucideIcon,
} from 'lucide-react'
import type { Silo, PlatformKey } from './api'

// Presentation for the silo axis (a post's intent). The roster is platform-keyed —
// symmetric with src/core/silos.ts's SILO_ROSTERS — so unlike pillars/tags these hues
// are hand-picked per silo rather than index-assigned, and each icon encodes the
// silo's job. Colors stay in the badge family (light tint, deep text) but the leading
// icon is what marks silo as a different axis from the icon-less pillar and tag pills.
// Hues avoid the tag palette (amber / green).
export interface SiloMeta {
  key: Silo
  label: string
  // One-line intent, shown as a tooltip and picker hint. Written from the writer's side.
  hint: string
  icon: LucideIcon
  bg: string
  fg: string
}

// Shared by both rosters (see src/core/silos.ts) — a single object so the two roster
// entries stay identical, satisfying the "curate must be label-identical everywhere"
// invariant by construction rather than by discipline.
const CURATE: SiloMeta = {
  key: 'curate',
  label: 'Curate',
  hint: "Boost someone else's work, credited. No ask.",
  icon: Share2,
  bg: '#f2e9fa',
  fg: '#7c3aed',
}

const LINKEDIN_SILOS: SiloMeta[] = [
  {
    key: 'conversation',
    label: 'Conversation',
    hint: 'Opens a loop — a thought or question built for replies. No ask.',
    icon: MessagesSquare,
    bg: '#e9e9fb',
    fg: '#4338ca',
  },
  {
    key: 'teach',
    label: 'Teach',
    hint: 'A useful, specific takeaway. The only LinkedIn silo that can carry an ask.',
    icon: GraduationCap,
    bg: '#dff0ee',
    fg: '#0f766e',
  },
  {
    key: 'win',
    label: 'Win',
    hint: 'A short, warm celebration. Someone else is the hero. No ask.',
    icon: Trophy,
    bg: '#fbe7ec',
    fg: '#be123c',
  },
  CURATE,
]

const REDDIT_SILOS: SiloMeta[] = [
  {
    key: 'discuss',
    label: 'Discuss',
    hint: "Opens a genuine discussion — pose the question you're chewing on. Invites disagreement.",
    icon: MessageSquareText,
    bg: '#dbeafe',
    fg: '#1d4ed8',
  },
  {
    key: 'help',
    label: 'Help',
    hint: 'Answers a concrete problem as a service. The only Reddit silo that can be product-adjacent.',
    icon: HandHelping,
    bg: '#cffafe',
    fg: '#0e7490',
  },
  {
    key: 'share',
    label: 'Share',
    hint: 'A first-person experience or result, told plainly. No flex — where a LinkedIn win relocates.',
    icon: BookOpen,
    bg: '#ffe4d6',
    fg: '#c2410c',
  },
  {
    key: 'ask',
    label: 'Ask',
    hint: "Solicits the community's input, recommendations, or gut-check. No ask beyond the question.",
    icon: MessageCircleQuestion,
    bg: '#fce7f3',
    fg: '#be185d',
  },
  CURATE,
]

const SILO_ROSTERS: { platform: PlatformKey; silos: SiloMeta[] }[] = [
  { platform: 'linkedin', silos: LINKEDIN_SILOS },
  { platform: 'reddit', silos: REDDIT_SILOS },
]

/**
 * The silo presentation roster for one platform, in canonical order. Mirrors
 * getSilos(platform) in src/core/silos.ts; `platform` defaults to LinkedIn so every
 * existing call site keeps behaving exactly as before.
 */
export function getConsoleSilos(platform: PlatformKey = 'linkedin'): SiloMeta[] {
  const roster = SILO_ROSTERS.find((r) => r.platform === platform)
  return roster ? roster.silos : LINKEDIN_SILOS
}

// Flattened over every key across both rosters (unique except the shared `curate`,
// which points at the same object either way) so siloMeta()/SiloBadge keep working
// platform-agnostically without needing to know which roster a key came from.
export const SILO_BY_KEY: Record<Silo, SiloMeta> = Object.fromEntries(
  SILO_ROSTERS.flatMap((r) => r.silos).map((s) => [s.key, s]),
) as Record<Silo, SiloMeta>

// Fall back to teach (the server-side default) for an unknown/missing silo.
export function siloMeta(silo: Silo | undefined | null): SiloMeta {
  return (silo && SILO_BY_KEY[silo]) || SILO_BY_KEY.teach
}
